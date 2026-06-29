"""SupportPilot — Salesforce customer support tools for the LangGraph agent."""

from .tools import (
    search_salesforce_cases,
    get_case_details,
    get_customer_context,
    search_knowledge_base,
    search_similar_tickets,
    draft_case_reply,
    create_case,
    update_case,
    escalate_case,
    send_case_reply,
    proactive_scan,
    approve_fix,
)

SUPPORT_TOOLS = [
    search_salesforce_cases,
    get_case_details,
    get_customer_context,
    search_knowledge_base,
    search_similar_tickets,
    draft_case_reply,
    create_case,
    update_case,
    escalate_case,
    send_case_reply,
    proactive_scan,
    approve_fix,
]

__all__ = ["SUPPORT_TOOLS"] + [t.name for t in SUPPORT_TOOLS]
