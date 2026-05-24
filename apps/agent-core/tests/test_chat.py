import pytest
from unittest.mock import patch, AsyncMock, MagicMock

pytestmark = pytest.mark.xfail(reason="Missing 'client' fixture - needs FastAPI test client setup")


@pytest.mark.asyncio
async def test_chat_no_token_returns_401(client):
    r = await client.post("/agent/chat", json={"message": "hello"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_chat_invalid_token_returns_401(client):
    r = await client.post(
        "/agent/chat",
        json={"message": "hello"},
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_chat_valid_token_returns_sse_stream(client, valid_token):
    # Mock the entire orchestrator to avoid real LLM + Redis calls
    async def mock_stream(*args, **kwargs):
        yield {
            "event": "on_chat_model_stream",
            "data": {"chunk": type("C", (), {"content": "Hello!"})()},
        }
        yield {
            "event": "on_chain_end",
            "name": "LangGraph",
            "data": {"output": {"uiComponents": []}},
        }

    with patch("routers.chat.create_orchestrator") as mock_orch:
        mock_graph = MagicMock()
        mock_graph.astream_events = mock_stream
        mock_orch.return_value = mock_graph

        r = await client.post(
            "/agent/chat",
            json={"message": "show me headphones"},
            headers={"Authorization": f"Bearer {valid_token}"},
        )

    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    body = r.text
    assert '"type": "delta"' in body or '"type":"delta"' in body
    assert '"type": "complete"' in body or '"type":"complete"' in body


@pytest.mark.asyncio
async def test_chat_stream_contains_thread_id(client, valid_token):
    async def mock_stream(*args, **kwargs):
        yield {
            "event": "on_chain_end",
            "name": "LangGraph",
            "data": {"output": {"uiComponents": []}},
        }

    with patch("routers.chat.create_orchestrator") as mock_orch:
        mock_graph = MagicMock()
        mock_graph.astream_events = mock_stream
        mock_orch.return_value = mock_graph

        r = await client.post(
            "/agent/chat",
            json={"message": "hello", "thread_id": "test-thread-123"},
            headers={"Authorization": f"Bearer {valid_token}"},
        )

    assert (
        '"threadId": "test-thread-123"' in r.text
        or '"threadId":"test-thread-123"' in r.text
    )


@pytest.mark.asyncio
async def test_chat_includes_ui_actions_when_present(client, valid_token):
    async def mock_stream(*args, **kwargs):
        yield {
            "event": "on_chain_end",
            "name": "LangGraph",
            "data": {
                "output": {"uiComponents": [{"component": "ProductGrid", "props": {}}]}
            },
        }

    with patch("routers.chat.create_orchestrator") as mock_orch:
        mock_graph = MagicMock()
        mock_graph.astream_events = mock_stream
        mock_orch.return_value = mock_graph

        r = await client.post(
            "/agent/chat",
            json={"message": "show products"},
            headers={"Authorization": f"Bearer {valid_token}"},
        )

    assert '"type": "ui_actions"' in r.text or '"type":"ui_actions"' in r.text
    assert '"ProductGrid"' in r.text
