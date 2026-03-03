# PORT of apps/web/lib/agents/shopper-agent.ts
# Nodes: context → plan → execute → render → taste_update

from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from llm.provider import get_llm
from tools.graphql_tool import graphql_query, graphql_mutate
import operator, json, re


class ShopperState(TypedDict):
    messages: Annotated[list, operator.add]
    userId: str
    role: str
    token: str
    intent: str
    entities: dict
    userContext: dict
    plan: list[dict]
    toolCalls: Annotated[list, operator.add]
    uiComponents: Annotated[list, operator.add]
    pendingConfirms: list[dict]
    error: str | None


async def context_node(state: ShopperState) -> dict:
    try:
        result = await graphql_query(
            """
            query GetUserContext($userId: ID!) {
                userContext(userId: $userId) {
                    cart {
                        id total discount couponCode
                        items {
                            id productId quantity priceAt priceChanged
                            product { id name price stock }
                        }
                    }
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


async def plan_node(state: ShopperState) -> dict:
    llm = get_llm(temperature=0.1)
    msgs = state.get("messages", [])
    last = msgs[-1].get("content", "") if msgs else ""
    ctx = state.get("userContext", {})

    prompt = (
        "You are a shopping agent. Create a concise multi-step action plan.\n"
        "Mark each step type:\n"
        "  AUTO    = safe to execute without asking (searches, reads, cart adds)\n"
        "  CONFIRM = irreversible action — ONLY for: payment initiation\n\n"
        "Available tools:\n"
        "  graphql.query  = read data (products, cart, orders, userContext)\n"
        "  graphql.mutate = write data (addToCart, createOrder, etc.)\n\n"
        f"User context: cart_items={len((ctx.get('cart') or {}).get('items', []))}, "
        f"recent_orders={len(ctx.get('recentOrders', []))}\n"
        f"Intent: {state.get('intent', 'general')}\n"
        f"Entities: {json.dumps(state.get('entities', {}))}\n\n"
        "Return a JSON array only:\n"
        '[{"step":"description","tool":"graphql.query","type":"AUTO",'
        '"args":{"query":"GraphQL query string","variables":{}}}]'
    )

    try:
        resp = await llm.ainvoke(
            [{"role": "system", "content": prompt}, {"role": "user", "content": last}]
        )
        content = getattr(resp, "content", "") or ""
        match = re.search(r"\[.*\]", content, re.DOTALL)
        plan = json.loads(match.group()) if match else []
    except Exception:
        plan = []

    return {"plan": plan}


async def execute_node(state: ShopperState) -> dict:
    results = []
    confirms = []
    token = state.get("token", "")

    for step in state.get("plan", []):
        step_type = step.get("type", "AUTO")
        tool = step.get("tool", "")
        args = step.get("args", {})

        if step_type == "CONFIRM":
            confirms.append(step)
            continue

        try:
            if tool == "graphql.query":
                r = await graphql_query(
                    args.get(
                        "query", "{ products(limit:5) { items { id name price } } }"
                    ),
                    args.get("variables"),
                    token,
                )
            elif tool == "graphql.mutate":
                r = await graphql_mutate(
                    args.get("mutation", args.get("query", "")),
                    args.get("variables"),
                    token,
                )
            else:
                r = {}
            results.append({"tool": tool, "step": step.get("step", ""), "result": r})
        except Exception as e:
            results.append(
                {"tool": tool, "step": step.get("step", ""), "error": str(e)}
            )

    return {"toolCalls": results, "pendingConfirms": confirms}


async def render_node(state: ShopperState) -> dict:
    ui = []
    tc = state.get("toolCalls", [])
    raw = json.dumps(tc).lower()

    # ProductGrid — search results
    if "hybridsearch" in raw or ('"products"' in raw and '"items"' in raw):
        products = []
        for t in tc:
            d = (
                t.get("result", {}).get("data", {})
                if isinstance(t.get("result"), dict)
                else {}
            )
            if "hybridSearch" in d:
                products = d["hybridSearch"].get("results", [])
            elif "products" in d:
                products = d["products"].get("items", [])
        if products:
            ui.append({"component": "ProductGrid", "props": {"products": products}})

    # CartDrawer — cart mutations or cart queries
    if "addtocart" in raw or ("cart" in raw and "items" in raw):
        cart = state.get("userContext", {}).get("cart")
        if cart:
            ui.append({"component": "CartDrawer", "props": {"cart": cart}})

    # ActionConfirm — pending confirm steps
    if state.get("pendingConfirms"):
        ui.append(
            {
                "component": "ActionConfirm",
                "props": {"actions": state["pendingConfirms"]},
            }
        )

    # OrderTimeline — order status queries
    if "order" in raw and ("status" in raw or "timeline" in raw):
        for t in tc:
            order = (t.get("result", {}).get("data", {}) or {}).get("order")
            if order:
                ui.append({"component": "OrderTimeline", "props": {"order": order}})

    return {"uiComponents": ui}


async def taste_update_node(state: ShopperState) -> dict:
    # Phase 9 — taste vector update stub
    return {}


# TODO: switch to AsyncRedisSaver in production
try:
    from langgraph.checkpoint.redis import AsyncRedisSaver

    def get_checkpointer(redis_url: str):
        return AsyncRedisSaver.from_conn_string(redis_url)
except ImportError:
    from langgraph.checkpoint.memory import MemorySaver

    def get_checkpointer(redis_url: str):
        return MemorySaver()


async def create_shopper_subgraph(redis_url: str):
    builder = StateGraph(ShopperState)
    builder.add_node("context", context_node)
    builder.add_node("plan", plan_node)
    builder.add_node("execute", execute_node)
    builder.add_node("render", render_node)
    builder.add_node("taste_update", taste_update_node)
    builder.add_edge(START, "context")
    builder.add_edge("context", "plan")
    builder.add_edge("plan", "execute")
    builder.add_edge("execute", "render")
    builder.add_edge("render", "taste_update")
    builder.add_edge("taste_update", END)
    checkpointer = get_checkpointer(redis_url)
    return builder.compile(checkpointer=checkpointer)
