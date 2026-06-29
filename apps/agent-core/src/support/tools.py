"""
SupportPilot — 10 LangChain @tool functions for Salesforce support operations.

Each tool follows the established pattern:
  - @tool decorator from langchain_core.tools
  - @observe(as_type="generation") from langfuse for per-span tracing
  - Pydantic-validated inputs via type hints
  - Returns a JSON string with structured data AND a __ui__ key
  - The __ui__ key contains {"name": "...", "props": {...}} for GenUI rendering
  - Error handling wraps the MockSalesforceClient call in try/except
"""

import json
from typing import Any

from langchain_core.tools import tool
from langfuse import observe, get_client

from src.dependencies import get_salesforce_client


# ─────────────────────────────────────────────────────────
# TOOL 1: Search Salesforce Cases
# ─────────────────────────────────────────────────────────

@tool
@observe(as_type="generation")
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
        get_client().update_current_generation(
            input={"query": query, "filters": filters},
            output={"count": len(results)},
            metadata={"tool": "search_salesforce_cases"},
        )
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
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "search_salesforce_cases", "error": True},
        )
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
@observe(as_type="generation")
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
        get_client().update_current_generation(
            input={"case_id": case_id},
            output={"case_found": True},
            metadata={"tool": "get_case_details"},
        )
        return json.dumps({
            "case": case,
            "__ui__": {
                "name": "case-detail",
                "props": {"case": case},
            },
        })
    except ValueError as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "get_case_details", "error": True, "case_id": case_id},
        )
        return json.dumps({
            "error": str(e),
            "message": f"Case '{case_id}' was not found. Please verify the case ID and try again.",
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Case not found: {case_id}"},
            },
        })
    except Exception as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "get_case_details", "error": True},
        )
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
@observe(as_type="generation")
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
        open_cases = await client.search_cases(account_id, {"status": "Open"})

        account = ctx["account"]
        contact = ctx["contact"]

        get_client().update_current_generation(
            input={"account_id": account_id},
            output={"open_cases_count": len(open_cases)},
            metadata={"tool": "get_customer_context"},
        )
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
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "get_customer_context", "error": True},
        )
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
@observe(as_type="generation")
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

        if category:
            results = [
                r for r in results
                if r.get("category", "").lower() == category.lower()
            ]

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

        get_client().update_current_generation(
            input={"query": query, "category": category},
            output={"count": len(results)},
            metadata={"tool": "search_knowledge_base"},
        )
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
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "search_knowledge_base", "error": True},
        )
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
@observe(as_type="generation")
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
        get_client().update_current_generation(
            input={"query": query},
            output={"count": len(results)},
            metadata={"tool": "search_similar_tickets"},
        )
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
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "search_similar_tickets", "error": True},
        )
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
@observe(as_type="generation")
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
        kb_articles = await client.search_knowledge_base(case_id)

        draft_context: dict[str, Any] = {}
        if context:
            draft_context["issue"] = context
        draft_context["tone"] = tone

        draft = await client.draft_reply(case_id, draft_context)

        context_titles = [a["title"] for a in kb_articles]

        get_client().update_current_generation(
            input={"case_id": case_id, "tone": tone},
            output={"draft_length": len(draft)},
            metadata={"tool": "draft_case_reply", "context_articles": len(context_titles)},
        )
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
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "draft_case_reply", "error": True, "case_id": case_id},
        )
        return json.dumps({
            "error": str(e),
            "message": f"Cannot draft reply: case '{case_id}' was not found.",
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Case not found: {case_id}"},
            },
        })
    except Exception as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "draft_case_reply", "error": True},
        )
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
@observe(as_type="generation")
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
        get_client().update_current_generation(
            input={"subject": subject, "priority": priority},
            output={"case_created": True},
            metadata={"tool": "create_case"},
        )
        return json.dumps({
            "case": case,
            "__ui__": {
                "name": "case-created",
                "props": {"case": case},
            },
        })
    except Exception as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "create_case", "error": True},
        )
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
@observe(as_type="generation")
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
        old_case = await client.get_case_details(case_id)
        old_snapshot = {k: old_case.get(k) for k in fields.keys()}

        updated = await client.update_case(case_id, fields)

        changes: list[str] = []
        for key, new_val in fields.items():
            old_val = old_snapshot.get(key)
            if old_val != new_val:
                changes.append(f"{key}: {old_val} → {new_val}")

        get_client().update_current_generation(
            input={"case_id": case_id, "fields": list(fields.keys())},
            output={"changes_count": len(changes)},
            metadata={"tool": "update_case", "changes": changes},
        )
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
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "update_case", "error": True, "case_id": case_id},
        )
        return json.dumps({
            "error": str(e),
            "message": f"Cannot update case: '{case_id}' was not found.",
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Case not found: {case_id}"},
            },
        })
    except Exception as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "update_case", "error": True},
        )
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
@observe(as_type="generation")
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
        case = await client.get_case_details(case_id)

        escalation = await client.escalate_case(case_id, reason)

        escalation["requestedAction"] = requested_action or "Review and take appropriate action"

        get_client().update_current_generation(
            input={"case_id": case_id, "reason": reason},
            output={"escalated": True},
            metadata={"tool": "escalate_case", "requested_action": requested_action},
        )
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
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "escalate_case", "error": True, "case_id": case_id},
        )
        return json.dumps({
            "error": str(e),
            "message": f"Cannot escalate: case '{case_id}' was not found.",
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Case not found: {case_id}"},
            },
        })
    except Exception as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "escalate_case", "error": True},
        )
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to escalate case: {str(e)}"},
            },
        })


# ─────────────────────────────────────────────────────────
# TOOL 10: Send Case Reply
# ─────────────────────────────────────────────────────────

@tool
@observe(as_type="generation")
async def send_case_reply(
    case_id: str,
    message: str,
    channel: str = "email",
) -> str:
    """Send a reply to the customer on an existing Salesforce case.

    Validates the case exists, then sends the reply via the specified channel.
    Channel options: 'email' (default), 'portal', 'chat'.
    Returns confirmation with case update details.
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

        await client.send_reply(case_id, message, channel)

        changes = [f"reply sent via {channel}"]

        get_client().update_current_generation(
            input={"case_id": case_id, "channel": channel},
            output={"reply_sent": True},
            metadata={"tool": "send_case_reply"},
        )
        return json.dumps({
            "case": case,
            "channel": channel,
            "changes": changes,
            "__ui__": {
                "name": "case-updated",
                "props": {
                    "case": case,
                    "changes": changes,
                },
            },
        })
    except ValueError as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "send_case_reply", "error": True, "case_id": case_id},
        )
        return json.dumps({
            "error": str(e),
            "message": f"Cannot send reply: case '{case_id}' was not found.",
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Case not found: {case_id}"},
            },
        })
    except Exception as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "send_case_reply", "error": True},
        )
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {"message": f"Failed to send case reply: {str(e)}"},
            },
        })


# ─────────────────────────────────────────────────────────
# TOOL 11: Proactive Scan (Session Start)
# ─────────────────────────────────────────────────────────

from datetime import datetime, timezone, timedelta


@tool
@observe(as_type="generation")
async def proactive_scan() -> str:
    """Proactively scan all open cases for issues requiring attention.

    Runs on session start to detect stale cases, SLA breaches, high-priority
    items, and other anomalies. Returns structured JSON with issues detected
    and proposed diagnostic actions.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized."},
            },
        })
    try:
        # Reuse search to find open/escalated cases
        open_cases_raw = await client.search_cases(
            "open cases", {"status": "Open"}
        )
        escalated_cases_raw = await client.search_cases(
            "escalated cases", {"status": "Escalated"}
        )

        all_cases = (open_cases_raw or []) + (escalated_cases_raw or [])

        # Deduplicate by caseId
        seen: set[str] = set()
        unique_cases: list[dict] = []
        for c in all_cases:
            cid = c.get("caseId") or c.get("id", "")
            if cid not in seen:
                seen.add(cid)
                unique_cases.append(c)

        now = datetime.now(timezone.utc)
        issues: list[dict] = []

        for case in unique_cases:
            case_id = case.get("caseId") or case.get("id", "")
            case_number = case.get("caseNumber", "")
            subject = case.get("subject", "No subject")
            priority = case.get("priority", "Medium")
            status = case.get("status", "Open")
            account_name = case.get("accountName", "")
            contact_name = case.get("contactName", "")

            # Parse lastModifiedDate to compute stale duration
            last_modified_str = case.get("lastModifiedDate", "")
            stale_days = 0
            if last_modified_str:
                try:
                    last_mod = datetime.fromisoformat(
                        last_modified_str.replace("Z", "+00:00")
                    )
                    stale_days = (now - last_mod).days
                except (ValueError, TypeError):
                    pass

            # Determine SLA risk based on priority + staleness
            sla_risk = "low"
            if priority in ("High", "Critical") and stale_days > 1:
                sla_risk = "high"
            elif priority == "High" and stale_days > 0:
                sla_risk = "medium"
            elif stale_days > 3:
                sla_risk = "medium"

            # Only include cases that need attention
            if stale_days <= 0 and sla_risk == "low" and priority != "Critical":
                continue

            issues.append({
                "caseId": case_id,
                "caseNumber": case_number,
                "subject": subject,
                "priority": priority,
                "status": status,
                "accountName": account_name,
                "contactName": contact_name,
                "staleDays": stale_days,
                "slaRisk": sla_risk,
                "diagnosis": (
                    f"Case {case_number} ({subject}) has been {status.lower()} "
                    f"for {stale_days} day(s) with {priority} priority. "
                    f"SLA risk: {sla_risk.upper()}."
                ),
                "proposedActions": _generate_proposed_actions(
                    case, stale_days, sla_risk
                ),
            })

        get_client().update_current_generation(
            input={},
            output={
                "issues_count": len(issues),
                "total_cases_scanned": len(unique_cases),
            },
            metadata={
                "tool": "proactive_scan",
                "total_scanned": len(unique_cases),
            },
        )

        return json.dumps({
            "issues": issues,
            "totalScanned": len(unique_cases),
            "issuesFound": len(issues),
            "__ui__": {
                "name": "proposed-fix",
                "props": {
                    "issues": issues,
                    "totalScanned": len(unique_cases),
                    "issuesFound": len(issues),
                },
            },
        })
    except Exception as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"tool": "proactive_scan", "error": True},
        )
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {
                    "message": f"Failed to run proactive scan: {str(e)}"
                },
            },
        })


def _generate_proposed_actions(
    case: dict, stale_days: int, sla_risk: str
) -> list[dict]:
    """Generate recommended fix actions for a case based on its analysis.

    Returns a list of action dicts: [{step, tool, params, description}]
    that the approve_fix tool can execute after HITL approval.
    """
    case_id = case.get("caseId") or case.get("id", "")
    priority = case.get("priority", "Medium")
    status = case.get("status", "Open")
    actions: list[dict] = []

    step = 1

    # Escalate if stale + high priority
    if stale_days >= 2 and priority in ("High", "Critical"):
        actions.append({
            "step": step,
            "action": "escalate_case",
            "tool": "escalate_case",
            "params": {
                "case_id": case_id,
                "reason": (
                    f"Automated detection: case stale for {stale_days} day(s) "
                    f"with {priority} priority and {sla_risk} SLA risk."
                ),
                "requested_action": "Review and prioritize response",
            },
            "description": (
                f"Escalate case due to {sla_risk} SLA risk "
                f"after {stale_days} days"
            ),
        })
        step += 1

    # Update priority if stale
    if stale_days >= 3 and priority == "Medium":
        actions.append({
            "step": step,
            "action": "update_priority",
            "tool": "update_case",
            "params": {
                "case_id": case_id,
                "fields": {
                    "priority": "High",
                    "description": (
                        f"Priority auto-updated by SupportPilot: "
                        f"case stale for {stale_days} day(s)."
                    ),
                },
            },
            "description": (
                f"Escalate priority from Medium to High due to "
                f"{stale_days} days of inactivity"
            ),
        })
        step += 1

    # Add a note / status update if stale but not already acted on
    if stale_days >= 1 and not actions:
        actions.append({
            "step": step,
            "action": "update_status",
            "tool": "update_case",
            "params": {
                "case_id": case_id,
                "fields": {
                    "description": (
                        f"SupportPilot attention flag: case has been "
                        f"{status.lower()} for {stale_days} day(s). "
                        f"Recommended to review."
                    ),
                },
            },
            "description": (
                f"Flag case for review after "
                f"{stale_days} days of inactivity"
            ),
        })
        step += 1

    return actions


# ─────────────────────────────────────────────────────────
# TOOL 12: Approve Fix — Execute Approved Fix Actions
# ─────────────────────────────────────────────────────────

# Module-level dispatch table so approve_fix can call other
# tool functions directly without going through the LLM layer.
_execute_tool_map: dict[str, callable] = {}


def _init_execute_tool_map():
    """Build the dispatch table for approve_fix action execution."""
    global _execute_tool_map
    if _execute_tool_map:
        return
    # Lazy import to avoid circular dependency
    from src.support.tools import (
        update_case as _update_case_fn,
        escalate_case as _escalate_case_fn,
        send_case_reply as _send_case_reply_fn,
        create_case as _create_case_fn,
    )
    _execute_tool_map = {
        "update_case": _update_case_fn,
        "escalate_case": _escalate_case_fn,
        "send_case_reply": _send_case_reply_fn,
        "create_case": _create_case_fn,
    }


@tool
@observe(as_type="generation")
async def approve_fix(case_id: str, actions: list[dict]) -> str:
    """Execute approved fix actions for a case.

    Called AFTER HITL approval. Each action is dispatched to the
    corresponding tool function and executed in sequence.
    Actions: [{step: 1, tool: "update_case", params: {...}}, ...]
    Returns result with per-action status.
    """
    client = get_salesforce_client()
    if client is None:
        return json.dumps({
            "error": "Salesforce client not initialized",
            "__ui__": {
                "name": "error-display",
                "props": {"message": "Salesforce client not initialized."},
            },
        })
    try:
        _init_execute_tool_map()

        actions_taken: list[dict] = []

        for action in actions:
            step = action.get("step", 0)
            tool_name = action.get("tool", "")
            params = action.get("params", {})
            description = action.get("description", "")

            executor = _execute_tool_map.get(tool_name)
            if executor is None:
                actions_taken.append({
                    "step": step,
                    "action": tool_name,
                    "status": "failed",
                    "error": f"Unknown tool: {tool_name}",
                })
                continue

            try:
                # Invoke the underlying tool function with its params
                result_str = await executor.ainvoke(params)
                result_data = json.loads(result_str)

                actions_taken.append({
                    "step": step,
                    "action": tool_name,
                    "status": (
                        "success" if "error" not in result_data else "failed"
                    ),
                    "description": description,
                    "result": result_data,
                })
            except Exception as action_err:
                actions_taken.append({
                    "step": step,
                    "action": tool_name,
                    "status": "failed",
                    "error": str(action_err),
                    "description": description,
                })

        all_succeeded = all(
            a["status"] == "success" for a in actions_taken
        )

        get_client().update_current_generation(
            input={"case_id": case_id, "action_count": len(actions)},
            output={
                "actions_taken": len(actions_taken),
                "all_succeeded": all_succeeded,
            },
            metadata={"tool": "approve_fix", "case_id": case_id},
        )

        return json.dumps({
            "caseId": case_id,
            "actionsTaken": actions_taken,
            "allSucceeded": all_succeeded,
            "__ui__": {
                "name": "fix-applied",
                "props": {
                    "caseId": case_id,
                    "actionsTaken": actions_taken,
                    "allSucceeded": all_succeeded,
                },
            },
        })
    except Exception as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={
                "tool": "approve_fix",
                "error": True,
                "case_id": case_id,
            },
        )
        return json.dumps({
            "error": str(e),
            "__ui__": {
                "name": "error-display",
                "props": {
                    "message": f"Failed to execute fix actions: {str(e)}"
                },
            },
        })
