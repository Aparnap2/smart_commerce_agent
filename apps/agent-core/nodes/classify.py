from llm.provider import get_llm
import json, re, os

VALID_INTENTS = {
    "search_catalog",
    "get_budget_status",
    "add_to_pr",
    "view_pr",
    "remove_from_pr",
    "submit_pr",
    "get_pr_status",
    "get_purchase_requests",
    "approve_pr",
    "reject_pr",
    "raise_dispute",
    "general",
}

KEYWORD_MAP: dict[str, list[str]] = {
    "search_catalog": [
        "search",
        "find",
        "show me",
        "looking for",
        "browse catalog",
        "vendor",
        "product",
    ],
    "get_budget_status": [
        "budget",
        "how much left",
        "spending",
        "remaining",
        "department budget",
    ],
    "add_to_pr": [
        "add to request",
        "add to pr",
        "add item",
        "include",
        "i need this",
    ],
    "view_pr": [
        "my request",
        "my pr",
        "show request",
        "view pr",
        "draft",
    ],
    "remove_from_pr": [
        "remove from pr",
        "remove item",
        "delete from request",
        "don't need",
    ],
    "submit_pr": [
        "submit",
        "submit for approval",
        "send for review",
        "complete request",
    ],
    "get_pr_status": [
        "status",
        "where is",
        "approved",
        "rejected",
        "pending",
    ],
    "get_purchase_requests": [
        "my requests",
        "past requests",
        "request history",
        "all prs",
    ],
    "approve_pr": [
        "approve",
        "accept",
        "look good",
        "approved",
    ],
    "reject_pr": [
        "reject",
        "deny",
        "not approved",
        "rejected",
    ],
    "raise_dispute": [
        "dispute",
        "issue",
        "problem",
        "wrong",
        "complaint",
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
                        f"Classify the intent for ProcureAI B2B procurement. Valid intents: {', '.join(sorted(VALID_INTENTS))}\n"
                        "Extract entities: items (list[str]), maxPrice (float|null), "
                        "minPrice (float|null), quantity (int|null), prId (str|null)\n"
                        "Detect sentiment: positive | neutral | negative | frustrated\n"
                        "Return ONLY valid JSON, no explanation:\n"
                        '{"intent":"...","entities":{"items":[],"maxPrice":null,'
                        '"minPrice":null,"quantity":null,"prId":null},'
                        '"sentiment":"neutral","confidence":0.9}'
                    ),
                },
                {"role": "user", "content": text},
            ]
        )

        content = getattr(resp, "content", "") or ""
        if not content:
            content = (getattr(resp, "additional_kwargs", {}) or {}).get(
                "reasoning_content", ""
            )

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
        pass

    return {
        "intent": keyword_classify(text),
        "entities": {},
        "sentiment": "neutral",
        "confidence": 0.4,
    }