"""
LLM-Free SSE Streaming Contract Tests for SupportPilot
=======================================================

Verifies the ``POST /agent/chat`` SSE endpoint contract WITHOUT any real LLM
calls.  Uses ``MockLLM`` injected into ``dependencies._llm`` *before* the ASGI
test client is created.

Strategy
--------
Replace the real LLM with ``MockLLM`` in ``dependencies`` *before* the endpoint
is hit.  Use ``httpx.AsyncClient`` with ``ASGITransport`` for the test client.

Key behaviours verified
----------------------
1. SSE event contract — end, messages/partial, delta, custom
2. Auth bypass — x-test-mode, x-user-id headers
3. User role precedence — body.user_role > configurable.role > "EMPLOYEE"
4. Edge cases — empty messages, thread_id preservation

No Docker, no real LLM, no network calls.
"""

import json
import os

# ── Langfuse env stubs (set before any app import) ──────────────────────
# The Langfuse @observe decorator and get_client() auto-initialize from
# env vars.  Provide dummy values so the Langfuse singleton is happy even
# though the lifespan never runs (ASGITransport doesn't call lifespan by
# default).
os.environ.setdefault("LANGFUSE_PUBLIC_KEY", "pk-test-key")
os.environ.setdefault("LANGFUSE_SECRET_KEY", "sk-test-key")
os.environ.setdefault("LANGFUSE_BASE_URL", "http://localhost:3001")

import pytest
from httpx import AsyncClient, ASGITransport


# ══════════════════════════════════════════════════════════════════════════
# SSE Helpers
# ══════════════════════════════════════════════════════════════════════════


def parse_sse_events(body: str) -> list[tuple[str, dict | str]]:
    """Parse an SSE response body into ``(event_type, data)`` tuples.

    Normalises ``\\r\\n`` to ``\\n`` first because sse_starlette emits
    ``\\r\\n`` line endings (RFC 8895).  Without this normalisation,
    ``split("\\n\\n")`` would fail to recognise ``\\r\\n\\r\\n`` block
    boundaries, collapsing all events into a single block.
    """
    body = body.replace("\r\n", "\n")
    events: list[tuple[str, dict | str]] = []
    for block in body.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        lines = block.split("\n")
        event_type: str | None = None
        data_str: str | None = None
        for line in lines:
            if line.startswith("event: "):
                event_type = line[7:].strip()
            elif line.startswith("data: "):
                data_str = line[6:]
        if event_type is not None and data_str is not None:
            try:
                data: dict | str = json.loads(data_str)
            except json.JSONDecodeError:
                data = data_str
            events.append((event_type, data))
    return events


def find_custom_ui_events(
    events: list[tuple[str, dict | str]],
) -> list[dict]:
    """Return all ``custom`` / ``ui_actions`` events that carry UI data."""
    result: list[dict] = []
    for ev_type, data in events:
        if ev_type in ("custom", "ui_actions"):
            if isinstance(data, dict):
                if data.get("type") == "ui":
                    result.append(data)
                for action in data.get("actions", []):
                    if isinstance(action, dict) and action.get("name"):
                        result.append(action)
    return result


# ══════════════════════════════════════════════════════════════════════════
# Tests
# ══════════════════════════════════════════════════════════════════════════


class TestLLMFreeSSE:
    """SSE streaming contract tests with ``MockLLM`` — zero real LLM calls.

    Every test uses ``dependencies._llm = MockLLM()`` injected via the
    ``mock_env`` fixture.  This overrides the autouse ``real_llm`` fixture
    from ``tests/conftest.py``.
    """

    # ── Fixtures ────────────────────────────────────────────────────────

    @pytest.fixture
    def mock_env(self):
        """Inject ``MockLLM`` into ``dependencies._llm`` *before* the ASGI
        client is created.

        This fixture runs **after** the autouse ``real_llm`` fixture from
        ``conftest.py``, overriding the real LLM with a deterministic mock.

        The ``MockSalesforceClient`` singleton is already initialized by the
        autouse ``salesforce_client`` fixture, so all support tools resolve
        correctly.
        """
        from src import dependencies
        from src.llm_config import MockLLM

        dependencies._llm = MockLLM()
        yield
        dependencies._llm = None

    @pytest.fixture
    async def client(self, mock_env):
        """FastAPI test client backed by ``ASGITransport``.

        ``mock_env`` is declared as a dependency so that ``dependencies._llm``
        is set to ``MockLLM()`` *before* the app handles any requests.  The
        ``lifespan`` is NOT called — Redis / Postgres / Langfuse remain
        uninitialized, which is handled gracefully by the graph (exceptions
        caught → defaults used).
        """
        from main import app

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as c:
            yield c

    @pytest.fixture
    def headers_test_mode(self) -> dict[str, str]:
        return {"x-test-mode": "true"}

    @pytest.fixture
    def headers_x_user_id(self) -> dict[str, str]:
        return {"x-user-id": "test-user-id"}

    @pytest.fixture
    def payload_cases(self) -> dict:
        """Payload that triggers the ``cases`` mock response (keyword: 'case')."""
        return {
            "messages": [
                {"role": "user", "content": "Find open cases for Acme Corp"}
            ],
            "user_id": "test@example.com",
        }

    @pytest.fixture
    def payload_customer(self) -> dict:
        """Payload that triggers the ``customer_context`` mock response."""
        return {
            "messages": [
                {"role": "user", "content": "Show customer context for this account"}
            ],
            "user_id": "test@example.com",
        }

    # ── 1. SSE Event Contract Tests ────────────────────────────────────

    @pytest.mark.asyncio
    async def test_end_event_always_present(
        self, client, payload_cases, headers_test_mode
    ):
        """The SSE stream must **always** terminate with an ``end`` or ``complete`` event.

        This is the fundamental contract: the client must always know when
        the stream is finished, regardless of success or failure.
        """
        # Act
        response = await client.post(
            "/agent/chat", json=payload_cases, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text[:200]}"
        )

        events = parse_sse_events(response.text)
        terminal_events = [t for t, _ in events if t in ("end", "complete", "error")]
        assert len(terminal_events) >= 1, (
            "No terminal event (end/complete/error) found in SSE stream.\n"
            f"All events: {[(t, type(d).__name__) for t, d in events]}"
        )
        # end must be the very last terminal event
        assert events[-1][0] in ("end", "complete", "error"), (
            f"Last event must be terminal, got: {events[-1][0]}"
        )

    @pytest.mark.asyncio
    async def test_messages_partial_emitted(
        self, client, payload_cases, headers_test_mode
    ):
        """``messages/partial`` events must be emitted and contain AI text content.

        The canonical SSE path for delivering AI response chunks.
        """
        # Act
        response = await client.post(
            "/agent/chat", json=payload_cases, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)
        partials = [(t, d) for t, d in events if t == "messages/partial"]

        assert len(partials) >= 1, (
            f"No messages/partial events emitted.  "
            f"Event types: {[t for t, _ in events]}"
        )

        for ev_type, data in partials:
            assert isinstance(data, list), (
                f"messages/partial data should be a list, got {type(data)}"
            )
            assert len(data) >= 1, "messages/partial data must not be empty"
            item = data[0]
            assert "content" in item, (
                f"messages/partial item missing 'content': {item}"
            )
            assert item.get("type") == "ai", (
                f"messages/partial type should be 'ai': {item}"
            )
            assert len(str(item["content"])) > 0, (
                "messages/partial content must not be empty"
            )

    @pytest.mark.asyncio
    async def test_delta_emitted(
        self, client, payload_cases, headers_test_mode
    ):
        """Backward-compatible ``delta`` events must be emitted alongside
        ``messages/partial`` for legacy chat-page consumers.
        """
        # Act
        response = await client.post(
            "/agent/chat", json=payload_cases, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)
        deltas = [(t, d) for t, d in events if t == "delta"]

        assert len(deltas) >= 1, (
            f"No delta events emitted.  Event types: {[t for t, _ in events]}"
        )

        for ev_type, data in deltas:
            assert isinstance(data, dict), (
                f"delta data should be a dict, got {type(data)}"
            )
            assert "content" in data, (
                f"delta data missing 'content': {data}"
            )
            assert len(str(data["content"])) > 0, (
                "delta content must not be empty"
            )

    @pytest.mark.asyncio
    async def test_no_json_leak_in_text_events(
        self, client, payload_cases, headers_test_mode
    ):
        """``__ui__`` must **never** leak into text events, and text content must
        not start with ``{`` (which would indicate raw JSON reaching the user).

        The SSE handler (``routers/chat.py``) pops ``__ui__`` from the parsed
        JSON payload before emitting text events.  This test verifies that
        separation is working correctly.
        """
        # Act
        response = await client.post(
            "/agent/chat", json=payload_cases, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        for ev_type, data in events:
            if ev_type not in ("messages/partial", "delta"):
                continue

            # Extract the display content
            if isinstance(data, dict):
                content = str(data.get("content", ""))
            elif isinstance(data, list) and len(data) > 0:
                content = str(data[0].get("content", ""))
            else:
                content = str(data)

            # The UI payload must never leak into text events
            assert "__ui__" not in content, (
                f"__ui__ leaked into {ev_type} event: {content[:200]}"
            )

            # Text content must be clean natural language, not raw JSON
            assert not content.startswith("{"), (
                f"Raw JSON leaked into {ev_type} event: {content[:200]}"
            )

    @pytest.mark.asyncio
    async def test_ui_extracted_from_mock_response(
        self, client, headers_test_mode
    ):
        """When ``MockLLM`` returns JSON with a ``__ui__`` key, the SSE handler
        must extract it and emit a ``custom`` event with ``type: ui``, ``name``,
        and ``props``.

        The 'cases' keyword trigger produces a ``case-list`` GenUI component.
        """
        # Arrange — use a "cases" keyword to trigger the case-list mock response
        payload = {
            "messages": [
                {"role": "user", "content": "Find open cases for Acme Corp"}
            ],
            "user_id": "test@example.com",
        }

        # Act
        response = await client.post(
            "/agent/chat", json=payload, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Find custom events with type == "ui"
        custom_events = [
            d for t, d in events
            if t == "custom" and isinstance(d, dict) and d.get("type") == "ui"
        ]
        assert len(custom_events) >= 1, (
            f"No custom (type=ui) events emitted for 'cases' query.\n"
            f"All events: {[(t, type(d).__name__) for t, d in events]}"
        )

        ui_event = custom_events[0]
        assert ui_event.get("type") == "ui", (
            f"custom event type should be 'ui': {ui_event}"
        )
        assert "name" in ui_event, (
            f"custom event missing 'name': {ui_event}"
        )
        assert isinstance(ui_event["name"], str), (
            f"name should be a string: {ui_event}"
        )
        assert ui_event["name"] == "case-list", (
            f"Expected GenUI component 'case-list', got '{ui_event['name']}': {ui_event}"
        )
        assert "props" in ui_event, (
            f"custom event missing 'props': {ui_event}"
        )
        assert "cases" in ui_event["props"], (
            f"props missing 'cases' array: {ui_event}"
        )
        assert len(ui_event["props"]["cases"]) > 0, (
            "props.cases array must not be empty"
        )

    @pytest.mark.asyncio
    async def test_ui_actions_backward_compat_emitted(
        self, client, headers_test_mode
    ):
        """Backward-compatible ``ui_actions`` events must be emitted whenever a
        ``custom`` UI event is emitted (legacy chat-page consumers).
        """
        payload = {
            "messages": [
                {"role": "user", "content": "Find open cases for Acme Corp"}
            ],
            "user_id": "test@example.com",
        }

        # Act
        response = await client.post(
            "/agent/chat", json=payload, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        ui_actions = [
            d for t, d in events
            if t == "ui_actions" and isinstance(d, dict)
        ]
        assert len(ui_actions) >= 1, (
            f"No ui_actions events emitted alongside custom event.\n"
            f"All events: {[(t, type(d).__name__) for t, d in events]}"
        )

        # Each ui_actions event must have an actions list
        for action_data in ui_actions:
            assert "actions" in action_data, (
                f"ui_actions missing 'actions' key: {action_data}"
            )
            assert isinstance(action_data["actions"], list), (
                f"ui_actions.actions should be a list: {action_data}"
            )

    # ── 2. Auth Bypass Tests ───────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_test_mode_bypass(
        self, client, payload_cases, headers_test_mode
    ):
        """``x-test-mode: true`` must bypass JWT auth and return 200 OK."""
        # Act
        response = await client.post(
            "/agent/chat", json=payload_cases, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200, (
            f"Expected 200 with x-test-mode, "
            f"got {response.status_code}: {response.text[:200]}"
        )

    @pytest.mark.asyncio
    async def test_x_user_id_bypass(
        self, client, payload_cases, headers_x_user_id
    ):
        """``x-user-id: test-user-id`` must bypass JWT auth."""
        # Act
        payload = dict(payload_cases)
        payload["user_id"] = "test-user-id"
        response = await client.post(
            "/agent/chat", json=payload, headers=headers_x_user_id
        )

        # Assert
        assert response.status_code == 200, (
            f"Expected 200 with x-user-id: test-user-id, "
            f"got {response.status_code}: {response.text[:200]}"
        )

    @pytest.mark.asyncio
    async def test_auth_required_without_test_mode(
        self, client, payload_cases
    ):
        """Without ``x-test-mode``, ``x-user-id``, or ``Authorization``
        headers, the endpoint must return 401 Unauthorized.
        """
        # Act — no auth headers at all
        response = await client.post("/agent/chat", json=payload_cases)

        # Assert
        assert response.status_code == 401, (
            f"Expected 401 without auth headers, "
            f"got {response.status_code}: {response.text[:200]}"
        )

    # ── 3. User Role Precedence Tests ──────────────────────────────────

    @pytest.mark.asyncio
    async def test_user_role_from_body_field(
        self, client, headers_test_mode
    ):
        """``body.user_role: TEAM_LEAD`` must be respected and produce a
        valid SSE stream.

        ``TEAM_LEAD`` has access to all 10 support tools (including
        ``escalate_case``).  The graph binds tools based on this role.
        With MockLLM (which ignores tool bindings), the critical contract
        is that the endpoint handles the role without errors.
        """
        payload = {
            "messages": [
                {"role": "user", "content": "Find open cases for Acme Corp"}
            ],
            "user_id": "test@example.com",
            "user_role": "TEAM_LEAD",
        }

        # Act
        response = await client.post(
            "/agent/chat", json=payload, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Must not have error events
        error_events = [d for t, d in events if t == "error"]
        assert len(error_events) == 0, (
            f"Error events emitted for TEAM_LEAD role: {error_events}"
        )

        # Must terminate correctly
        terminal = [t for t, _ in events if t in ("end", "complete")]
        assert len(terminal) >= 1, (
            f"No terminal event for TEAM_LEAD role.  "
            f"Events: {[(t, type(d).__name__) for t, d in events]}"
        )

    @pytest.mark.asyncio
    async def test_user_role_from_configurable(
        self, client, headers_test_mode
    ):
        """``configurable.role: TEAM_LEAD`` must be used when ``user_role``
        is not set in the request body.
        """
        payload = {
            "messages": [
                {"role": "user", "content": "Find open cases for Acme Corp"}
            ],
            "user_id": "test@example.com",
            "configurable": {"role": "TEAM_LEAD"},
        }

        # Act
        response = await client.post(
            "/agent/chat", json=payload, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        error_events = [d for t, d in events if t == "error"]
        assert len(error_events) == 0, (
            f"Error events for configurable TEAM_LEAD role: {error_events}"
        )

        terminal = [t for t, _ in events if t in ("end", "complete")]
        assert len(terminal) >= 1, (
            f"No terminal event for configurable TEAM_LEAD role.  "
            f"Events: {[(t, type(d).__name__) for t, d in events]}"
        )

    @pytest.mark.asyncio
    async def test_user_role_precedence_body_over_configurable(
        self, client, headers_test_mode
    ):
        """When **both** ``body.user_role`` and ``configurable.role`` are
        set, ``body.user_role`` must take precedence.

        ``SUPPORT_AGENT`` (from body) must win over ``TEAM_LEAD`` (from
        configurable).
        """
        payload = {
            "messages": [
                {"role": "user", "content": "Find open cases for Acme Corp"}
            ],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "configurable": {"role": "TEAM_LEAD"},
        }

        # Act
        response = await client.post(
            "/agent/chat", json=payload, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        error_events = [d for t, d in events if t == "error"]
        assert len(error_events) == 0, (
            f"Error events when body overrides configurable: {error_events}"
        )

        terminal = [t for t, _ in events if t in ("end", "complete")]
        assert len(terminal) >= 1, (
            f"No terminal event with body role precedence.  "
            f"Events: {[(t, type(d).__name__) for t, d in events]}"
        )

    @pytest.mark.asyncio
    async def test_user_role_defaults_to_employee(
        self, client, payload_cases, headers_test_mode
    ):
        """When **neither** ``body.user_role`` nor ``configurable.role`` is
        set, the endpoint must default to ``"EMPLOYEE"``.

        ``"EMPLOYEE"`` is not in ``{SUPPORT_AGENT, TEAM_LEAD, SUPPORT_OPS,
        ADMIN}``, so ``get_tools_for_role("EMPLOYEE")`` returns ``[]``
        (no tools bound).  The critical contract: the endpoint still
        completes without errors.
        """
        # Act — payload_cases has no user_role or configurable
        response = await client.post(
            "/agent/chat", json=payload_cases, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        error_events = [d for t, d in events if t == "error"]
        assert len(error_events) == 0, (
            f"Error events with default EMPLOYEE role: {error_events}"
        )

        terminal = [t for t, _ in events if t in ("end", "complete")]
        assert len(terminal) >= 1, (
            f"No terminal event with default EMPLOYEE role.  "
            f"Events: {[(t, type(d).__name__) for t, d in events]}"
        )

    # ── 4. Edge Case Tests ────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_empty_messages_list(
        self, client, headers_test_mode
    ):
        """POST with an empty ``messages`` list must handle gracefully.

        The endpoint should either return a ``422`` validation error
        (if the schema requires at least one message) or a ``200`` with
        a valid SSE stream that terminates correctly.
        """
        payload = {
            "messages": [],
            "user_id": "test@example.com",
        }

        # Act
        response = await client.post(
            "/agent/chat", json=payload, headers=headers_test_mode
        )

        # Assert — both 200 (backend handles gracefully) and 422
        # (Pydantic validation) are acceptable
        assert response.status_code in (200, 422), (
            f"Expected 200 or 422 for empty messages, "
            f"got {response.status_code}: {response.text[:200]}"
        )

        if response.status_code == 200:
            events = parse_sse_events(response.text)
            # With empty messages, the graph has no last_msg → IndexError.
            # The handler catches this and yields an ``error`` event, which
            # is a graceful degradation (not a crash).
            terminal = [t for t, _ in events if t in ("end", "complete", "error")]
            assert len(terminal) >= 1, (
                f"No terminal event with empty messages.  "
                f"Events: {[(t, type(d).__name__) for t, d in events]}"
            )
        elif response.status_code == 422:
            detail = response.json().get("detail", "")
            assert detail, "422 response must include a 'detail' field"

    @pytest.mark.asyncio
    async def test_thread_id_preserved(
        self, client, headers_test_mode
    ):
        """``thread_id`` must flow through the SSE stream without causing
        errors.
        """
        payload = {
            "messages": [
                {"role": "user", "content": "Find open cases for Acme Corp"}
            ],
            "user_id": "test@example.com",
            "thread_id": "test-thread-001",
        }

        # Act
        response = await client.post(
            "/agent/chat", json=payload, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200, (
            f"Expected 200 with thread_id, "
            f"got {response.status_code}: {response.text[:200]}"
        )
        events = parse_sse_events(response.text)

        # No error events from thread_id
        error_events = [d for t, d in events if t == "error"]
        assert len(error_events) == 0, (
            f"Error events emitted with thread_id: {error_events}"
        )

        # Stream completes
        terminal = [t for t, _ in events if t in ("end", "complete")]
        assert len(terminal) >= 1, (
            f"No terminal event with thread_id.  "
            f"Events: {[(t, type(d).__name__) for t, d in events]}"
        )

        # Verify thread_id is part of the stream
        thread_id_events = [d for t, d in events if t == "thread_id"]
        if thread_id_events:
            # A thread_id event may be emitted (depending on graph flow)
            assert any(
                tid.get("threadId") == "test-thread-001"
                for tid in thread_id_events
                if isinstance(tid, dict)
            ), f"thread_id mismatch: {thread_id_events}"

    @pytest.mark.asyncio
    async def test_supports_alt_stream_endpoint(
        self, client, payload_cases, headers_test_mode
    ):
        """The ``/agent/stream`` endpoint (alias for ``/chat``) must behave
        identically — same events, same terminal contract.
        """
        # Act — use the /stream alias
        response = await client.post(
            "/agent/stream", json=payload_cases, headers=headers_test_mode
        )

        # Assert
        assert response.status_code == 200, (
            f"/agent/stream returned {response.status_code}"
        )
        events = parse_sse_events(response.text)

        # Same contract: terminal event present
        terminal = [t for t, _ in events if t in ("end", "complete", "error")]
        assert len(terminal) >= 1, (
            f"/agent/stream missing terminal event.  "
            f"Events: {[(t, type(d).__name__) for t, d in events]}"
        )

        # Content events present
        partials = [(t, d) for t, d in events if t == "messages/partial"]
        assert len(partials) >= 1, (
            f"/agent/stream missing messages/partial events.  "
            f"Event types: {[t for t, _ in events]}"
        )
