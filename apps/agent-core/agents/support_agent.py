# PORT of apps/web/lib/agents/support-agent.ts
# Nodes: context → policy_rag → decision → render

from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from llm.provider import get_llm
from tools.graphql_tool import graphql_query
import operator, json, re


class SupportState(TypedDict):
    messages: Annotated[list, operator.add]
    userId: str
    role: str
    token: str
    intent: str
    userContext: dict
    policyContext: str
    decision: str | None
    fraudScore: float
    uiComponents: Annotated[list, operator.add]
    error: str | None


async def support_context_node(state: SupportState) -> dict:
    try:
        result = await graphql_query(
            """
            query SupportContext($userId: ID!) {
                userContext(userId: $userId) {
                    recentOrders { id status total createdAt }
                    pendingNotifications { id type payload read }
                }
            }
        """,
            variables={"userId": state["userId"]},
            token=state.get("token", ""),
        )
        ctx = result.get("data", {}).get("userContext", {})
        return {"userContext": ctx}
    except Exception as e:
        return {"userContext": {}, "error": str(e)}


async def policy_rag_node(state: SupportState) -> dict:
    try:
        result = await graphql_query(
            """
            query PolicySearch($q: String!) {
                hybridSearch(query: $q, limit: 3) {
                    results { id name description }
                }
            }
        """,
            variables={"q": "return policy refund shipping warranty"},
            token=state.get("token", ""),
        )
        docs = result.get("data", {}).get("hybridSearch", {}).get("results", [])
        policy = "\n".join(
            d.get("description", "") for d in docs if d.get("description")
        )
        return {"policyContext": policy or "Standard 30-day return policy applies."}
    except Exception:
        return {"policyContext": "Standard 30-day return policy applies."}


async def decision_node(state: SupportState) -> dict:
    llm = get_llm(temperature=0)
    msgs = state.get("messages", [])
    last = msgs[-1].get("content", "") if msgs else ""

    try:
        resp = await llm.ainvoke(
            [
                {
                    "role": "system",
                    "content": (
                        "You are a support decision agent.\n"
                        "Based on the request, policy, and order history, decide:\n"
                        "  auto_approve = clear policy match, order exists, low risk\n"
                        "  pending      = needs human review, high value, ambiguous\n"
                        "  denied       = clearly outside policy\n\n"
                        "Return ONLY JSON:\n"
                        '{"decision":"auto_approve|pending|denied",'
                        '"reason":"brief explanation","fraudScore":0.0}'
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Request: {last}\n"
                        f"Policy:  {state.get('policyContext', '')}\n"
                        f"Orders:  {json.dumps(state.get('userContext', {}).get('recentOrders', []))}"
                    ),
                },
            ]
        )
        content = getattr(resp, "content", "") or ""
        match = re.search(r'\{[^{}]*"decision"[^{}]*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return {
                "decision": data.get("decision", "pending"),
                "fraudScore": float(data.get("fraudScore", 0.5)),
            }
    except Exception:
        pass

    return {"decision": "pending", "fraudScore": 0.5}


async def render_support_node(state: SupportState) -> dict:
    decision = state.get("decision", "pending")
    component_map = {
        "auto_approve": "RefundApproved",
        "denied": "RefundDenied",
        "pending": "RefundPending",
    }
    component = component_map.get(decision, "RefundPending")
    return {"uiComponents": [{"component": component, "props": {}}]}


# TODO: switch to AsyncRedisSaver in production
try:
    from langgraph.checkpoint.redis import AsyncRedisSaver

    def get_support_checkpointer(redis_url: str):
        return AsyncRedisSaver.from_conn_string(redis_url)
except ImportError:
    from langgraph.checkpoint.memory import MemorySaver

    def get_support_checkpointer(redis_url: str):
        return MemorySaver()


async def create_support_subgraph(redis_url: str):
    builder = StateGraph(SupportState)
    builder.add_node("context", support_context_node)
    builder.add_node("policy_rag", policy_rag_node)
    builder.add_node("decision", decision_node)
    builder.add_node("render", render_support_node)
    builder.add_edge(START, "context")
    builder.add_edge("context", "policy_rag")
    builder.add_edge("policy_rag", "decision")
    builder.add_edge("decision", "render")
    builder.add_edge("render", END)
    checkpointer = get_support_checkpointer(redis_url)
    return builder.compile(checkpointer=checkpointer)
