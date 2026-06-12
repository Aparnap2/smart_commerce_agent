import os
import json
from typing import Annotated, TypedDict, Optional, Literal
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt, Command
from loguru import logger
from .tools import ALL_TOOLS, get_tools_for_role

logger.add(
    "/tmp/agent.log",
    rotation="10 MB",
    level="DEBUG",
    format="<green>{time:HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
)


def strip_ui_from_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
    """
    Pattern 7: Avoid Context Failure - Strip __ui__ from tool results.
    
    The UI payload is for the frontend only - it should never re-enter 
    the LLM's context to avoid context confusion and token bloat.
    
    Also strips embedding vectors which add noise to context.
    """
    stripped = []
    for msg in messages:
        # Only process ToolMessage with JSON content
        if isinstance(msg, ToolMessage) and msg.content:
            try:
                parsed = json.loads(msg.content)
                # Remove __ui__ (frontend only)
                parsed.pop("__ui__", None)
                # Remove embedding (not needed by LLM, saves tokens)
                if "embedding" in parsed:
                    parsed.pop("embedding", None)
                # Also clean any nested embeddings in product arrays
                if "products" in parsed and isinstance(parsed["products"], list):
                    for item in parsed["products"]:
                        if isinstance(item, dict):
                            item.pop("embedding", None)
                msg.content = json.dumps(parsed)
            except json.JSONDecodeError:
                # Non-JSON content, leave as-is
                pass
        stripped.append(msg)
    return stripped


def should_compress_context(messages: list[BaseMessage]) -> bool:
    """
    Pattern 8: Compress Context - check if context should be compressed.
    
    After submit_for_approval is called, the search-and-build history
    is no longer needed. Summarize it to reduce context noise.
    
    Args:
        messages: List of messages in the conversation
        
    Returns:
        True if submit_for_approval was called (context should be compressed)
    """
    for msg in messages:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                if tc.get("name") == "submit_for_approval":
                    return True
    return False


def create_context_summary(messages: list[BaseMessage]) -> str:
    """
    Create a concise summary of the conversation after PR submission.
    
    Replaces verbose tool message history with a single summary.
    
    Args:
        messages: List of messages in the conversation
        
    Returns:
        Summary string describing what was done
    """
    pr_number = None
    total_amount = 0
    item_count = 0
    requestor = "unknown"
    
    # Extract key info from tool results
    for msg in messages:
        if isinstance(msg, ToolMessage):
            try:
                content = json.loads(msg.content)
                if content.get("prId"):
                    pr_number = content.get("prId")
                if content.get("total"):
                    total_amount = content.get("total", 0)
                if content.get("items"):
                    item_count = len(content.get("items", []))
                if content.get("requestor"):
                    requestor = content.get("requestor")
            except (json.JSONDecodeError, AttributeError):
                pass
    
    # Also check tool calls for the requestor
    for msg in messages:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                cfg = tc.get("args", {}).get("config", {})
                if cfg and isinstance(cfg, dict):
                    user_id = cfg.get("configurable", {}).get("user_id")
                    if user_id:
                        requestor = user_id
    
    if pr_number:
        amount_str = f"₹{total_amount/100:.2f}" if total_amount else "amount TBD"
        summary = f"[CONVERSATION SUMMARIZED] Employee {requestor} created PR {pr_number} with {item_count} item(s), total {amount_str}. Submitted for approval."
    else:
        summary = "[CONVERSATION SUMMARIZED] Purchase request submitted for approval."
    
    return summary


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    user_role: Optional[str]
    step_count: int
    # B2B fields
    pending_pr_id: Optional[str]
    pending_pr_number: Optional[str]
    pending_pr_total: Optional[int]
    pending_pr_requestor: Optional[str]
    pending_pr_items: Optional[list]
    awaiting_approval: bool
    last_tool_result: Optional[dict]


def get_llm(role: Optional[str] = None):
    """Get LLM from singleton - initialized once at startup via dependencies.py
    
    Args:
        role: Optional role for dynamic tool filtering. If None, uses ALL_TOOLS.
    """
    from src.dependencies import get_llm as get_llm_singleton
    llm = get_llm_singleton()
    logger.debug(f"LLM from singleton: {llm.model_name}")
    
    # Pattern 3: Dynamic Agents - filter tools by role
    if role:
        tools = get_tools_for_role(role)
        logger.debug(f"Role '{role}' filtered to {len(tools)} tools")
        return llm.bind_tools(tools)
    
    return llm.bind_tools(ALL_TOOLS)


SYSTEM_PROMPT_STATIC = """
You are ProcureAI, a B2B procurement assistant for enterprise purchasing.

## CORE RULES
- Always respond with tool calls, never plain text (unless explicitly asked)
- Use the available tools to fulfill user requests
- Prioritize budget awareness - check budget before large purchases
- Maintain audit trail for all procurement actions

## TOOL ROUTING RULES

### search_catalog
Use when user wants to:
- Browse products, items, catalog
- Search for specific items (laptop, monitor, software)
- See available products with prices
- ANY product discovery request
Arguments: {"query": "search terms", "category": "HARDWARE|SOFTWARE|SERVICES|..."}

### get_purchase_requests
Use when user wants to:
- View their purchase requests
- See PR history, status
- List draft/submitted/approved PRs
Arguments: {"status_filter": "DRAFT|SUBMITTED|APPROVED|REJECTED", "limit": 5}

### manage_purchase_request
Use when user wants to:
- Create new PR
- Add items to existing PR
- Submit PR for approval
- Cancel/delete PR
Actions: create, add_item, submit, view, remove_item

### get_budget_status
Use when user wants to:
- Check department budget
- See remaining funds
- Understand spending limits

## PRODUCT SEARCH STRATEGY
1. Always call search_catalog first for any product request.
2. If catalog returns 0 results OR employee explicitly asks to compare prices:
   → Call compare_market_price to fetch live market data via Google Shopping.
3. Present market results via the price-comparison GenUI component.
4. Inform the employee that off-catalog items require a vendor sourcing request
   before a PR can be raised.
5. Never tell the employee "I only have a limited catalog" — always search the market.

## APPROVAL WORKFLOW
1. Create PR with justification
2. Add items (budget check happens automatically)
3. Submit for manager approval
4. Wait for approval before processing

## RESPONSE STYLE
- Be concise and action-oriented
- Confirm tool results in user-friendly language
- Always explain what happened after tool execution
""".strip()

SUPPORT_SYSTEM_PROMPT = """
## SupportPilot — Salesforce Customer Support

You have access to Salesforce case management tools. You can:

### Case Search & Context
- SEARCH CASES: Find cases by customer name, case number, subject, status, or priority
- GET CASE DETAILS: View full case information including description, account, contact
- GET CUSTOMER CONTEXT: View account details, contact info, open cases, and recent interactions

### Knowledge & Similar Cases
- SEARCH KNOWLEDGE BASE: Find internal support articles and documentation
- SEARCH SIMILAR TICKETS: Find past resolved cases similar to the current issue

### Draft & Respond
- DRAFT CASE REPLY: Generate an AI-suggested reply grounded in case data and KB context
  - Supports tones: professional, empathetic, urgent
  - The draft is editable by the human before sending

### Case Management (Creates & Updates)
- CREATE CASE: Create a new case with subject, description, priority, and account
- UPDATE CASE: Update case status, priority, description, owner, and other fields

### Escalation
- ESCALATE CASE: Escalate a case for team lead approval (requires reason and requested action)
  - Creates an escalation request that a team lead must approve
  - Use when: case requires urgent attention, needs reassignment, or sensitive customer situation

### Guidelines
- Always search cases first before creating duplicates
- Fetch customer context to personalize responses
- Reference KB articles in replies when available
- Escalate only when necessary (security issues, VIP customers, unresolved escalations)
- For the /support workspace, prefer support tools over procurement tools
""".strip()

SYSTEM_PROMPT_DYNAMIC = """
Current session context (append at end, NOT cached):
- User: {user_email}
- Department ID: {dept_id}
- Current date: {date}
"""


def build_system_prompt(user_email: str, dept_id: str) -> str:
    from datetime import datetime
    return (
        SYSTEM_PROMPT_STATIC
        + "\n\n"
        + SUPPORT_SYSTEM_PROMPT
        + "\n\n"
        + SYSTEM_PROMPT_DYNAMIC.format(
            user_email=user_email,
            dept_id=dept_id,
            date=datetime.now().strftime("%Y-%m-%d"),
        )
    )


llm = None
_llm_base = None


def get_llm_base():
    """Get base LLM (without tools) for summarization."""
    global _llm_base
    if _llm_base is None:
        from src.dependencies import get_llm as get_llm_singleton
        _llm_base = get_llm_singleton()
        logger.debug(f"Base LLM from singleton: {_llm_base.model_name}")
    return _llm_base


async def summarize_conversation(state: AgentState) -> dict:
    """Summarize conversation when 5+ messages exist (after tools execute)."""
    messages = state.get("messages", [])
    
    if len(messages) < 6:
        return {}
    
    last_4 = messages[-4:]
    msg_texts = []
    for msg in last_4:
        role = getattr(msg, "role", "unknown")
        content = getattr(msg, "content", "")
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            content += f" [tools: {[tc.get('name') for tc in msg.tool_calls]}]"
        msg_texts.append(f"{role}: {content}")
    
    summary_prompt = f"""Summarize the following conversation in exactly 3 sentences:
---
{chr(10).join(msg_texts)}
---
Summary (3 sentences only):"""
    
    llm = get_llm_base()
    summary_response = await llm.ainvoke([
        HumanMessage(content=summary_prompt)
    ])
    
    summary_text = summary_response.content if hasattr(summary_response, "content") else str(summary_response)
    
    logger.info(f"Summarized {len(messages)} messages into: {summary_text[:100]}...")
    
    return {"messages": [SystemMessage(content=f"[CONVERSATION SUMMARY: {summary_text}]")]}


async def call_agent(state: AgentState):
    global llm
    # Pattern 3: Dynamic Agents - pass role for role-specific tools
    user_role = state.get("user_role")
    if llm is None:
        llm = get_llm(role=user_role)
    elif user_role:
        # Re-bind tools if role changed (e.g., after login)
        llm = get_llm(role=user_role)

    user_email = state.get("user_id", "unknown")
    from src.dependencies import get_redis
    try:
        redis = get_redis()
        dept_id = await redis.get(f"user:{user_email}:dept") or "unknown"
    except Exception:
        dept_id = "unknown"

    system_msg = SystemMessage(content=build_system_prompt(user_email, dept_id))

    # Pattern 7: Strip __ui__ from tool results before LLM context
    clean_messages = strip_ui_from_messages(state["messages"])
    
    messages = [
        system_msg,
        *clean_messages,
    ]

    from langchain_core.runnables import RunnableConfig
    config = RunnableConfig(
        configurable={
            "metadata": {
                "department_id": dept_id,
                "role": state.get("user_role", "EMPLOYEE"),
                "app": "procureai",
            }
        }
    )
    response = await llm.ainvoke(messages, config=config)

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


def load_context_node(state: AgentState):
    """Load user's procurement context at conversation start."""
    import asyncpg
    from src.dependencies import get_pool

    user_id = state.get("user_id")
    if not user_id:
        return state

    async def _load():
        pool = get_pool()
        async with pool.acquire() as conn:
            # Get user's current draft PR
            draft_pr = await conn.fetchrow("""
                SELECT id, "prNumber", "totalAmount", "status"
                FROM "PurchaseRequest"
                WHERE "requestorId"=$1 AND status='DRAFT'
                ORDER BY "createdAt" DESC LIMIT 1
            """, user_id)

            # Get department budget status
            dept_budget = await conn.fetchrow("""
                SELECT d.id, d.name, d."monthlyBudget", d."spentThisMonth"
                FROM "User" u
                JOIN "Department" d ON d.id = u."departmentId"
                WHERE u.id = $1
            """, user_id)

            updates = {}
            if draft_pr:
                updates["pending_pr_id"] = draft_pr["id"]
                updates["pending_pr_number"] = draft_pr["prNumber"]
                updates["pending_pr_total"] = draft_pr["totalAmount"]

                items = await conn.fetch("""
                    SELECT li.quantity, li."totalPrice", ci.name
                    FROM "PRLineItem" li
                    JOIN "CatalogItem" ci ON ci.id = li."catalogItemId"
                    WHERE li."prId" = $1
                """, draft_pr["id"])
                updates["pending_pr_items"] = [dict(i) for i in items]

            if dept_budget:
                updates["__context__"] = {
                    "department": {"name": dept_budget["name"], "budget": dept_budget["monthlyBudget"]},
                    "spent": dept_budget["spentThisMonth"],
                    "remaining": dept_budget["monthlyBudget"] - dept_budget["spentThisMonth"]
                }

            return updates

    # Note: In production, this would be run in graph. For now, we just return state.
    # Context will be loaded via first tool call if needed.
    return state


def build_graph():
    tool_node = ToolNode(ALL_TOOLS)

    builder = StateGraph(AgentState)
    builder.add_node("load_context", load_context_node)
    builder.add_node("agent", call_agent)
    builder.add_node("tools", tool_node)
    builder.add_node("summarize", summarize_conversation)
    builder.add_node("approval_gate", approval_gate_node)
    builder.set_entry_point("load_context")
    builder.add_edge("load_context", "agent")
    builder.add_conditional_edges("agent", should_continue)
    builder.add_edge("tools", "summarize")
    builder.add_edge("summarize", "agent")
    builder.add_conditional_edges("tools", route_after_tools, {"approval_gate": "approval_gate", "agent": "summarize"})

    return builder.compile()


graph = build_graph()
