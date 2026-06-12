"""
SupportPilot — 9 LangChain @tool functions for Salesforce support operations.

Each tool follows the established pattern:
  - @tool decorator from langchain_core.tools
  - Pydantic-validated inputs via type hints
  - Returns a JSON string with structured data AND a __ui__ key
  - The __ui__ key contains {"name": "...", "props": {...}} for GenUI rendering
  - Error handling wraps the MockSalesforceClient call in try/except
"""

import json
from typing import Any

from langchain_core.tools import tool

from src.dependencies import get_salesforce_client


# ─────────────────────────────────────────────────────────
# TOOL 1: Search Salesforce Cases
# ─────────────────────────────────────────────────────────

@tool
async def search_salesforce_cases(
    query: str,
    filters: dict[str, Any] | None = None,
) -> str:
    """Search Salesforce cases by customer name, case number, subject, status, or priority.

    Supports natural language queries and structured filters (status, priority, owner, accountName).
    Returns up to 10 matching cases with key details for review.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized. Please ensure the application has started properly."},
            },
        })
    try:
        results = await client.search_cases(query, filters)
        return json.dumps({
            "cases": results,
            "count": len(results),
            "__ui__": {
                "name": "case-list",
                "props": {
                    "cases": results,
                    "query": query,
                    "totalCount": len(results),
                },
            },
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to search cases: {str(e)}"},
            },
        })


# ─────────────────────────────────────────────────────────
# TOOL 2: Get Case Details
# ─────────────────────────────────────────────────────────

@tool
async def get_case_details(case_id: str) -> str:
    """Fetch full case details by Salesforce case ID.

    Returns all case fields including description, account, contact, and history.
    Raises a helpful error if the case_id is not found.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized. Please ensure the application has started properly."},
            },
        })
    try:
        case = await client.get_case_details(case_id)
        return json.dumps({
            "case": case,
            "__ui__": {
                "name": "case-detail",
                "props": {"case": case},
            },
        })
    except ValueError as e:
        return json.dumps({
            "error": str(e),
            "message": f"Case '{case_id}' was not found. Please verify the case ID and try again.",
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Case not found: {case_id}"},
            },
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to get case details: {str(e)}"},
            },
        })


# ─────────────────────────────────────────────────────────
# TOOL 3: Get Customer Context
# ─────────────────────────────────────────────────────────

@tool
async def get_customer_context(account_id: str) -> str:
    """Fetch comprehensive customer context for a support agent.

    Returns account info, primary contact, open cases, and recent interactions
    to provide a 360-degree view of the customer.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized. Please ensure the application has started properly."},
            },
        })
    try:
        ctx = await client.get_customer_context(account_id)
        # Augment with open cases for the account
        open_cases = await client.search_cases(account_id, {"status": "Open"})

        account = ctx["account"]
        contact = ctx["contact"]

        return json.dumps({
            "account": account,
            "contact": contact,
            "openCases": open_cases,
            "recentInteractions": [],
            "__ui__": {
                "name": "customer-context",
                "props": {
                    "account": account,
                    "contact": contact,
                    "openCases": open_cases,
                    "recentInteractions": [],
                },
            },
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to get customer context: {str(e)}"},
            },
        })


# ─────────────────────────────────────────────────────────
# TOOL 4: Search Knowledge Base
# ─────────────────────────────────────────────────────────

@tool
async def search_knowledge_base(
    query: str,
    category: str | None = None,
) -> str:
    """Search internal knowledge base articles by query and optional category.

    Returns articles with title, excerpt, category, and relevance score.
    Useful for finding known solutions, troubleshooting guides, and best practices.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized. Please ensure the application has started properly."},
            },
        })
    try:
        results = await client.search_knowledge_base(query)

        # Apply optional category filter client-side
        if category:
            results = [
                r for r in results
                if r.get("category", "").lower() == category.lower()
            ]

        # Add relevance score for LLM reasoning
        query_lower = query.lower()
        for article in results:
            score = 0
            if query_lower in article.get("title", "").lower():
                score += 0.6
            if query_lower in article.get("category", "").lower():
                score += 0.3
            if query_lower in article.get("contentExcerpt", "").lower():
                score += 0.1
            article["relevance"] = round(min(score, 1.0), 2)

        return json.dumps({
            "articles": results,
            "count": len(results),
            "__ui__": {
                "name": "kb-results",
                "props": {
                    "articles": results,
                    "query": query,
                    "totalCount": len(results),
                },
            },
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to search knowledge base: {str(e)}"},
            },
        })


# ─────────────────────────────────────────────────────────
# TOOL 5: Search Similar Tickets
# ─────────────────────────────────────────────────────────

@tool
async def search_similar_tickets(query: str) -> str:
    """Search past resolved cases similar to the current issue.

    Returns resolved cases with resolution description and satisfaction rating.
    Helps agents find proven solutions from previously closed tickets.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized. Please ensure the application has started properly."},
            },
        })
    try:
        results = await client.search_similar_tickets(query)
        return json.dumps({
            "tickets": results,
            "count": len(results),
            "__ui__": {
                "name": "similar-tickets",
                "props": {
                    "tickets": results,
                    "query": query,
                    "totalCount": len(results),
                },
            },
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to search similar tickets: {str(e)}"},
            },
        })


# ─────────────────────────────────────────────────────────
# TOOL 6: Draft Case Reply
# ─────────────────────────────────────────────────────────

@tool
async def draft_case_reply(
    case_id: str,
    context: str | None = None,
    tone: str = "professional",
) -> str:
    """Generate a suggested reply grounded in case data and KB context.

    The draft is automatically tailored to the case subject and customer.
    Supports tone options: 'professional' (default), 'empathetic', or 'urgent'.
    Provide optional 'context' string for additional issue-specific guidance.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized. Please ensure the application has started properly."},
            },
        })
    try:
        # Gather relevant knowledge base articles for context
        kb_articles = await client.search_knowledge_base(case_id)

        # Build context dict for the draft generator
        draft_context: dict[str, Any] = {}
        if context:
            draft_context["issue"] = context
        draft_context["tone"] = tone

        draft = await client.draft_reply(case_id, draft_context)

        context_titles = [a["title"] for a in kb_articles]

        return json.dumps({
            "draft": draft,
            "caseId": case_id,
            "tone": tone,
            "contextUsed": context_titles,
            "__ui__": {
                "name": "reply-draft",
                "props": {
                    "draft": draft,
                    "caseId": case_id,
                    "tone": tone,
                    "contextUsed": context_titles,
                },
            },
        })
    except ValueError as e:
        return json.dumps({
            "error": str(e),
            "message": f"Cannot draft reply: case '{case_id}' was not found.",
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Case not found: {case_id}"},
            },
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to draft case reply: {str(e)}"},
            },
        })


# ─────────────────────────────────────────────────────────
# TOOL 7: Create Case
# ─────────────────────────────────────────────────────────

@tool
async def create_case(
    subject: str,
    description: str,
    priority: str = "Medium",
    account_id: str = "",
) -> str:
    """Create a new case in Salesforce.

    Priority options: 'Low', 'Medium' (default), 'High', 'Critical'.
    Returns the created case with a generated ID and case number.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized. Please ensure the application has started properly."},
            },
        })
    try:
        case = await client.create_case(subject, description, priority, account_id)
        return json.dumps({
            "case": case,
            "__ui__": {
                "name": "case-created",
                "props": {"case": case},
            },
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to create case: {str(e)}"},
            },
        })


# ─────────────────────────────────────────────────────────
# TOOL 8: Update Case
# ─────────────────────────────────────────────────────────

@tool
async def update_case(case_id: str, fields: dict[str, Any]) -> str:
    """Update case fields in Salesforce: status, priority, description, owner, etc.

    Returns the updated case along with a list of changed fields
    so the agent can confirm what was modified.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized. Please ensure the application has started properly."},
            },
        })
    try:
        # Capture old state for change tracking
        old_case = await client.get_case_details(case_id)
        old_snapshot = {k: old_case.get(k) for k in fields.keys()}

        updated = await client.update_case(case_id, fields)

        # Compute human-readable change descriptions
        changes: list[str] = []
        for key, new_val in fields.items():
            old_val = old_snapshot.get(key)
            if old_val != new_val:
                changes.append(f"{key}: {old_val} → {new_val}")

        return json.dumps({
            "case": updated,
            "changes": changes,
            "__ui__": {
                "name": "case-updated",
                "props": {
                    "case": updated,
                    "changes": changes,
                },
            },
        })
    except ValueError as e:
        return json.dumps({
            "error": str(e),
            "message": f"Cannot update case: '{case_id}' was not found.",
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Case not found: {case_id}"},
            },
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to update case: {str(e)}"},
            },
        })


# ─────────────────────────────────────────────────────────
# TOOL 9: Escalate Case (Human-in-the-Loop)
# ─────────────────────────────────────────────────────────

@tool
async def escalate_case(
    case_id: str,
    reason: str,
    requested_action: str | None = None,
) -> str:
    """Escalate a case to team lead for approval (Human-in-the-Loop).

    Requires 'reason' explaining why escalation is needed.
    Optional 'requested_action' specifies what follow-up action is needed from the approver.
    Returns escalation confirmation with status and reference details.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized. Please ensure the application has started properly."},
            },
        })
    try:
        # Validate case exists before escalating
        case = await client.get_case_details(case_id)

        escalation = await client.escalate_case(case_id, reason)

        # Augment with requested_action
        escalation["requestedAction"] = requested_action or "Review and take appropriate action"

        return json.dumps({
            "escalation": escalation,
            "requiresApproval": True,
            "__ui__": {
                "name": "escalation-card",
                "props": {
                    "escalation": escalation,
                    "requiresApproval": True,
                },
            },
        })
    except ValueError as e:
        return json.dumps({
            "error": str(e),
            "message": f"Cannot escalate: case '{case_id}' was not found.",
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Case not found: {case_id}"},
            },
        })
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to escalate case: {str(e)}"},
            },
        })
