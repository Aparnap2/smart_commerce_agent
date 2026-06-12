import json
from typing import Annotated, TypedDict, Optional
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, ToolMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from loguru import logger
from .tools import ALL_TOOLS, get_tools_for_role


def strip_ui_from_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
    """
    Pattern 7: Avoid Context Failure - Strip __ui__ from tool results.
    
    The UI payload is for the frontend only — it should never re-enter 
    the LLM's context to avoid context confusion and token bloat.
    
    Also strips embedding vectors which add noise to context.
    """
    stripped = []
    for msg in messages:
        if isinstance(msg, ToolMessage) and msg.content:
            try:
                parsed = json.loads(msg.content)
                parsed.pop("__ui__", None)
                if "embedding" in parsed:
                    parsed.pop("embedding", None)
                if "products" in parsed and isinstance(parsed["products"], list):
                    for item in parsed["products"]:
                        if isinstance(item, dict):
                            item.pop("embedding", None)
                msg.content = json.dumps(parsed)
            except json.JSONDecodeError:
                pass
        stripped.append(msg)
    return stripped


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    user_role: Optional[str]
    step_count: int
    last_tool_result: Optional[dict]


def get_llm(role: Optional[str] = None):
    """Get LLM from singleton - initialized once at startup via dependencies.py"""
    from src.dependencies import get_llm as get_llm_singleton
    llm = get_llm_singleton()
    logger.debug(f"LLM from singleton: {llm.model_name}")
    
    if role:
        tools = get_tools_for_role(role)
        logger.debug(f"Role '{role}' filtered to {len(tools)} tools")
        return llm.bind_tools(tools)
    
    return llm.bind_tools(ALL_TOOLS)


SUPPORT_SYSTEM_PROMPT = """
You are SupportPilot, a Salesforce customer support agent.

## CORE RULES (follow these exactly)

### TOOL CALLING — THE ONLY WAY TO ACCESS DATA
You MUST call tools via function calling to answer all support queries.
Never fabricate data — always use the available tools.
Every tool call returns structured data; the system handles rendering.

### OUTPUT FORMAT — STRICT
Your response MUST be ONLY natural language text. RULES:
- NEVER output JSON, tool results, or raw data in your text
- NEVER include __ui__ payloads, metadata, or internal fields
- NEVER repeat or echo back the user's question
- NEVER include conversation summaries or system messages
- When tool results come back, synthesize them into clean prose
- If a tool returns an error, tell the user in natural language

### CASEWORK FLOW
1. DISCOVER — search_salesforce_cases → get_customer_context → search_knowledge_base
2. ANALYZE — review with search_similar_tickets → get_case_details
3. RESPOND — draft_case_reply / create_case / update_case
4. ESCALATE — escalate_case only if outside scope (TEAM_LEAD only)

### ROLE CAPABILITIES
- SUPPORT_AGENT: all tools except escalate
- TEAM_LEAD: all 9 tools including escalate
- SUPPORT_OPS: read-only (search, detail, context, kb, similar)
- ADMIN: all 9 tools

### RESPONSE STYLE
- Professional, concise, and clear
- Reference case numbers and status naturally
- Present data conversationally — the UI handles rich cards automatically
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
        SUPPORT_SYSTEM_PROMPT
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
    
    return {"messages": [SystemMessage(content=f"Earlier conversation summary: {summary_text}")]}


async def call_agent(state: AgentState):
    global llm
    user_role = state.get("user_role")
    if llm is None:
        llm = get_llm(role=user_role)
    elif user_role:
        llm = get_llm(role=user_role)

    user_email = state.get("user_id", "unknown")
    from src.dependencies import get_redis
    try:
        redis = get_redis()
        dept_id = await redis.get(f"user:{user_email}:dept") or "unknown"
    except Exception:
        dept_id = "unknown"

    system_msg = SystemMessage(content=build_system_prompt(user_email, dept_id))
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
                "role": state.get("user_role", "SUPPORT_AGENT"),
                "app": "supportpilot",
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


def load_context_node(state: AgentState):
    """Load user context at conversation start."""
    user_id = state.get("user_id")
    if not user_id:
        return state
    return state


def build_graph():
    tool_node = ToolNode(ALL_TOOLS)

    builder = StateGraph(AgentState)
    builder.add_node("load_context", load_context_node)
    builder.add_node("agent", call_agent)
    builder.add_node("tools", tool_node)
    builder.add_node("summarize", summarize_conversation)
    builder.set_entry_point("load_context")
    builder.add_edge("load_context", "agent")
    builder.add_conditional_edges("agent", should_continue)
    builder.add_edge("tools", "summarize")
    builder.add_edge("summarize", "agent")

    return builder.compile()


graph = build_graph()
