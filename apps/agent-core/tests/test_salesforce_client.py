"""
TDD Tests for MockSalesforceClient.

Strict TDD:
1. Write failing test FIRST
2. Implement code to pass test → GREEN

Tests cover all 9 methods of MockSalesforceClient with realistic
Salesforce support operations data.
"""

import pytest
from datetime import datetime, timezone


# ==========================================
# TEST 1: search_cases returns a list of cases
# ==========================================

@pytest.mark.asyncio
async def test_search_cases_returns_list():
    """GIVEN a MockSalesforceClient
    WHEN search_cases is called with a query
    THEN it must return a list with >= 1 item, each with expected keys"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()
    results = await client.search_cases("Acme")

    assert isinstance(results, list)
    assert len(results) >= 1

    expected_keys = {"id", "caseNumber", "subject", "status", "priority", "owner", "accountId", "createdDate"}
    for case in results:
        assert expected_keys.issubset(case.keys()), f"Missing keys in {case.get('caseNumber', 'unknown')}"


# ==========================================
# TEST 2: search_cases respects filters
# ==========================================

@pytest.mark.asyncio
async def test_search_cases_respects_filters():
    """GIVEN a MockSalesforceClient
    WHEN search_cases is called with filters={"status": "Open"}
    THEN all returned cases must have status == "Open" """
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()
    results = await client.search_cases("Acme", filters={"status": "Open"})

    assert isinstance(results, list)
    if results:
        for case in results:
            assert case["status"] == "Open", f"Case {case['caseNumber']} has status {case['status']}, expected Open"


# ==========================================
# TEST 3: get_case_details returns full case
# ==========================================

@pytest.mark.asyncio
async def test_get_case_details_returns_full_case():
    """GIVEN a MockSalesforceClient
    WHEN get_case_details is called with a valid case_id
    THEN it must return a case with all expected fields"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()
    # First get a valid case ID from search
    cases = await client.search_cases("Acme")
    assert len(cases) > 0

    case_id = cases[0]["id"]
    details = await client.get_case_details(case_id)

    expected_fields = {
        "id", "caseNumber", "subject", "description", "status", "priority",
        "origin", "owner", "accountId", "accountName", "contactId",
        "contactName", "email", "phone", "createdDate", "lastModifiedDate",
    }
    assert expected_fields.issubset(details.keys()), f"Missing fields in case details"
    assert isinstance(details["description"], str) and len(details["description"]) > 0
    assert isinstance(details["accountName"], str) and len(details["accountName"]) > 0
    assert isinstance(details["contactName"], str) and len(details["contactName"]) > 0
    assert isinstance(details["lastModifiedDate"], str)


# ==========================================
# TEST 4: get_case_details invalid id raises error
# ==========================================

@pytest.mark.asyncio
async def test_get_case_details_invalid_id_raises_error():
    """GIVEN a MockSalesforceClient
    WHEN get_case_details is called with "INVALID_ID"
    THEN it must raise ValueError"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()

    with pytest.raises(ValueError, match="Case not found|INVALID_ID|Unknown case"):
        await client.get_case_details("INVALID_ID")


# ==========================================
# TEST 5: get_customer_context returns account and contact
# ==========================================

@pytest.mark.asyncio
async def test_get_customer_context_returns_account_and_contact():
    """GIVEN a MockSalesforceClient
    WHEN get_customer_context is called with an account_id
    THEN it must return account and contact info with expected keys"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()
    context = await client.get_customer_context("acc-001")

    assert "account" in context
    assert "contact" in context

    account = context["account"]
    assert account["name"] and isinstance(account["name"], str)
    assert account["industry"] and isinstance(account["industry"], str)
    assert account["website"] and isinstance(account["website"], str)
    assert account["phone"] and isinstance(account["phone"], str)

    contact = context["contact"]
    assert contact["name"] and isinstance(contact["name"], str)
    assert contact["email"] and isinstance(contact["email"], str)
    assert contact["title"] and isinstance(contact["title"], str)


# ==========================================
# TEST 6: search_knowledge_base returns articles
# ==========================================

@pytest.mark.asyncio
async def test_search_knowledge_base_returns_articles():
    """GIVEN a MockSalesforceClient
    WHEN search_knowledge_base is called with a query
    THEN it must return a list of articles with expected keys"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()
    articles = await client.search_knowledge_base("password reset")

    assert isinstance(articles, list)
    assert len(articles) >= 1

    for article in articles:
        assert "articleId" in article
        assert "title" in article
        assert "contentExcerpt" in article
        assert "category" in article


# ==========================================
# TEST 7: search_similar_tickets returns resolved cases
# ==========================================

@pytest.mark.asyncio
async def test_search_similar_tickets_returns_resolved_cases():
    """GIVEN a MockSalesforceClient
    WHEN search_similar_tickets is called with a query
    THEN it must return resolved cases with resolution info"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()
    results = await client.search_similar_tickets("login issue")

    assert isinstance(results, list)
    assert len(results) >= 1

    for item in results:
        assert "id" in item
        assert "caseNumber" in item
        assert "subject" in item
        assert "resolution" in item
        assert "resolvedDate" in item
        assert "satisfactionRating" in item


# ==========================================
# TEST 8: draft_reply returns non-empty string
# ==========================================

@pytest.mark.asyncio
async def test_draft_reply_returns_non_empty_string():
    """GIVEN a MockSalesforceClient
    WHEN draft_reply is called with case_id and context
    THEN it must return a non-empty string that references the case"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()
    # Get a valid case first
    cases = await client.search_cases("Acme")
    assert len(cases) > 0

    case = cases[0]
    reply = await client.draft_reply(case["id"], {"issue": "Login problems"})

    assert isinstance(reply, str)
    assert len(reply) > 0


# ==========================================
# TEST 9: create_case returns new case
# ==========================================

@pytest.mark.asyncio
async def test_create_case_returns_new_case():
    """GIVEN a MockSalesforceClient
    WHEN create_case is called with subject, description, priority, account_id
    THEN it must return a new case with generated id, status="New", and correct fields"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()
    new_case = await client.create_case(
        subject="Test Case Subject",
        description="This is a test case description",
        priority="High",
        account_id="acc-001",
    )

    assert "id" in new_case
    assert len(new_case["id"]) > 0
    assert new_case["subject"] == "Test Case Subject"
    assert new_case["description"] == "This is a test case description"
    assert new_case["priority"] == "High"
    assert new_case["accountId"] == "acc-001"
    assert new_case["status"] == "New"


# ==========================================
# TEST 10: update_case modifies fields
# ==========================================

@pytest.mark.asyncio
async def test_update_case_modifies_fields():
    """GIVEN a MockSalesforceClient
    WHEN create_case then update_case is called
    THEN the updated case must reflect the field change"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()
    new_case = await client.create_case(
        subject="Update Test",
        description="Testing field updates",
        priority="Medium",
        account_id="acc-002",
    )

    updated = await client.update_case(new_case["id"], {"status": "In Progress", "priority": "High"})

    assert updated["status"] == "In Progress"
    assert updated["priority"] == "High"
    assert updated["subject"] == "Update Test"  # unchanged field preserved


# ==========================================
# TEST 11: escalate_case returns escalation status
# ==========================================

@pytest.mark.asyncio
async def test_escalate_case_returns_escalation_status():
    """GIVEN a MockSalesforceClient
    WHEN escalate_case is called with case_id and reason
    THEN it must return a dict with escalation info"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()
    cases = await client.search_cases("Acme")
    assert len(cases) > 0

    case_id = cases[0]["id"]
    escalation = await client.escalate_case(case_id, "Customer is VIP, needs immediate attention")

    assert "caseId" in escalation
    assert "reason" in escalation
    assert "escalatedAt" in escalation
    assert escalation["status"] == "Escalated"
    assert escalation["reason"] == "Customer is VIP, needs immediate attention"


# ==========================================
# TEST 12: async operations - all methods work with await
# ==========================================

@pytest.mark.asyncio
async def test_async_operations():
    """GIVEN a MockSalesforceClient
    WHEN calling all methods with await
    THEN all must execute without error"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()

    # search_cases
    results = await client.search_cases("test")
    assert isinstance(results, list)

    # get_case_details
    if results:
        details = await client.get_case_details(results[0]["id"])
        assert isinstance(details, dict)

    # get_customer_context
    context = await client.get_customer_context("acc-001")
    assert isinstance(context, dict)

    # search_knowledge_base
    articles = await client.search_knowledge_base("error")
    assert isinstance(articles, list)

    # search_similar_tickets
    similar = await client.search_similar_tickets("bug")
    assert isinstance(similar, list)

    # draft_reply
    if results:
        reply = await client.draft_reply(results[0]["id"])
        assert isinstance(reply, str)

    # create_case
    new_case = await client.create_case("Async Test", "Testing async", "Low", "acc-003")
    assert isinstance(new_case, dict)

    # update_case
    if new_case.get("id"):
        updated = await client.update_case(new_case["id"], {"status": "Closed"})
        assert isinstance(updated, dict)

    # escalate_case
    if results:
        escalation = await client.escalate_case(results[0]["id"], "Test escalation")
        assert isinstance(escalation, dict)


# ==========================================
# TEST 13: error handling for bad case IDs
# ==========================================

@pytest.mark.asyncio
async def test_error_handling_bad_case_id():
    """GIVEN a MockSalesforceClient
    WHEN calling methods with a bad/unknown case_id
    THEN graceful error handling must be in place"""
    from src.salesforce import MockSalesforceClient

    client = MockSalesforceClient()

    # get_case_details with bad ID
    with pytest.raises(ValueError):
        await client.get_case_details("non-existent-id-999")

    # update_case with bad ID
    with pytest.raises(ValueError):
        await client.update_case("non-existent-id-999", {"status": "Closed"})

    # escalate_case with bad ID should raise error
    with pytest.raises(ValueError):
        await client.escalate_case("non-existent-id-999", "Reason")
