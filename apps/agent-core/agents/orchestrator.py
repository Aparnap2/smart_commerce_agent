# PORT of apps/web/lib/agents/supervisor.ts

from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated, Literal
from nodes.classify import classify_intent
from agents.shopper_agent import create_shopper_subgraph
from agents.support_agent import create_support_subgraph
from llm.provider import get_llm
import operator, os

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")


class OrchestratorState(TypedDict):
    messages: Annotated[list, operator.add]
    userId: str
    role: str
    token: str
    intent: str | None
    entities: dict
    sentiment: str
    confidence: float
    uiComponents: Annotated[list, operator.add]
    error: str | None


SHOPPER_INTENTS = {
    "product_search",
    "cart_add",
    "cart_update",
    "cart_remove",
    "cart_view",
    "checkout",
    "payment",
    "order_status",
    "order_history",
    "recommendation",
}
SUPPORT_INTENTS = {"refund_request", "support", "order_cancel"}


def route_by_intent(
    state: OrchestratorState,
) -> Literal["shopper_agent", "support_agent", "general_response"]:
    intent = state.get("intent") or "general"
    if intent in SHOPPER_INTENTS:
        return "shopper_agent"
    if intent in SUPPORT_INTENTS:
        return "support_agent"
    return "general_response"


async def general_response_node(state: OrchestratorState) -> dict:
    llm = get_llm()
    msgs = [{"role": "system", "content": "You are a helpful commerce assistant."}]
    msgs += [m for m in state.get("messages", []) if isinstance(m, dict)]
    resp = await llm.ainvoke(msgs)
    return {
        "messages": [{"role": "assistant", "content": getattr(resp, "content", "")}]
    }


_graph = None


async def create_orchestrator():
    global _graph
    if _graph is not None:
        return _graph
    shopper = await create_shopper_subgraph(REDIS_URL)
    support = await create_support_subgraph(REDIS_URL)
    builder = StateGraph(OrchestratorState)
    builder.add_node("classify", classify_intent)
    builder.add_node("shopper_agent", shopper)
    builder.add_node("support_agent", support)
    builder.add_node("general_response", general_response_node)
    builder.add_edge(START, "classify")
    builder.add_conditional_edges(
        "classify",
        route_by_intent,
        {
            "shopper_agent": "shopper_agent",
            "support_agent": "support_agent",
            "general_response": "general_response",
        },
    )
    builder.add_edge("shopper_agent", END)
    builder.add_edge("support_agent", END)
    builder.add_edge("general_response", END)
    _graph = builder.compile()
    return _graph
