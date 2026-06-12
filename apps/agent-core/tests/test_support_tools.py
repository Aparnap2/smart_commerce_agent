"""
TDD tests for SupportPilot — all 9 Salesforce tools.

Each tool has its own Test* class with tests covering:
  - Happy path (valid inputs → expected output structure)
  - UI payload verification (__ui__ key with name + props)
  - Error handling (invalid IDs, empty queries)
  - Edge cases (empty strings, no results)

All tools return JSON strings via json.dumps(). Tests parse and assert
on the dict structure.

Note: MockSalesforceClient does not implement query-based filtering in
search_cases (always returns 4 mock cases) or search_knowledge_base
(returns fallback articles for unmatched queries). Tests verify graceful
handling (no crashes/errors) rather than empty-list guarantees for those
cases — that would require a mock enhancement.

Calling convention: All tools are LangChain StructuredTool objects
(decorated with @tool), so they must be invoked via .coroutine() with
keyword arguments matching the function signature.
"""

import json

import pytest

from src.support.tools import (
    create_case,
    draft_case_reply,
    escalate_case,
    get_case_details,
    get_customer_context,
    search_knowledge_base,
    search_salesforce_cases,
    search_similar_tickets,
    update_case,
)

# ─────────────────────────────────────────────────────────
# Constants used across multiple test classes
# ─────────────────────────────────────────────────────────

VALID_CASE_ID = "500000000"       # 9-char ID starting with "500"
INVALID_CASE_ID = "INVALID_ID"    # Does not match any mock pattern
VALID_ACCOUNT_ID = "acc-001"      # Used by get_customer_context


# ====================================================================
# TOOL 1: search_salesforce_cases
# ====================================================================

class TestSearchSalesforceCases:
    """Tests for search_salesforce_cases(query, filters) → case-list GenUI."""

    @pytest.mark.asyncio
    async def test_search_cases_returns_list(self):
        """Calls with 'Acme', parses JSON, verifies 'cases' key is a non-empty list."""
        result = await search_salesforce_cases.coroutine(query="Acme")
        data = json.loads(result)
        assert "cases" in data, "Response missing 'cases' key"
        assert isinstance(data["cases"], list), "'cases' must be a list"
        assert len(data["cases"]) > 0, "Expected at least one case"

    @pytest.mark.asyncio
    async def test_search_cases_with_filters(self):
        """Calls with filters={'status': 'Open'}, verifies case list returned."""
        result = await search_salesforce_cases.coroutine(
            query="Acme", filters={"status": "Open"}
        )
        data = json.loads(result)
        assert "cases" in data, "Response missing 'cases' key"
        assert isinstance(data["cases"], list), "'cases' must be a list"

    @pytest.mark.asyncio
    async def test_search_cases_includes_ui_payload(self):
        """Verifies __ui__ key exists with name='case-list' and matching props."""
        result = await search_salesforce_cases.coroutine(query="Acme")
        data = json.loads(result)
        assert "__ui__" in data, "Response missing '__ui__' key"
        ui = data["__ui__"]
        assert ui["name"] == "case-list", f"Expected name='case-list', got '{ui['name']}'"
        assert "props" in ui, "__ui__ missing 'props'"
        assert ui["props"]["cases"] == data["cases"], \
            "props.cases must match top-level cases"

    @pytest.mark.asyncio
    async def test_search_cases_empty_query(self):
        """Calls with empty string, verifies returns gracefully without error."""
        result = await search_salesforce_cases.coroutine(query="")
        data = json.loads(result)
        assert "cases" in data, "Response missing 'cases' key"
        assert isinstance(data["cases"], list), "'cases' must be a list"
        assert "error" not in data, "Empty query should not produce an error"

    @pytest.mark.asyncio
    async def test_search_cases_no_results(self):
        """Calls with non-matching query, verifies tool handles gracefully (no error).

        Note: MockSalesforceClient.search_cases always returns 4 mock cases
        regardless of query. This test confirms the tool does not crash rather
        than asserting zero results — a mock enhancement would be needed to
        verify true query-based filtering.
        """
        result = await search_salesforce_cases.coroutine(query="NONEXISTENT12345")
        data = json.loads(result)
        assert "cases" in data, "Response missing 'cases' key"
        assert isinstance(data["cases"], list), "'cases' must be a list"
        assert "error" not in data, "Non-matching query should not produce an error"


# ====================================================================
# TOOL 2: get_case_details
# ====================================================================

class TestGetCaseDetails:
    """Tests for get_case_details(case_id) → case-detail GenUI."""

    @pytest.mark.asyncio
    async def test_get_case_details_returns_full_case(self):
        """Calls with valid case_id, verifies result has expected fields."""
        result = await get_case_details.coroutine(case_id=VALID_CASE_ID)
        data = json.loads(result)
        case = data.get("case", {})
        assert "id" in case, "Case missing 'id'"
        assert "caseNumber" in case, "Case missing 'caseNumber'"
        assert "subject" in case, "Case missing 'subject'"
        assert "status" in case, "Case missing 'status'"
        assert "priority" in case, "Case missing 'priority'"
        assert "description" in case, "Case missing 'description'"

    @pytest.mark.asyncio
    async def test_get_case_details_includes_ui_payload(self):
        """Verifies __ui__ with name='case-detail' and props.case contains all fields."""
        result = await get_case_details.coroutine(case_id=VALID_CASE_ID)
        data = json.loads(result)
        assert "__ui__" in data, "Response missing '__ui__' key"
        ui = data["__ui__"]
        assert ui["name"] == "case-detail", \
            f"Expected name='case-detail', got '{ui['name']}'"
        assert "props" in ui, "__ui__ missing 'props'"
        props_case = ui["props"]["case"]
        expected_fields = [
            "id", "caseNumber", "subject", "status", "priority", "description",
        ]
        for field in expected_fields:
            assert field in props_case, f"props.case missing '{field}'"

    @pytest.mark.asyncio
    async def test_get_case_details_invalid_id_returns_error(self):
        """Calls with 'INVALID_ID', verifies error message in response."""
        result = await get_case_details.coroutine(case_id=INVALID_CASE_ID)
        data = json.loads(result)
        assert "error" in data, "Invalid case ID should return an error message"
        assert data["__ui__"]["name"] == "error-display", \
            "UI should be error-display"


# ====================================================================
# TOOL 3: get_customer_context
# ====================================================================

class TestGetCustomerContext:
    """Tests for get_customer_context(account_id) → customer-context GenUI."""

    @pytest.mark.asyncio
    async def test_get_customer_context_returns_account_and_contact(self):
        """Calls with account_id, verifies account {name, industry}
        and contact {name, email, title}."""
        result = await get_customer_context.coroutine(
            account_id=VALID_ACCOUNT_ID
        )
        data = json.loads(result)
        account = data.get("account", {})
        contact = data.get("contact", {})
        assert "name" in account, "Account missing 'name'"
        assert "industry" in account, "Account missing 'industry'"
        assert "name" in contact, "Contact missing 'name'"
        assert "email" in contact, "Contact missing 'email'"
        assert "title" in contact, "Contact missing 'title'"

    @pytest.mark.asyncio
    async def test_get_customer_context_includes_ui_payload(self):
        """Verifies __ui__ with name='customer-context' and
        props.account / props.contact."""
        result = await get_customer_context.coroutine(
            account_id=VALID_ACCOUNT_ID
        )
        data = json.loads(result)
        assert "__ui__" in data, "Response missing '__ui__' key"
        ui = data["__ui__"]
        assert ui["name"] == "customer-context", \
            f"Expected name='customer-context', got '{ui['name']}'"
        assert "props" in ui, "__ui__ missing 'props'"
        assert ui["props"]["account"] == data["account"], \
            "props.account must match top-level account"
        assert ui["props"]["contact"] == data["contact"], \
            "props.contact must match top-level contact"

    @pytest.mark.asyncio
    async def test_get_customer_context_includes_open_cases(self):
        """Verifies response includes openCases list."""
        result = await get_customer_context.coroutine(
            account_id=VALID_ACCOUNT_ID
        )
        data = json.loads(result)
        assert "openCases" in data, "Response missing 'openCases' key"
        assert isinstance(data["openCases"], list), \
            "'openCases' must be a list"


# ====================================================================
# TOOL 4: search_knowledge_base
# ====================================================================

class TestSearchKnowledgeBase:
    """Tests for search_knowledge_base(query, category) → kb-results GenUI."""

    @pytest.mark.asyncio
    async def test_search_kb_returns_articles(self):
        """Calls with 'password reset', verifies articles list
        has expected structure."""
        result = await search_knowledge_base.coroutine(query="password reset")
        data = json.loads(result)
        assert "articles" in data, "Response missing 'articles' key"
        assert isinstance(data["articles"], list), "'articles' must be a list"
        if data["articles"]:
            article = data["articles"][0]
            assert "title" in article, "Article missing 'title'"
            assert "contentExcerpt" in article, \
                "Article missing 'contentExcerpt'"
            assert "category" in article, "Article missing 'category'"

    @pytest.mark.asyncio
    async def test_search_kb_with_category_filter(self):
        """Calls with 'login' and category='Security',
        verifies filtered results."""
        result = await search_knowledge_base.coroutine(
            query="login", category="Security"
        )
        data = json.loads(result)
        assert "articles" in data, "Response missing 'articles' key"
        assert isinstance(data["articles"], list), \
            "'articles' must be a list"

    @pytest.mark.asyncio
    async def test_search_kb_includes_ui_payload(self):
        """Verifies __ui__ with name='kb-results'."""
        result = await search_knowledge_base.coroutine(query="password reset")
        data = json.loads(result)
        assert "__ui__" in data, "Response missing '__ui__' key"
        ui = data["__ui__"]
        assert ui["name"] == "kb-results", \
            f"Expected name='kb-results', got '{ui['name']}'"
        assert "props" in ui, "__ui__ missing 'props'"
        assert ui["props"]["articles"] == data["articles"], \
            "props.articles must match top-level articles"

    @pytest.mark.asyncio
    async def test_search_kb_no_results(self):
        """Calls with 'XYZZYX', verifies tool handles gracefully (no error).

        Note: MockSalesforceClient.search_knowledge_base returns the first 2
        articles as a fallback when no articles match. This test confirms the
        tool does not crash rather than asserting zero articles.
        """
        result = await search_knowledge_base.coroutine(query="XYZZYX")
        data = json.loads(result)
        assert "articles" in data, "Response missing 'articles' key"
        assert isinstance(data["articles"], list), \
            "'articles' must be a list"
        assert "error" not in data, \
            "Unmatched query should not produce an error"


# ====================================================================
# TOOL 5: search_similar_tickets
# ====================================================================

class TestSearchSimilarTickets:
    """Tests for search_similar_tickets(query) → similar-tickets GenUI."""

    @pytest.mark.asyncio
    async def test_search_similar_returns_tickets(self):
        """Calls with 'payment failed', verifies list with
        id, subject, resolution."""
        result = await search_similar_tickets.coroutine(query="payment failed")
        data = json.loads(result)
        assert "tickets" in data, "Response missing 'tickets' key"
        assert isinstance(data["tickets"], list), \
            "'tickets' must be a list"
        if data["tickets"]:
            ticket = data["tickets"][0]
            assert "id" in ticket, "Ticket missing 'id'"
            assert "subject" in ticket, "Ticket missing 'subject'"
            assert "resolution" in ticket, "Ticket missing 'resolution'"

    @pytest.mark.asyncio
    async def test_search_similar_includes_ui_payload(self):
        """Verifies __ui__ with name='similar-tickets'."""
        result = await search_similar_tickets.coroutine(query="payment failed")
        data = json.loads(result)
        assert "__ui__" in data, "Response missing '__ui__' key"
        ui = data["__ui__"]
        assert ui["name"] == "similar-tickets", \
            f"Expected name='similar-tickets', got '{ui['name']}'"
        assert "props" in ui, "__ui__ missing 'props'"

    @pytest.mark.asyncio
    async def test_search_similar_no_results(self):
        """Calls with 'XYZZYX', verifies tool handles gracefully.

        Note: MockSalesforceClient.search_similar_tickets always returns
        3 resolved tickets regardless of the query. This test verifies the
        tool does not crash.
        """
        result = await search_similar_tickets.coroutine(query="XYZZYX")
        data = json.loads(result)
        assert "tickets" in data, "Response missing 'tickets' key"
        assert isinstance(data["tickets"], list), \
            "'tickets' must be a list"
        assert "error" not in data, \
            "Unmatched query should not produce an error"


# ====================================================================
# TOOL 6: draft_case_reply
# ====================================================================

class TestDraftCaseReply:
    """Tests for draft_case_reply(case_id, context, tone) → reply-draft GenUI."""

    @pytest.mark.asyncio
    async def test_draft_reply_returns_non_empty_draft(self):
        """Calls with valid case_id, verifies draft is a non-empty string
        containing case context."""
        result = await draft_case_reply.coroutine(case_id=VALID_CASE_ID)
        data = json.loads(result)
        assert "draft" in data, "Response missing 'draft' key"
        assert isinstance(data["draft"], str), "'draft' must be a string"
        assert len(data["draft"]) > 0, "Draft should not be empty"
        # Draft should contain greeting/closing text
        assert "Dear" in data["draft"] or "Thank you" in data["draft"], \
            "Draft should contain greeting/closing text"

    @pytest.mark.asyncio
    async def test_draft_reply_includes_ui_payload(self):
        """Verifies __ui__ with name='reply-draft',
        props.draft, props.caseId."""
        result = await draft_case_reply.coroutine(case_id=VALID_CASE_ID)
        data = json.loads(result)
        assert "__ui__" in data, "Response missing '__ui__' key"
        ui = data["__ui__"]
        assert ui["name"] == "reply-draft", \
            f"Expected name='reply-draft', got '{ui['name']}'"
        assert "props" in ui, "__ui__ missing 'props'"
        assert ui["props"]["draft"] == data["draft"], \
            "props.draft must match top-level draft"
        assert ui["props"]["caseId"] == data["caseId"], \
            "props.caseId must match top-level caseId"

    @pytest.mark.asyncio
    async def test_draft_reply_tone_parameter(self):
        """Calls with different tones, verifies response includes
        case context regardless of tone."""
        for tone in ("professional", "empathetic", "urgent"):
            result = await draft_case_reply.coroutine(
                case_id=VALID_CASE_ID, tone=tone,
            )
            data = json.loads(result)
            assert "draft" in data, \
                f"Tone '{tone}' response missing 'draft'"
            assert data["tone"] == tone, \
                f"Expected tone='{tone}', got '{data['tone']}'"
            assert "caseId" in data, \
                f"Tone '{tone}' response missing 'caseId'"
            assert "contextUsed" in data, \
                f"Tone '{tone}' response missing 'contextUsed'"

    @pytest.mark.asyncio
    async def test_draft_reply_invalid_case_id(self):
        """Calls with 'INVALID_ID', verifies graceful error response."""
        result = await draft_case_reply.coroutine(case_id=INVALID_CASE_ID)
        data = json.loads(result)
        assert "error" in data, \
            "Invalid case ID should return an error message"
        assert data["__ui__"]["name"] == "error-display", \
            "UI should be error-display"


# ====================================================================
# TOOL 7: create_case
# ====================================================================

class TestCreateCase:
    """Tests for create_case(subject, description, priority, account_id)
    → case-created GenUI."""

    @pytest.mark.asyncio
    async def test_create_case_returns_new_case(self):
        """Calls with subject, description, priority, account_id,
        verifies created case."""
        result = await create_case.coroutine(
            subject="Test case subject",
            description="Description for test case",
            priority="High",
            account_id=VALID_ACCOUNT_ID,
        )
        data = json.loads(result)
        created = data.get("case", {})
        assert "id" in created, "Created case missing 'id'"
        assert "caseNumber" in created, "Created case missing 'caseNumber'"
        assert created.get("status") == "New", \
            f"Expected status='New', got '{created.get('status')}'"
        assert created.get("subject") == "Test case subject", \
            "Expected subject='Test case subject'"
        assert created.get("priority") == "High", \
            "Expected priority='High'"

    @pytest.mark.asyncio
    async def test_create_case_includes_ui_payload(self):
        """Verifies __ui__ with name='case-created'."""
        result = await create_case.coroutine(
            subject="UI test",
            description="Testing UI payload",
            priority="Medium",
            account_id=VALID_ACCOUNT_ID,
        )
        data = json.loads(result)
        assert "__ui__" in data, "Response missing '__ui__' key"
        ui = data["__ui__"]
        assert ui["name"] == "case-created", \
            f"Expected name='case-created', got '{ui['name']}'"
        assert ui["props"]["case"] == data["case"], \
            "props.case must match top-level case"


# ====================================================================
# TOOL 8: update_case
# ====================================================================

class TestUpdateCase:
    """Tests for update_case(case_id, fields) → case-updated GenUI."""

    @pytest.mark.asyncio
    async def test_update_case_modifies_fields(self):
        """Calls update_case with fields={'status': 'Closed'},
        verifies response shows the change."""
        result = await update_case.coroutine(
            case_id=VALID_CASE_ID, fields={"status": "Closed"},
        )
        data = json.loads(result)
        updated = data.get("case", {})
        assert updated.get("status") == "Closed", \
            f"Expected status='Closed', got '{updated.get('status')}'"

    @pytest.mark.asyncio
    async def test_update_case_includes_changes_list(self):
        """Verifies response has 'changes' array describing what changed."""
        result = await update_case.coroutine(
            case_id=VALID_CASE_ID, fields={"priority": "High"},
        )
        data = json.loads(result)
        assert "changes" in data, "Response missing 'changes' array"
        assert isinstance(data["changes"], list), \
            "'changes' must be a list"
        # At least one change should describe what was modified
        assert len(data["changes"]) > 0, \
            "Expected at least one change description"

    @pytest.mark.asyncio
    async def test_update_case_includes_ui_payload(self):
        """Verifies __ui__ with name='case-updated'."""
        result = await update_case.coroutine(
            case_id=VALID_CASE_ID,
            fields={"description": "Updated description"},
        )
        data = json.loads(result)
        assert "__ui__" in data, "Response missing '__ui__' key"
        ui = data["__ui__"]
        assert ui["name"] == "case-updated", \
            f"Expected name='case-updated', got '{ui['name']}'"
        assert ui["props"]["case"] == data["case"], \
            "props.case must match top-level case"
        assert ui["props"]["changes"] == data["changes"], \
            "props.changes must match top-level changes"

    @pytest.mark.asyncio
    async def test_update_case_invalid_id(self):
        """Calls with 'INVALID_ID', verifies error response."""
        result = await update_case.coroutine(
            case_id=INVALID_CASE_ID, fields={"status": "Closed"},
        )
        data = json.loads(result)
        assert "error" in data, \
            "Invalid case ID should return an error message"
        assert data["__ui__"]["name"] == "error-display", \
            "UI should be error-display"


# ====================================================================
# TOOL 9: escalate_case
# ====================================================================

class TestEscalateCase:
    """Tests for escalate_case(case_id, reason, requested_action)
    → escalation-card GenUI."""

    @pytest.mark.asyncio
    async def test_escalate_case_returns_escalation(self):
        """Calls with case_id + reason, verifies escalation
        with requiresApproval=True."""
        result = await escalate_case.coroutine(
            case_id=VALID_CASE_ID,
            reason="Needs manager approval for refund",
            requested_action="Approve refund up to $500",
        )
        data = json.loads(result)
        escalation = data.get("escalation", {})
        assert escalation.get("caseId") == VALID_CASE_ID, \
            "Escalation caseId mismatch"
        assert "reason" in escalation, "Escalation missing 'reason'"
        assert escalation.get("status") == "Escalated", \
            f"Expected status='Escalated', got '{escalation.get('status')}'"
        assert data.get("requiresApproval") is True, \
            "requiresApproval must be True"

    @pytest.mark.asyncio
    async def test_escalate_case_includes_ui_payload(self):
        """Verifies __ui__ with name='escalation-card'."""
        result = await escalate_case.coroutine(
            case_id=VALID_CASE_ID,
            reason="Customer requested supervisor",
        )
        data = json.loads(result)
        assert "__ui__" in data, "Response missing '__ui__' key"
        ui = data["__ui__"]
        assert ui["name"] == "escalation-card", \
            f"Expected name='escalation-card', got '{ui['name']}'"
        assert ui["props"]["escalation"] == data["escalation"], \
            "props.escalation must match top-level escalation"
        assert ui["props"]["requiresApproval"] is True, \
            "props.requiresApproval must be True"

    @pytest.mark.asyncio
    async def test_escalate_case_invalid_case_id(self):
        """Calls with 'INVALID_ID', verifies error response."""
        result = await escalate_case.coroutine(
            case_id=INVALID_CASE_ID, reason="Test escalation",
        )
        data = json.loads(result)
        assert "error" in data, \
            "Invalid case ID should return an error message"
        assert data["__ui__"]["name"] == "error-display", \
            "UI should be error-display"

    @pytest.mark.asyncio
    async def test_escalate_case_missing_reason(self):
        """Calls with empty reason, verifies it still works
        (handles gracefully)."""
        result = await escalate_case.coroutine(
            case_id=VALID_CASE_ID, reason="",
        )
        data = json.loads(result)
        # Should still succeed — empty reason is allowed
        assert "error" not in data, \
            "Empty reason should not produce an error"
        assert "escalation" in data, "Response missing 'escalation'"
        assert data["requiresApproval"] is True, \
            "requiresApproval must be True"
