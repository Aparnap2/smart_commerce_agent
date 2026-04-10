import json
from collections.abc import AsyncIterator
from langchain_core.messages import BaseMessage


def _serialize_message(msg: BaseMessage) -> dict:
    d = msg.model_dump()
    d["type"] = msg.type

    if hasattr(msg, "tool_calls") and msg.tool_calls:
        d["tool_calls"] = [
            {
                "id": tc.get("id", ""),
                "name": tc["name"],
                "args": tc["args"],
            }
            for tc in msg.tool_calls
        ]
    return d


def _default_serializer(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    return str(obj)


async def graph_to_sse(stream: AsyncIterator) -> AsyncIterator[str]:
    """
    Converts LangGraph astream() chunks → SSE events.
    Emits: messages/partial, custom, end, error
    """
    try:
        async for chunk in stream:
            stream_type = chunk.get("type", "")
            data = chunk.get("data", {})

            if stream_type == "messages":
                if isinstance(data, (list, tuple)) and len(data) == 2:
                    msg, metadata = data
                    serialized = _serialize_message(msg)
                    yield (
                        f"event: messages/partial\n"
                        f"data: {json.dumps([serialized], default=_default_serializer)}\n\n"
                    )

            elif stream_type == "updates":
                for node_name, node_output in data.items():
                    msgs = node_output.get("messages", [])
                    for msg in msgs:
                        content = getattr(msg, "content", "")
                        if not content:
                            continue
                        try:
                            parsed = json.loads(content)
                            if "__ui__" in parsed:
                                ui = parsed["__ui__"]
                                yield (
                                    f"event: custom\n"
                                    f"data: {json.dumps({'type': 'ui', **ui})}\n\n"
                                )
                        except (json.JSONDecodeError, TypeError):
                            pass

        yield "event: end\ndata: {}\n\n"

    except Exception as e:
        yield (
            f"event: error\n"
            f"data: {json.dumps({'message': str(e)})}\n\n"
        )
