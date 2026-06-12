"""
E2E SupportPilot flow tests with MockLLM — no real LLM calls.

Tests the full graph flow end-to-end using:
  - MockLLM (canned responses, no OpenRouter/rate limits)
  - Real MockSalesforceClient (in-memory mock data, initialized by conftest)
  - Real PostgreSQL (Docker supabase-db on localhost:5433)
  - Real tool call functions (the actual @tool functions from src.support)
  - Bypassed auth (graph doesn't require auth in test config)

Each test invokes a support tool directly (not through the LLM) and asserts:
  - Tool returned results (no errors)
  - __ui__ key present with expected GenUI name
  - Data integrity for read-only vs mutation tools

Pytest marks: all tests are async (module-level pytestmark).
"""

import json

import pytest
from langchain_core.messages import HumanMessage

from src.support import (
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

pytestmark = pytest.mark.asyncio

# ── Test constants matching MockSalesforceClient patterns ──────────
VALID_CASE_ID = "500000000"       # 9-char ID starting with "500" → index 0
VALID_ACCOUNT_ID = "acc-001"      # Derives index via abs(hash("acc-001")) % 5


# ═══════════════════════════════════════════════════════════════════
# Read-Only Tool Tests
# ═══════════════════════════════════════════════════════════════════

class TestE2ESearchCases:
    """E2E: search_salesforce_cases tool with MockLLM + real MockSalesforceClient."""

    async def test_e2e_search_cases_with_mock_llm(self, test_db_pool, tool_config):
        """E2E: invoke search_salesforce_cases tool directly and assert results."""
        result = await search_salesforce_cases.ainvoke(
            {"query": "Acme Corp"},
            tool_config,
        )
        data = json.loads(result)
        assert "error" not in data, f"Unexpected error: {data.get('error')}"
        assert "__ui__" in data, "Response missing '__ui__' key"
        assert data["__ui__"]["name"] == "case-list", \
            f"Expected case-list, got {data['__ui__']['name']}"
        assert len(data.get("cases", [])) > 0, "Expected at least one case in results"
        # Verify case structure
        case = data["cases"][0]
        assert "id" in case, "Case missing 'id'"
        assert "caseNumber" in case, "Case missing 'caseNumber'"
        assert "subject" in case, "Case missing 'subject'"


class TestE2ECaseDetails:
    """E2E: get_case_details tool with MockLLM + real MockSalesforceClient."""

    async def test_e2e_get_case_details_with_mock_llm(self, test_db_pool, tool_config):
        """E2E: invoke get_case_details with a case ID and assert case detail."""
        result = await get_case_details.ainvoke(
            {"case_id": VALID_CASE_ID},
            tool_config,
        )
        data = json.loads(result)
        assert "error" not in data, f"Unexpected error: {data.get('error')}"
        assert "__ui__" in data, "Response missing '__ui__' key"
        assert data["__ui__"]["name"] == "case-detail", \
            f"Expected case-detail, got {data['__ui__']['name']}"
        case = data.get("case", {})
        assert case.get("id") == VALID_CASE_ID, \
            f"Expected case id={VALID_CASE_ID}, got {case.get('id')}"
        assert "subject" in case, "Case missing 'subject'"
        assert "status" in case, "Case missing 'status'"
        assert "priority" in case, "Case missing 'priority'"


class TestE2ECustomerContext:
    """E2E: get_customer_context tool with MockLLM + real MockSalesforceClient."""

    async def test_e2e_get_customer_context_with_mock_llm(self, test_db_pool, tool_config):
        """E2E: invoke get_customer_context and assert customer data returned."""
        result = await get_customer_context.ainvoke(
            {"account_id": VALID_ACCOUNT_ID},
            tool_config,
        )
        data = json.loads(result)
        assert "error" not in data, f"Unexpected error: {data.get('error')}"
        assert "__ui__" in data, "Response missing '__ui__' key"
        assert data["__ui__"]["name"] == "customer-context", \
            f"Expected customer-context, got {data['__ui__']['name']}"
        # Verify account info
        account = data.get("account", {})
        assert "name" in account, "Account missing 'name'"
        assert "industry" in account, "Account missing 'industry'"
        # Verify contact info
        contact = data.get("contact", {})
        assert "name" in contact, "Contact missing 'name'"
        assert "email" in contact, "Contact missing 'email'"
        # Verify open cases are included
        assert "openCases" in data, "Response missing 'openCases'"
        assert isinstance(data["openCases"], list), "'openCases' must be a list"


class TestE2ESearchKnowledgeBase:
    """E2E: search_knowledge_base tool with MockLLM + real MockSalesforceClient."""

    async def test_e2e_search_knowledge_base_with_mock_llm(self, test_db_pool, tool_config):
        """E2E: invoke search_knowledge_base and assert KB articles returned."""
        result = await search_knowledge_base.ainvoke(
            {"query": "password reset"},
            tool_config,
        )
        data = json.loads(result)
        assert "error" not in data, f"Unexpected error: {data.get('error')}"
        assert "__ui__" in data, "Response missing '__ui__' key"
        assert data["__ui__"]["name"] == "kb-results", \
            f"Expected kb-results, got {data['__ui__']['name']}"
        articles = data.get("articles", [])
        assert len(articles) > 0, "Expected at least one KB article"
        article = articles[0]
        assert "title" in article, "Article missing 'title'"
        assert "contentExcerpt" in article, "Article missing 'contentExcerpt'"
        assert "category" in article, "Article missing 'category'"


class TestE2ESearchSimilarTickets:
    """E2E: search_similar_tickets tool with MockLLM + real MockSalesforceClient."""

    async def test_e2e_search_similar_tickets_with_mock_llm(self, test_db_pool, tool_config):
        """E2E: invoke search_similar_tickets and assert similar tickets returned."""
        result = await search_similar_tickets.ainvoke(
            {"query": "payment failed"},
            tool_config,
        )
        data = json.loads(result)
        assert "error" not in data, f"Unexpected error: {data.get('error')}"
        assert "__ui__" in data, "Response missing '__ui__' key"
        assert data["__ui__"]["name"] == "similar-tickets", \
            f"Expected similar-tickets, got {data['__ui__']['name']}"
        tickets = data.get("tickets", [])
        assert len(tickets) > 0, "Expected at least one similar ticket"
        ticket = tickets[0]
        assert "id" in ticket, "Ticket missing 'id'"
        assert "subject" in ticket, "Ticket missing 'subject'"
        assert "resolution" in ticket, "Ticket missing 'resolution'"


# ═══════════════════════════════════════════════════════════════════
# Mutation Tool Tests
# ═══════════════════════════════════════════════════════════════════

class TestE2ECreateCase:
    """E2E: create_case tool with MockLLM + real MockSalesforceClient."""

    async def test_e2e_create_case_with_mock_llm(self, test_db_pool, tool_config):
        """E2E: invoke create_case and assert case created with __ui__."""
        result = await create_case.ainvoke(
            {
                "subject": "Test billing issue — double charge",
                "description": "Customer reporting double charge on invoice INV-2026-0099",
                "priority": "High",
                "account_id": VALID_ACCOUNT_ID,
            },
            tool_config,
        )
        data = json.loads(result)
        assert "error" not in data, f"Unexpected error: {data.get('error')}"
        assert "__ui__" in data, "Response missing '__ui__' key"
        assert data["__ui__"]["name"] == "case-created", \
            f"Expected case-created, got {data['__ui__']['name']}"
        created = data.get("case", {})
        assert "id" in created, "Created case missing 'id'"
        assert "caseNumber" in created, "Created case missing 'caseNumber'"
        assert created.get("status") == "New", \
            f"Expected status='New', got '{created.get('status')}'"
        assert created.get("subject") == "Test billing issue — double charge", \
            "Subject mismatch in created case"
        assert created.get("priority") == "High", \
            f"Expected priority='High', got '{created.get('priority')}'"


class TestE2EUpdateCase:
    """E2E: update_case tool with MockLLM + real MockSalesforceClient."""

    async def test_e2e_update_case_with_mock_llm(self, test_db_pool, tool_config):
        """E2E: invoke update_case with status change and assert update."""
        result = await update_case.ainvoke(
            {
                "case_id": VALID_CASE_ID,
                "fields": {"status": "Closed", "priority": "Low"},
            },
            tool_config,
        )
        data = json.loads(result)
        assert "error" not in data, f"Unexpected error: {data.get('error')}"
        assert "__ui__" in data, "Response missing '__ui__' key"
        assert data["__ui__"]["name"] == "case-updated", \
            f"Expected case-updated, got {data['__ui__']['name']}"
        updated = data.get("case", {})
        assert updated.get("status") == "Closed", \
            f"Expected status='Closed', got '{updated.get('status')}'"
        assert updated.get("priority") == "Low", \
            f"Expected priority='Low', got '{updated.get('priority')}'"
        # Verify changes tracking
        changes = data.get("changes", [])
        assert len(changes) > 0, "Expected at least one change description"
        assert any("status" in c.lower() for c in changes), \
            f"Changes should mention status: {changes}"


class TestE2EEscalateCase:
    """E2E: escalate_case tool with MockLLM + real MockSalesforceClient."""

    async def test_e2e_escalate_case_with_mock_llm(self, test_db_pool, tool_config):
        """E2E: invoke escalate_case and assert escalation result."""
        result = await escalate_case.ainvoke(
            {
                "case_id": VALID_CASE_ID,
                "reason": "Customer requires manager-level approval for refund over $500",
                "requested_action": "Approve refund and notify finance team",
            },
            tool_config,
        )
        data = json.loads(result)
        assert "error" not in data, f"Unexpected error: {data.get('error')}"
        assert "__ui__" in data, "Response missing '__ui__' key"
        assert data["__ui__"]["name"] == "escalation-card", \
            f"Expected escalation-card, got {data['__ui__']['name']}"
        escalation = data.get("escalation", {})
        assert escalation.get("caseId") == VALID_CASE_ID, \
            f"Expected caseId={VALID_CASE_ID}, got {escalation.get('caseId')}"
        assert escalation.get("status") == "Escalated", \
            f"Expected status='Escalated', got '{escalation.get('status')}'"
        assert data.get("requiresApproval") is True, \
            "requiresApproval must be True for escalation"


class TestE2EDraftReply:
    """E2E: draft_case_reply tool with MockLLM + real MockSalesforceClient."""

    async def test_e2e_draft_reply_with_mock_llm(self, test_db_pool, tool_config):
        """E2E: invoke draft_case_reply and assert draft reply returned."""
        result = await draft_case_reply.ainvoke(
            {
                "case_id": VALID_CASE_ID,
                "tone": "professional",
            },
            tool_config,
        )
        data = json.loads(result)
        assert "error" not in data, f"Unexpected error: {data.get('error')}"
        assert "__ui__" in data, "Response missing '__ui__' key"
        assert data["__ui__"]["name"] == "reply-draft", \
            f"Expected reply-draft, got {data['__ui__']['name']}"
        assert "draft" in data, "Response missing 'draft' key"
        assert isinstance(data["draft"], str), "'draft' must be a string"
        assert len(data["draft"]) > 0, "Draft should not be empty"
        # Draft should contain greeting/customer contact
        assert "Dear" in data["draft"] or "Thank you" in data["draft"], \
            "Draft should contain greeting or closing text"
        assert data.get("caseId") == VALID_CASE_ID, \
            f"Expected caseId={VALID_CASE_ID}, got {data.get('caseId')}"
        assert data.get("tone") == "professional", \
            f"Expected tone='professional', got '{data.get('tone')}'"


# ═══════════════════════════════════════════════════════════════════
# Full Graph & Role Filtering Tests
# ═══════════════════════════════════════════════════════════════════

class TestE2EFullGraph:
    """E2E: full graph invocation with MockLLM — no real LLM needed."""

    async def test_e2e_full_graph_invocation_with_mock_llm(self, test_db_pool, tool_config):
        """Invoke the full graph with MockLLM — validates graph completes without error.

        MockLLM returns canned text responses (no tool_calls), so tools won't
        execute. This test verifies the graph structure is sound: it starts,
        routes through the agent node, and ends cleanly without crashing.
        """
        from src.graph import graph

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Find open cases for Acme Corp")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        messages = result.get("messages", [])
        assert len(messages) > 0, "Graph should return at least one message"
        # MockLLM doesn't call tools, but the graph should complete with step_count > 0
        assert result.get("step_count", 0) > 0, \
            "step_count should increment after agent node executes"

        last = messages[-1]
        assert hasattr(last, "content"), "Last message should have content"
        assert last.content, "Last message content should not be empty"
        # With MockLLM, the response is a canned JSON message — should not contain errors
        assert "error" not in str(last.content).lower(), \
            "MockLLM response should not contain error indicators"


class TestE2ERoleFiltering:
    """E2E: verify role-based tool filtering works correctly."""

    async def test_e2e_role_filtering_enforced(self):
        """Verify get_tools_for_role returns correct tool sets per role.

        SUPPORT_AGENT: 8 tools (all except escalate_case)
        TEAM_LEAD:     9 tools (all, including escalate_case)
        SUPPORT_OPS:   5 tools (read-only: no create/update/escalate)
        """
        from src.tools import get_tools_for_role

        # ── SUPPORT_AGENT: 8 tools, no escalate ────────────────────
        agent_tools = get_tools_for_role("SUPPORT_AGENT")
        agent_names = [t.name for t in agent_tools]
        assert "escalate_case" not in agent_names, \
            "SUPPORT_AGENT must not have escalate_case"
        assert len(agent_names) == 8, \
            f"SUPPORT_AGENT should have 8 tools, got {len(agent_names)}: {agent_names}"
        # Verify all expected tools are present
        for expected in [
            "search_salesforce_cases", "get_case_details", "get_customer_context",
            "search_knowledge_base", "search_similar_tickets", "draft_case_reply",
            "create_case", "update_case",
        ]:
            assert expected in agent_names, \
                f"SUPPORT_AGENT missing tool: {expected}"

        # ── TEAM_LEAD: 9 tools, includes escalate ──────────────────
        lead_tools = get_tools_for_role("TEAM_LEAD")
        lead_names = [t.name for t in lead_tools]
        assert "escalate_case" in lead_names, \
            "TEAM_LEAD must have escalate_case"
        assert len(lead_names) == 9, \
            f"TEAM_LEAD should have 9 tools, got {len(lead_names)}: {lead_names}"

        # ── SUPPORT_OPS: 5 read-only tools ─────────────────────────
        ops_tools = get_tools_for_role("SUPPORT_OPS")
        ops_names = [t.name for t in ops_tools]
        assert len(ops_names) == 5, \
            f"SUPPORT_OPS should have 5 tools, got {len(ops_names)}: {ops_names}"
        for mutation_tool in ["create_case", "update_case", "escalate_case"]:
            assert mutation_tool not in ops_names, \
                f"SUPPORT_OPS must not have mutation tool: {mutation_tool}"
        # Verify read-only tools are present
        for read_tool in [
            "search_salesforce_cases", "get_case_details", "get_customer_context",
            "search_knowledge_base", "search_similar_tickets",
        ]:
            assert read_tool in ops_names, \
                f"SUPPORT_OPS missing read-only tool: {read_tool}"
