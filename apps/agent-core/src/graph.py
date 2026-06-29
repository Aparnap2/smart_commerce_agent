import json
from typing import Annotated, TypedDict, Optional, Any
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, ToolMessage, AIMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt, Command
from langgraph.runtime import Runtime
from langchain_core.runnables import RunnableConfig
from loguru import logger
from langfuse import observe, get_client
from .tools import ALL_TOOLS, get_tools_for_role
from .support.tools import proactive_scan


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
    requires_approval: Optional[bool]
    approval_context: Optional[dict]
    # Proactive fix fields
    pending_fix_actions: Optional[list[dict]]      # List of fix actions awaiting approval
    pending_fix_case_id: Optional[str]              # Case ID for pending fix actions


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
3. RESPOND — draft_case_reply / create_case / update_case / send_case_reply
4. ESCALATE — escalate_case only if outside scope (TEAM_LEAD only)

### HUMAN-IN-THE-LOOP (HITL)
Some actions require manager approval before execution:
- Escalating a case (escalate_case)
- Sending an external reply (send_case_reply)
- Executing approved fixes (approve_fix — ADMIN/TEAM_LEAD only)
When these tools return requiresApproval: true, the system will pause
and present an approval card to the team lead. The agent should inform
the user that the action is pending approval.

### PROACTIVE SCAN — AUTO-DETECT ISSUES
On conversation start, the system automatically runs proactive_scan
to detect stale/SLA-risk cases for the user's department. The scan
results will appear as a dashboard card showing:
- Open cases approaching SLA breach
- Escalated cases needing attention
- Cases with no recent activity
The agent should reference the scan results when advising the user.

### APPROVE FIX — EXECUTE APPROVED ACTIONS
When a team lead approves a fix via the UI, the system routes through
the execute_fix node which dispatches each fix action to the appropriate
tool function:
- update_case: updates case fields
- send_case_reply: sends reply to customer
- escalate_case: escalates to next tier
The agent should inform the user when actions are being executed.

### ROLE CAPABILITIES
- SUPPORT_AGENT: all tools except escalate + approve_fix
- TEAM_LEAD: all tools including escalate + approve_fix
- SUPPORT_OPS: read-only (search, detail, context, kb, similar) + proactive_scan
- ADMIN: all tools including escalate + approve_fix
- EMPLOYEE: read-only + proactive_scan

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


@observe(as_type="generation")
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
    try:
        summary_response = await llm.ainvoke([
            HumanMessage(content=summary_prompt)
        ])
    except Exception as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={"function": "summarize_conversation", "error": True},
        )
        raise
    
    summary_text = summary_response.content if hasattr(summary_response, "content") else str(summary_response)
    
    get_client().update_current_generation(
        input={"message_count": len(messages)},
        output={"summary_length": len(summary_text)},
        metadata={
            "function": "summarize_conversation",
            "userId": state.get("user_id", "unknown"),
            "role": state.get("user_role", "unknown"),
            "step_count": state.get("step_count", 0),
        },
    )
    
    logger.info(f"Summarized {len(messages)} messages into: {summary_text[:100]}...")
    
    return {"messages": [SystemMessage(content=f"Earlier conversation summary: {summary_text}")]}


@observe(as_type="generation")
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

    logger.debug(f"call_agent: user_role={user_role}, model={llm.model_name}, tools on llm={getattr(llm, 'tools', 'N/A')}")

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
    try:
        response = await llm.ainvoke(messages, config=config)
    except Exception as e:
        get_client().update_current_generation(
            level="ERROR",
            status_message=str(e),
            metadata={
                "function": "call_agent",
                "userId": user_email,
                "role": user_role or "SUPPORT_AGENT",
                "error": True,
            },
        )
        raise

    get_client().update_current_generation(
        input={"message_count": len(messages)},
        output={"has_tool_calls": bool(getattr(response, "tool_calls", None))},
        metadata={
            "function": "call_agent",
            "userId": user_email,
            "role": user_role or "SUPPORT_AGENT",
            "step_count": state.get("step_count", 0) + 1,
            "department_id": dept_id,
        },
    )

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


def check_approval_needed(state: AgentState) -> str:
    """Route after tools: if approval required → approval_gate, else summarize."""
    if state.get("requires_approval"):
        return "approval_gate"
    return "summarize"


def approval_gate_node(state: AgentState) -> dict:
    """HITL node — pauses execution and presents approval card to team lead.

    Uses langgraph interrupt() to freeze the graph. The approval decision
    is delivered back via Command(resume="APPROVED" | "REJECTED").
    """
    approval_ctx = state.get("approval_context") or {}
    case_id = approval_ctx.get("case_id", "unknown")
    reason = approval_ctx.get("reason", "")
    action_type = approval_ctx.get("action_type", "escalation")

    logger.info(f"HITL interrupt: {action_type} for case {case_id}")

    decision = interrupt({
        "type": "approval_required",
        "action_type": action_type,
        "case_id": case_id,
        "reason": reason,
        "message": f"Approval required for {action_type} on case {case_id}. Reason: {reason}",
    })

    logger.info(f"HITL decision received: {decision}")

    return {
        "requires_approval": False,
        "approval_context": None,
        "messages": [
            SystemMessage(
                content=f"Human decision received: {decision}. "
                f"{'The action has been approved. Proceed with the action.' if decision == 'APPROVED' else 'The action was rejected. Inform the user and suggest alternatives.'}"
            )
        ],
    }


def load_context_node(state: AgentState):
    """Load user context at conversation start."""
    user_id = state.get("user_id")
    if not user_id:
        return state
    return state


def check_approval_node(state: AgentState) -> dict:
    """Inspect tool results for requiresApproval flag.

    When escalate_case or send_case_reply returns requiresApproval: true,
    this node sets the flag so the graph routes to approval_gate instead
    of summarizing.
    """
    messages = state.get("messages", [])
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage) and msg.content:
            try:
                parsed = json.loads(msg.content)
                if parsed.get("requiresApproval"):
                    ui_props = parsed.get("__ui__", {}).get("props", {})
                    escalation = ui_props.get("escalation", {})
                    return {
                        "requires_approval": True,
                        "approval_context": {
                            "case_id": escalation.get("caseId", "unknown"),
                            "reason": escalation.get("reason", ""),
                            "action_type": "escalation",
                        },
                    }
            except (json.JSONDecodeError, AttributeError):
                pass
    return {}


class RoleAwareToolNode(ToolNode):
    """ToolNode that enforces role-based access control on tool execution.

    Reads the user_role from AgentState and filters tool calls to only
    allow tools appropriate for that role using get_tools_for_role().
    Blocked tool calls are logged as security warnings and return error
    ToolMessages — providing defense-in-depth beyond LLM-level bind_tools().

    Role mappings (defined in tools.py via get_tools_for_role()):
        - SUPPORT_AGENT: all tools except escalate_case (9 tools)
        - TEAM_LEAD: all 10 tools including escalate + reply
        - SUPPORT_OPS: read-only (search, detail, context, kb, similar)
        - ADMIN: all 10 tools
    """

    def __init__(self) -> None:
        """Initialize with ALL_TOOLS; role filtering happens at runtime."""
        super().__init__(ALL_TOOLS)

    def _get_role_allowed_names(self, state: dict) -> set[str]:
        """Get set of tool names permitted for the user's role.

        Falls back to empty set (no tools allowed) when role is unknown
        or missing, ensuring a compromised LLM can't escalate privileges.
        """
        user_role = state.get("user_role", "")
        allowed_tools = get_tools_for_role(user_role)
        return {t.name for t in allowed_tools}

    def _func(
        self,
        input: list | dict | Any,
        config: RunnableConfig,
        runtime: Runtime,
    ) -> Any:
        """Synchronous tool execution with role-based filtering."""
        all_tool_calls, input_type = self._parse_input(input)

        # Determine role-based permissions from state
        state = input if isinstance(input, dict) else {}
        allowed_names = self._get_role_allowed_names(state)
        user_role = state.get("user_role", "unknown")

        # Separate calls into allowed and blocked sets
        allowed_calls = [tc for tc in all_tool_calls if tc["name"] in allowed_names]
        blocked_calls = [tc for tc in all_tool_calls if tc["name"] not in allowed_names]

        # Log security warning for every blocked call — this is the audit trail
        if blocked_calls:
            logger.warning(
                f"SECURITY: Blocked {len(blocked_calls)} tool call(s) "
                f"for role '{user_role}': {[bc['name'] for bc in blocked_calls]}"
            )

        # Build error ToolMessages for blocked calls
        error_outputs: list = []
        for tc in blocked_calls:
            error_outputs.append(
                ToolMessage(
                    content=json.dumps({
                        "error": (
                            f"Tool '{tc['name']}' is not permitted "
                            f"for role '{user_role}'."
                        ),
                        "tool_name": tc["name"],
                        "blocked_by_role": True,
                    }),
                    name=tc["name"],
                    tool_call_id=tc["id"],
                    status="error",
                )
            )

        # If all calls were blocked, return just the errors
        if not allowed_calls:
            if input_type == "list":
                return error_outputs
            return {self._messages_key: error_outputs}

        # Execute only the allowed calls via parent logic
        # We temporarily swap the AIMessage's tool_calls so the parent
        # _func only processes permitted tools, then restore.
        messages = input.get(self._messages_key, [])
        original_ai_msg = next(
            m for m in reversed(messages) if isinstance(m, AIMessage)
        )
        original_tool_calls = original_ai_msg.tool_calls
        original_ai_msg.tool_calls = allowed_calls

        try:
            result = super()._func(input, config, runtime)
        finally:
            original_ai_msg.tool_calls = original_tool_calls

        # Prepend error messages so the LLM sees role violations immediately
        if input_type == "list":
            return error_outputs + result

        existing_msgs = result.get(self._messages_key, [])
        result[self._messages_key] = error_outputs + existing_msgs
        return result

    async def _afunc(
        self,
        input: list | dict | Any,
        config: RunnableConfig,
        runtime: Runtime,
    ) -> Any:
        """Asynchronous tool execution with role-based filtering."""
        all_tool_calls, input_type = self._parse_input(input)

        state = input if isinstance(input, dict) else {}
        allowed_names = self._get_role_allowed_names(state)
        user_role = state.get("user_role", "unknown")

        allowed_calls = [tc for tc in all_tool_calls if tc["name"] in allowed_names]
        blocked_calls = [tc for tc in all_tool_calls if tc["name"] not in allowed_names]

        if blocked_calls:
            logger.warning(
                f"SECURITY: Blocked {len(blocked_calls)} tool call(s) "
                f"for role '{user_role}': {[bc['name'] for bc in blocked_calls]}"
            )

        error_outputs: list = []
        for tc in blocked_calls:
            error_outputs.append(
                ToolMessage(
                    content=json.dumps({
                        "error": (
                            f"Tool '{tc['name']}' is not permitted "
                            f"for role '{user_role}'."
                        ),
                        "tool_name": tc["name"],
                        "blocked_by_role": True,
                    }),
                    name=tc["name"],
                    tool_call_id=tc["id"],
                    status="error",
                )
            )

        if not allowed_calls:
            if input_type == "list":
                return error_outputs
            return {self._messages_key: error_outputs}

        messages = input.get(self._messages_key, [])
        original_ai_msg = next(
            m for m in reversed(messages) if isinstance(m, AIMessage)
        )
        original_tool_calls = original_ai_msg.tool_calls
        original_ai_msg.tool_calls = allowed_calls

        try:
            result = await super()._afunc(input, config, runtime)
        finally:
            original_ai_msg.tool_calls = original_tool_calls

        if input_type == "list":
            return error_outputs + result

        existing_msgs = result.get(self._messages_key, [])
        result[self._messages_key] = error_outputs + existing_msgs
        return result


async def proactive_scan_node(state: AgentState) -> dict:
    """Run proactive scan on conversation start for the user's department.

    Executes the proactive_scan tool and injects scan results into the
    message stream so the agent can reference them in its first response.
    """
    user_id = state.get("user_id", "")
    if not user_id:
        logger.debug("No user_id — skipping proactive_scan_node")
        return {}

    from src.dependencies import get_redis
    try:
        redis = get_redis()
        dept_id = await redis.get(f"user:{user_id}:dept") or "unknown"
    except Exception:
        dept_id = "unknown"

    logger.info(f"Running proactive_scan for user={user_id} dept={dept_id}")

    try:
        result = await proactive_scan.ainvoke({"department_id": dept_id})
        # result is already a JSON string (proactive_scan returns json.dumps(...))
        content = result if isinstance(result, str) else json.dumps(result)
        tool_msg = ToolMessage(
            content=content,
            name="proactive_scan",
            tool_call_id="proactive_scan_auto",
        )
        return {"messages": [tool_msg]}
    except Exception as e:
        logger.error(f"proactive_scan failed: {e}")
        return {}


async def execute_fix_node(state: AgentState) -> dict:
    """Execute approved fix actions by dispatching to corresponding tools.

    Called when a team lead approves fix actions via the HITL approval
    gate. Each action in pending_fix_actions is dispatched to the
    appropriate tool function, and results are collected as ToolMessages.
    """
    actions = state.get("pending_fix_actions") or []
    if not actions:
        logger.debug("No pending fix actions — skipping execute_fix_node")
        return {}

    case_id = state.get("pending_fix_case_id", "unknown")
    logger.info(f"Executing {len(actions)} fix actions for case {case_id}")

    from .support import (
        update_case as update_case_tool,
        send_case_reply as send_reply_tool,
        escalate_case as escalate_case_tool,
    )

    tool_map = {
        "update_case": update_case_tool,
        "send_case_reply": send_reply_tool,
        "escalate_case": escalate_case_tool,
    }

    result_messages = []
    for i, action in enumerate(actions):
        action_type = action.get("action", "update_case")
        params = action.get("params", {})

        tool_fn = tool_map.get(action_type)
        if not tool_fn:
            logger.warning(f"Unknown fix action type: {action_type}")
            result_messages.append(
                ToolMessage(
                    content=json.dumps({
                        "status": "skipped",
                        "action": action_type,
                        "error": f"Unknown action type: {action_type}",
                    }),
                    name="execute_fix",
                    tool_call_id=f"fix_action_{i}",
                )
            )
            continue

        try:
            logger.info(f"Executing fix action: {action_type} params={params}")
            result = await tool_fn.ainvoke(params)
            result_messages.append(
                ToolMessage(
                    content=json.dumps({
                        "status": "success",
                        "action": action_type,
                        "result": result,
                    }),
                    name="execute_fix",
                    tool_call_id=f"fix_action_{i}",
                )
            )
        except Exception as e:
            logger.error(f"Fix action {action_type} failed: {e}")
            result_messages.append(
                ToolMessage(
                    content=json.dumps({
                        "status": "error",
                        "action": action_type,
                        "error": str(e),
                    }),
                    name="execute_fix",
                    tool_call_id=f"fix_action_{i}",
                    status="error",
                )
            )

    return {
        "messages": result_messages,
        "pending_fix_actions": None,
        "pending_fix_case_id": None,
    }


def route_after_proactive_scan(state: AgentState) -> str:
    """After proactive scan, always route to the agent node."""
    return "agent"


def route_after_approval_gate(state: AgentState) -> str:
    """After approval gate, route based on decision.

    If the approval was for fix actions (pending_fix_actions is set),
    route to execute_fix. Otherwise route back to agent.
    """
    if state.get("pending_fix_actions"):
        return "execute_fix"
    return "agent"


def route_after_execute_fix(state: AgentState) -> str:
    """After executing fix actions, route back to agent for summary."""
    return "agent"


def build_graph():
    tool_node = RoleAwareToolNode()

    builder = StateGraph(AgentState)
    builder.add_node("proactive_scan", proactive_scan_node)
    builder.add_node("agent", call_agent)
    builder.add_node("tools", tool_node)
    builder.add_node("check_approval", check_approval_node)
    builder.add_node("approval_gate", approval_gate_node)
    builder.add_node("execute_fix", execute_fix_node)
    builder.add_node("summarize", summarize_conversation)

    # Entry: proactive_scan → agent
    builder.set_entry_point("proactive_scan")
    builder.add_conditional_edges("proactive_scan", route_after_proactive_scan)

    # Main loop: agent → tools → check_approval
    builder.add_conditional_edges("agent", should_continue)
    builder.add_edge("tools", "check_approval")

    # After tools: check if approval needed
    builder.add_conditional_edges("check_approval", check_approval_needed)

    # HITL: approval_gate routes based on fix vs escalation
    builder.add_conditional_edges("approval_gate", route_after_approval_gate)

    # Fix execution: after fix, back to agent for summary
    builder.add_conditional_edges("execute_fix", route_after_execute_fix)

    # Summarize then back to agent
    builder.add_edge("summarize", "agent")

    return builder.compile()


graph = build_graph()
