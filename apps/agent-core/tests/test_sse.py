import json
import pytest
from src.sse import graph_to_sse
from langchain_core.messages import AIMessage


async def mock_stream_with_ui():
    yield {
        "type": "messages",
        "data": (
            AIMessage(
                content="",
                tool_calls=[{
                    "id": "call-1",
                    "name": "search_products",
                    "args": {"query": "headphones"}
                }]
            ),
            {"langgraph_node": "agent"}
        ),
        "ns": [],
    }
    yield {
        "type": "updates",
        "data": {
            "tools": {
                "messages": [
                    type("ToolMsg", (), {
                        "content": json.dumps({
                            "products": [{"id": 1, "name": "Sony"}],
                            "__ui__": {
                                "name": "product-grid",
                                "props": {
                                    "loading": False,
                                    "products": [{"id": 1, "name": "Sony"}]
                                }
                            }
                        }),
                        "type": "tool",
                    })()
                ]
            }
        },
        "ns": [],
    }
    yield {
        "type": "messages",
        "data": (
            AIMessage(content="Here are some headphones."),
            {"langgraph_node": "agent"}
        ),
        "ns": [],
    }


class TestGraphToSSE:

    @pytest.mark.asyncio
    async def test_emits_custom_ui_event(self):
        events = []
        async for chunk in graph_to_sse(mock_stream_with_ui()):
            events.append(chunk)

        custom_events = [e for e in events if e.startswith("event: custom")]
        assert len(custom_events) == 1

        data_line = custom_events[0].split("\n")[1]
        data = json.loads(data_line.replace("data: ", ""))
        assert data["name"] == "product-grid"
        assert data["type"] == "ui"
        assert "products" in data["props"]

    @pytest.mark.asyncio
    async def test_emits_end_event(self):
        events = []
        async for chunk in graph_to_sse(mock_stream_with_ui()):
            events.append(chunk)

        assert any(e.startswith("event: end") for e in events)

    @pytest.mark.asyncio
    async def test_emits_messages_partial(self):
        events = []
        async for chunk in graph_to_sse(mock_stream_with_ui()):
            events.append(chunk)

        msg_events = [e for e in events if e.startswith("event: messages/partial")]
        assert len(msg_events) >= 1

    @pytest.mark.asyncio
    async def test_error_handling(self):
        async def error_stream():
            raise ValueError("test error")
            yield

        events = []
        async for chunk in graph_to_sse(error_stream()):
            events.append(chunk)

        assert any(e.startswith("event: error") for e in events)
        assert "test error" in events[-1]
