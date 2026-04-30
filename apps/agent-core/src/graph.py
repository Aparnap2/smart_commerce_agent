import os
import json
from typing import Annotated, TypedDict, Optional, Literal
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_openai import AzureChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt, Command
from .tools import ALL_TOOLS


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    step_count: int
    # B2B fields
    pending_pr_id: Optional[str]
    pending_pr_number: Optional[str]
    pending_pr_total: Optional[int]
    pending_pr_requestor: Optional[str]
    pending_pr_items: Optional[list]
    awaiting_approval: bool
    last_tool_result: Optional[dict]


def get_llm():
    return AzureChatOpenAI(
        azure_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"],
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version=os.environ["AZURE_OPENAI_API_VERSION"],
        temperature=0,
        streaming=True,
    ).bind_tools(ALL_TOOLS)


SYSTEM_PROMPT = """You are ProcureAI — an intelligent internal procurement assistant.

YOUR USERS:
- EMPLOYEE (Requestor): can search catalog, create PRs, view their own PR history, raise disputes.
- MANAGER (Approver): can do everything EMPLOYEE can, PLUS see all department PRs and approve/reject.
- FINANCE: read-only access to all PRs and budgets.

STANDARD WORKFLOW:
1. Employee describes what they need.
2. You call search_catalog → show CatalogGrid GenUI.
3. Employee selects items → you call manage_purchase_request action='create' (if no draft PR exists), then action='add_item' for each item.
   ALWAYS call get_budget_status before adding items over ₹10,000.
4. Employee reviews → calls manage_purchase_request action='view' → show PurchaseRequestDraft GenUI.
5. Employee submits → you call submit_for_approval.
   Tell the employee: "Submitted. Your manager (approver@company.com) has been notified."

MANAGER WORKFLOW:
- Manager asks: "Show pending approvals" → call get_purchase_requests status_filter='PENDING_APPROVAL' → show PRList GenUI with Approve/Reject buttons.
- Manager approves → call process_approval decision='APPROVED'
- Manager rejects → call process_approval decision='REJECTED'

RULES:
- Format all prices as ₹X,XXX (Indian locale).
- NEVER approve a PR for the same person who submitted it.
- If budget would be exceeded, surface the BudgetAlert GenUI and suggest alternatives.
- CRITICAL urgency PRs: note they bypass 48h SLA.
- Keep responses concise — users are busy professionals.
- Always confirm destructive actions before executing.
"""

llm = None


async def call_agent(state: AgentState):
    global llm
    if llm is None:
        llm = get_llm()

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        *state["messages"],
    ]
    response = await llm.ainvoke(messages)

    return {
        "messages": [response],
        "step_count": state.get("step_count", 0) + 1,
    }


def should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if (
        not getattr(last, "tool_calls", None)
        or state.get("step_count", 0) >= 5
    ):
        return END
    return "tools"


def route_after_tools(state: AgentState) -> Literal["approval_gate", "agent"]:
    """Route to approval_gate when PR was submitted, else back to agent."""
    messages = state.get("messages", [])
    if not messages:
        return "agent"
    
    last_msg = messages[-1]
    content = last_msg.content if hasattr(last_msg, "content") else ""
    
    try:
        if isinstance(content, str):
            data = json.loads(content)
            if data.get("__pr_submitted"):
                return "approval_gate"
    except (json.JSONDecodeError, TypeError):
        pass
    
    return "agent"


def approval_gate_node(state: AgentState) -> Command[Literal["agent", END]]:
    """Pauses the graph after submit_for_approval fires. Resumes when manager calls with Command(resume=)."""
    decision = interrupt({
        "type": "awaiting_manager_approval",
        "prId": state.get("pending_pr_id"),
        "prNumber": state.get("pending_pr_number"),
        "total": state.get("pending_pr_total"),
        "requestor": state.get("pending_pr_requestor"),
        "items": state.get("pending_pr_items"),
        "message": "Purchase request awaiting your approval.",
    })
    
    if decision == "APPROVED":
        return Command(goto="agent", update={
            "messages": state["messages"] + [BaseMessage(content=json.dumps({
                "approval_decision": "APPROVED",
                "message": "The manager has APPROVED the PR."
            }), role="assistant")]
        })
    else:
        return Command(goto=END, update={
            "messages": state["messages"] + [BaseMessage(content=json.dumps({
                "approval_decision": "REJECTED",
                "message": "The manager has REJECTED the PR."
            }), role="assistant")]
        })


def build_graph():
    tool_node = ToolNode(ALL_TOOLS)

    builder = StateGraph(AgentState)
    builder.add_node("agent", call_agent)
    builder.add_node("tools", tool_node)
    builder.add_node("approval_gate", approval_gate_node)
    builder.set_entry_point("agent")
    builder.add_conditional_edges("agent", should_continue)
    builder.add_conditional_edges("tools", route_after_tools, {"approval_gate": "approval_gate", "agent": "agent"})
    builder.add_edge("approval_gate", "agent")

    return builder.compile()


graph = build_graph()
