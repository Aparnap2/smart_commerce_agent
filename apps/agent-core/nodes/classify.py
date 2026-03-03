# PORT of apps/web/lib/agents/nodes/classify.ts
# Same 14 intents. Same keyword fallback. Same gpt-oss-120b handling.

from llm.provider import get_llm
import json, re, os

VALID_INTENTS = {
    "product_search",
    "cart_add",
    "cart_update",
    "cart_remove",
    "cart_view",
    "checkout",
    "payment",
    "order_status",
    "order_history",
    "order_cancel",
    "refund_request",
    "support",
    "recommendation",
    "general",
}

KEYWORD_MAP: dict[str, list[str]] = {
    "product_search": [
        "search",
        "find",
        "show me",
        "looking for",
        "want to buy",
        "browse",
    ],
    "cart_add": ["add to cart", "add", "put in", "i want this", "buy this"],
    "cart_view": ["my cart", "what's in", "show cart", "view cart", "cart"],
    "cart_remove": ["remove", "delete from cart", "take out", "don't want"],
    "cart_update": ["change quantity", "update cart", "modify"],
    "checkout": ["checkout", "buy now", "place order", "complete purchase", "pay"],
    "order_status": [
        "where is my order",
        "track",
        "order status",
        "shipped",
        "delivery",
    ],
    "order_history": ["my orders", "past orders", "order history", "previous orders"],
    "order_cancel": ["cancel order", "cancel my order"],
    "refund_request": [
        "refund",
        "return",
        "money back",
        "cancel order",
        "dispute",
        "chargeback",
    ],
    "support": [
        "help",
        "problem",
        "issue",
        "complaint",
        "broken",
        "wrong",
        "not working",
    ],
    "recommendation": [
        "recommend",
        "suggest",
        "what should i",
        "best",
        "popular",
        "top rated",
    ],
}


def keyword_classify(text: str) -> str:
    t = text.lower()
    for intent, keywords in KEYWORD_MAP.items():
        if any(kw in t for kw in keywords):
            return intent
    return "general"


async def classify_intent(state: dict) -> dict:
    messages = state.get("messages", [])
    last = messages[-1] if messages else {}
    text = last.get("content", "") if isinstance(last, dict) else str(last)

    llm = get_llm(temperature=0)
    try:
        resp = await llm.ainvoke(
            [
                {
                    "role": "system",
                    "content": (
                        f"Classify the intent. Valid intents: {', '.join(sorted(VALID_INTENTS))}\n"
                        "Extract entities: products (list[str]), maxPrice (float|null), "
                        "minPrice (float|null), quantity (int|null), orderId (str|null)\n"
                        "Detect sentiment: positive | neutral | negative | frustrated\n"
                        "Return ONLY valid JSON, no explanation:\n"
                        '{"intent":"...","entities":{"products":[],"maxPrice":null,'
                        '"minPrice":null,"quantity":null,"orderId":null},'
                        '"sentiment":"neutral","confidence":0.9}'
                    ),
                },
                {"role": "user", "content": text},
            ]
        )

        # Handle gpt-oss-120b reasoning model — may return reasoning_content
        content = getattr(resp, "content", "") or ""
        if not content:
            content = (getattr(resp, "additional_kwargs", {}) or {}).get(
                "reasoning_content", ""
            )

        # Extract JSON from response
        match = re.search(r'\{[^{}]*"intent"[^{}]*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group())
            intent = data.get("intent", "general")
            if intent not in VALID_INTENTS:
                intent = "general"
            return {
                "intent": intent,
                "entities": data.get("entities", {}),
                "sentiment": data.get("sentiment", "neutral"),
                "confidence": float(data.get("confidence", 0.5)),
            }

    except Exception:
        pass  # Fall through to keyword fallback

    return {
        "intent": keyword_classify(text),
        "entities": {},
        "sentiment": "neutral",
        "confidence": 0.4,
    }
