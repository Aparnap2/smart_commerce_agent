"""
Integration Tests: SSE → Context Pipeline (real LLM provider)
=============================================================

Verifies that the SSE handler in ``routers/chat.py`` correctly:

1. Emits ``messages/partial`` + ``delta`` events for AI text content
2. Extracts ``custom`` events when a ``__ui__`` payload is present in
   message content (e.g. when a tool returns structured data)
3. Strips ``__ui__`` from text events — no JSON leaks to the user
4. Always terminates with an ``end`` / ``complete`` event

The SSE handler checks message content as JSON for any ``__ui__``
field.  This handles TWO paths:
  a) **Real LLM**: ``ToolNode`` returns ``ToolMessage`` whose content
     is JSON with both ``__ui__`` + tool data fields
  b) **Any provider**: ``AIMessage`` whose content layer wraps
     ``{"content": "...", "__ui__": {...}}``

Prerequisites
-------------
* Docker containers running (Postgres on :5433, Redis on :6379)
* ``LLM_PROVIDER`` + provider-specific env vars set (defaults: Cohere)
* ``SALESFORCE_MODE=mock`` (only Salesforce third-party is mocked)
"""

import json
import os
import pytest

# Mark as integration — needs Docker + real LLM
pytestmark = pytest.mark.integration

# ──────────────────────────────────────────────────────────────────────
# SSE Helpers
# ──────────────────────────────────────────────────────────────────────


def parse_sse_events(body: str) -> list[tuple[str, dict | str]]:
    """Parse an SSE response body into ``(event_type, data)`` tuples.

    Handles both ``\\n`` and ``\\r\\n`` line endings.
    Strips trailing whitespace/``\\r`` from event types.
    """
    events: list[tuple[str, dict | str]] = []
    for block in body.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        lines = block.split("\n")
        event_type: str | None = None
        data_str: str | None = None
        for line in lines:
            line = line.rstrip("\r")
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
    """Return all ``custom`` events whose data has ``type == "ui"``."""
    result = []
    for ev_type, data in events:
        if ev_type in ("custom", "ui_actions"):
            if isinstance(data, dict):
                if data.get("type") == "ui":
                    result.append(data)
                for action in data.get("actions", []):
                    if isinstance(action, dict) and action.get("name"):
                        result.append(action)
    return result


# ══════════════════════════════════════════════════════════════════════
#  TESTS
# ══════════════════════════════════════════════════════════════════════


class TestSSEContextPipeline:
    """Verifies the SSE handler's contract.

    The real LLM's exact tool-choice is non-deterministic, so structural
    assertions (stream is well-formed, no JSON leaks) are stricter than
    tool-specific assertions.
    """

    # ── Fixtures ────────────────────────────────────────────────────

    @pytest.fixture
    async def client(self):
        """FastAPI test client backed by ``ASGITransport``."""
        from httpx import AsyncClient, ASGITransport
        from main import app

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as c:
            yield c

    @pytest.fixture
    def payload(self):
        return {
            "messages": [
                {"role": "user", "content": "Find open cases for Acme Corp"}
            ],
            "user_id": "admin@techtrend.com",
            "configurable": {"role": "SUPPORT_AGENT"},
        }

    @pytest.fixture
    def headers(self):
        return {
            "Authorization": "Bearer integration-test-token",
            "x-test-mode": "true",
        }

    @pytest.fixture
    def multi_turn_payload(self):
        """Two full turns of conversation for context persistence test."""
        return [
            {
                "messages": [
                    {"role": "user", "content": "Find cases for Acme Corp"}
                ],
                "user_id": "admin@techtrend.com",
                "configurable": {"role": "SUPPORT_AGENT"},
            },
            {
                "messages": [
                    {"role": "user", "content": "Find cases for Acme Corp"},
                    {
                        "role": "assistant",
                        "content": "I found the cases.",
                    },
                    {
                        "role": "user",
                        "content": "Show me customer context",
                    },
                ],
                "user_id": "admin@techtrend.com",
                "configurable": {"role": "SUPPORT_AGENT"},
            },
        ]

    # ── Core: end event always present ─────────────────────────────

    @pytest.mark.asyncio
    async def test_end_event_present(self, client, payload, headers):
        """The SSE stream must always terminate with an ``end`` event."""
        # Act
        response = await client.post("/agent/chat", json=payload, headers=headers)

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

    # ── Core: text events have clean content (no JSON leak) ────────

    @pytest.mark.asyncio
    async def test_no_json_leak_in_text_events(self, client, payload, headers):
        """``messages/partial`` and ``delta`` events must contain clean
        natural-language text, not raw JSON.
        """
        # Act
        response = await client.post("/agent/chat", json=payload, headers=headers)

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        for ev_type, data in events:
            if ev_type in ("messages/partial", "delta"):
                if isinstance(data, dict):
                    content = data.get("content", "")
                elif isinstance(data, list) and len(data) > 0:
                    content = data[0].get("content", "")
                else:
                    content = str(data)

                    # __ui__ should never leak to text events
                assert "__ui__" not in content, (
                    f"__ui__ leaked into {ev_type} event: {content[:200]}"
                )

                # If content starts with { it means JSON leaked to user
                assert not content.startswith("{"), (
                    f"Raw JSON leaked into {ev_type} event: {content[:200]}"
                )

    def _check_rate_limited(self, events: list) -> bool:
        """Return True if the stream indicates an API rate limit (429).

        The SSE handler catches graph exceptions and yields an ``error``
        event.  When the LLM is rate-limited, this is the only event.
        """
        if len(events) == 1 and events[0][0] == "error":
            msg = str(events[0][1])
            if "429" in msg or "rate limit" in msg.lower():
                return True
        return False

    # ── Core: stream produces at least text or custom events ───────

    @pytest.mark.asyncio
    async def test_stream_contains_events(self, client, payload, headers):
        """The stream should produce at least method/metric/tool and
        end events (not be empty).  Skips if API rate limit is hit.
        """
        # Act
        response = await client.post("/agent/chat", json=payload, headers=headers)

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Gracefully skip on rate limit
        if self._check_rate_limited(events):
            pytest.skip("LLM API rate limited — run with a production key")
            return

        # Should have at least: some content events + end
        assert len(events) >= 2, (
            f"SSE stream only has {len(events)} event(s). "
            f"Expected at least 2 (content + end). "
            f"Events: {[(t, type(d).__name__) for t, d in events]}"
        )

    # ── Optional: tool-specific custom events (LLM-dependent) ──────

    @pytest.mark.asyncio
    async def test_custom_event_may_be_emitted(self, client, payload, headers):
        """If the LLM calls a tool, a ``custom`` UI event should be
        emitted.  This is an **informational** assertion — the real
        LLM may decide to respond without calling tools, which is also
        valid.

        The assertion is soft (non-blocking) for LLM-dependent paths.
        """
        # Act
        response = await client.post("/agent/chat", json=payload, headers=headers)

        # Assert
        assert response.status_code == 200
        events = parse_sse_events(response.text)
        ui_events = find_custom_ui_events(events)

        if len(ui_events) == 0:
            # Soft fail — log but don't break CI
            event_types = [t for t, _ in events]
            pytest.skip(
                "No custom/ui_actions event found — real LLM may have "
                f"responded without calling tools. Event types: {event_types}"
            )
            return

        # If we DO have UI events, verify their structure
        for ev in ui_events:
            assert "name" in ev, f"UI event missing 'name': {ev}"
            assert isinstance(ev["name"], str), f"UI name not string: {ev}"
            assert "props" in ev or any(
                k.endswith("Data") for k in ev
            ), f"UI event missing 'props' or data key: {ev}"

    # ── Multi-turn: context maintains SSE structure ─────────────────

    @pytest.mark.asyncio
    async def test_multi_turn_context_preserved(
        self, client, headers, multi_turn_payload
    ):
        """A second turn should still produce a well-formed SSE stream
        (at minimum: content events + end).
        """
        # Act — first turn
        resp1 = await client.post(
            "/agent/chat", json=multi_turn_payload[0], headers=headers
        )
        assert resp1.status_code == 200, (
            f"First turn failed: {resp1.status_code}"
        )

        events1 = parse_sse_events(resp1.text)

        # Skip if first turn was rate limited
        if self._check_rate_limited(events1):
            pytest.skip("LLM API rate limited on first turn — run with a production key")
            return

        assert any(t in ("end", "complete", "error") for t, _ in events1), (
            "First turn missing terminal event (end/complete/error). "
            f"Events: {[(t, type(d).__name__) for t, d in events1]}"
        )

        # Act — second turn (follow-up with context)
        resp2 = await client.post(
            "/agent/chat", json=multi_turn_payload[1], headers=headers
        )

        # Assert
        assert resp2.status_code == 200, (
            f"Second turn failed: {resp2.status_code} {resp2.text[:300]}"
        )

        events2 = parse_sse_events(resp2.text)

        # Skip if second turn was rate limited
        if self._check_rate_limited(events2):
            pytest.skip("LLM API rate limited on second turn — run with a production key")
            return

        # Second turn must also be well-formed
        assert any(t in ("end", "complete", "error") for t, _ in events2), (
            "Second turn missing terminal event (end/complete/error). "
            f"Events: {[(t, type(d).__name__) for t, d in events2]}"
        )

        assert len(events2) >= 2, (
            f"Second turn only has {len(events2)} event(s). "
            f"Expected at least content + end."
        )
