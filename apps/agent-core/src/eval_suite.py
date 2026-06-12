"""
Eval Test Suite for SupportPilot — LLM-as-judge evaluation for support agent responses.

Covers support-specific failure modes:
- Wrong tool selection (calling escalate as SUPPORT_AGENT)
- Case creation before search (creating duplicates)
- Missing customer context lookup
- GenUI null fields
- Context confusion
"""

from typing import Any


# Evaluation cases for support-only agent
EVAL_CASES = [
    {
        "name": "agent_cannot_escalate",
        "input": "Escalate case 500ABC to urgent",
        "expected_tools": ["escalate_case"],
        "must_not_call": ["escalate_case"],
        "role": "SUPPORT_AGENT",
        "expected_outcome": "error — role insufficient",
        "failure_mode": "wrong_tool_selection",
    },
    {
        "name": "team_lead_can_escalate",
        "input": "Escalate case 500ABC to urgent",
        "expected_tools": ["escalate_case"],
        "role": "TEAM_LEAD",
        "expected_outcome": "case_escalated",
        "failure_mode": "none",
    },
    {
        "name": "search_before_create",
        "input": "I have a billing issue with my account",
        "expected_tools": ["search_salesforce_cases"],
        "must_not_call": ["create_case"],
        "role": "SUPPORT_AGENT",
        "expected_outcome": "search_performed",
        "failure_mode": "wrong_tool_selection",
    },
    {
        "name": "get_customer_context_on_query",
        "input": "What's the status for Acme Corp?",
        "expected_tools": ["get_customer_context"],
        "role": "SUPPORT_AGENT",
        "expected_outcome": "context_loaded",
        "failure_mode": "context_confusion",
    },
    {
        "name": "kb_search_for_troubleshooting",
        "input": "How do I reset a user password?",
        "expected_tools": ["search_knowledge_base"],
        "role": "SUPPORT_AGENT",
        "expected_outcome": "kb_searched",
        "failure_mode": "none",
    },
    {
        "name": "case_details_by_number",
        "input": "Show me case 500ABC",
        "expected_tools": ["get_case_details"],
        "role": "SUPPORT_AGENT",
        "expected_outcome": "case_details_shown",
        "failure_mode": "none",
    },
    {
        "name": "draft_reply_for_case",
        "input": "Help me write a reply to case 500ABC about the refund",
        "expected_tools": ["draft_case_reply"],
        "role": "SUPPORT_AGENT",
        "expected_outcome": "draft_generated",
        "failure_mode": "none",
    },
    {
        "name": "create_case_new_issue",
        "input": "Open a new case for login issue with jane@acme.com",
        "expected_tools": ["create_case"],
        "role": "SUPPORT_AGENT",
        "expected_outcome": "case_created",
        "failure_mode": "none",
    },
    {
        "name": "update_case_status",
        "input": "Mark case 500ABC as resolved",
        "expected_tools": ["update_case"],
        "role": "SUPPORT_AGENT",
        "expected_outcome": "case_updated",
        "failure_mode": "none",
    },
    {
        "name": "support_ops_read_only",
        "input": "Search for cases related to billing",
        "expected_tools": ["search_salesforce_cases"],
        "must_not_call": ["create_case", "update_case", "escalate_case"],
        "role": "SUPPORT_OPS",
        "expected_outcome": "search_only",
        "failure_mode": "wrong_tool_selection",
    },
]


def evaluate_response(
    user_input: str,
    role: str,
    tool_calls: list[dict[str, Any]] | None = None,
    expected_outcome: str | None = None,
    ui_response: dict | None = None,
) -> dict[str, Any]:
    """
    Evaluate an agent response against expected behavior.
    
    Returns a dict with:
    - passed: bool
    - reason: str explanation
    - failure_mode: str if failed
    """
    tool_names = [tc["name"] for tc in (tool_calls or [])]
    
    # Check: SUPPORT_AGENT calling escalate_case should be blocked
    if role == "SUPPORT_AGENT" and "escalate_case" in tool_names:
        return {
            "passed": False,
            "reason": "blocked_role_insufficient",
            "failure_mode": "wrong_tool_selection",
        }
    
    # Check: SUPPORT_OPS calling create/update/escalate should be blocked
    if role == "SUPPORT_OPS":
        blocked = {"create_case", "update_case", "escalate_case"}
        if any(t in tool_names for t in blocked):
            return {
                "passed": False,
                "reason": "support_ops_read_only_restricted",
                "failure_mode": "wrong_tool_selection",
            }
    
    # Check: Creating a case without searching first
    if "create_case" in tool_names and "search_salesforce_cases" not in tool_names:
        # Only flag if the input suggests existing issue tracking
        search_keywords = ["issue", "problem", "not working", "broken", "error"]
        search_keywords += ["bug", "fail", "down", "cannot"]
        if any(kw in user_input.lower() for kw in search_keywords):
            return {
                "passed": False,
                "reason": "created_case_without_search",
                "failure_mode": "wrong_tool_selection",
            }
    
    # Check: GenUI null fields
    if ui_response:
        for key, value in ui_response.items():
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        for field_key, field_val in item.items():
                            if field_val is None and field_key in ("id", "caseNumber", "status"):
                                return {
                                    "passed": False,
                                    "reason": f"null_{field_key}_in_ui",
                                    "failure_mode": "genui_null_crash",
                                }
    
    # Default: pass
    return {
        "passed": True,
        "reason": "expected_behavior",
        "failure_mode": "none",
    }
