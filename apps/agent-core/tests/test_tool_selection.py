"""
Tool selection correctness tests.

Tests two layers:
  Layer 1 — Tool-filtering (no LLM): Verifies get_tools_for_role() returns
             correct tools for each role and enforces access boundaries.
  Layer 2 — Integration smoke (real LLM): Verifies the graph runs end-to-end
             without errors and forbidden tools (based on role) are not invoked.
"""

import json
import os
import pytest
from langchain_core.messages import ToolMessage, AIMessage


INTEGRATION_TEST = os.environ.get("INTEGRATION_TEST", "").lower() in (
    "true", "1", "yes"
)


# ═══════════════════════════════════════════════════════════
# Layer 1: Tool-filtering tests (no LLM required)
# ═══════════════════════════════════════════════════════════

class TestToolFiltering:
    """Verify get_tools_for_role() enforces correct tool access per role."""

    def _tool_names(self, tools: list) -> list[str]:
        return sorted(t.name for t in tools)

    # ── SUPPORT_OPS: read-only ────────────────────────────

    def test_support_ops_only_read_only_tools(self):
        """SUPPORT_OPS must only have the first 5 read-only tools."""
        from src.tools import get_tools_for_role
        tools = get_tools_for_role("SUPPORT_OPS")
        names = self._tool_names(tools)

        assert len(tools) == 5, (
            f"SUPPORT_OPS should have exactly 5 tools, got {len(tools)}: {names}"
        )

        # Must have read tools
        for t in ("search_salesforce_cases", "get_case_details",
                   "get_customer_context", "search_knowledge_base",
                   "search_similar_tickets"):
            assert t in names, f"SUPPORT_OPS should have '{t}'"

        # Must NOT have mutation tools
        for t in ("draft_case_reply", "create_case", "update_case", "escalate_case"):
            assert t not in names, f"SUPPORT_OPS should NOT have '{t}'"

    # ── SUPPORT_AGENT: all except escalate ────────────────

    def test_support_agent_has_no_escalate(self):
        """SUPPORT_AGENT must have all tools except escalate_case."""
        from src.tools import get_tools_for_role
        from src.support import SUPPORT_TOOLS
        tools = get_tools_for_role("SUPPORT_AGENT")
        names = self._tool_names(tools)

        assert "escalate_case" not in names, (
            "SUPPORT_AGENT should not have escalate_case"
        )
        # Should have everything else
        assert "search_salesforce_cases" in names
        assert "draft_case_reply" in names
        assert "create_case" in names
        assert "update_case" in names

        assert len(tools) == len(SUPPORT_TOOLS) - 1, (
            f"SUPPORT_AGENT should have {len(SUPPORT_TOOLS) - 1} tools (all except escalate)"
        )

    # ── TEAM_LEAD: all tools ──────────────────────────────

    def test_team_lead_has_all_tools(self):
        """TEAM_LEAD must have all 9 tools including escalate_case."""
        from src.tools import get_tools_for_role
        from src.support import SUPPORT_TOOLS
        tools = get_tools_for_role("TEAM_LEAD")
        names = self._tool_names(tools)

        assert "escalate_case" in names, "TEAM_LEAD must have escalate_case"
        assert len(tools) == len(SUPPORT_TOOLS), (
            f"TEAM_LEAD should have all {len(SUPPORT_TOOLS)} tools"
        )

    # ── ADMIN: all tools ─────────────────────────────────

    def test_admin_has_all_tools(self):
        """ADMIN must have all 9 tools."""
        from src.tools import get_tools_for_role
        from src.support import SUPPORT_TOOLS
        tools = get_tools_for_role("ADMIN")
        assert len(tools) == len(SUPPORT_TOOLS)

    # ── Unknown role: no tools ────────────────────────────

    def test_unknown_role_gets_no_tools(self):
        """Unknown role must return empty tool list."""
        from src.tools import get_tools_for_role
        assert get_tools_for_role("UNKNOWN") == []
        assert get_tools_for_role("") == []
        assert get_tools_for_role(None) == []

    # ── Case sensitivity ─────────────────────────────────

    def test_role_case_insensitive(self):
        """Role lookup must be case-insensitive."""
        from src.tools import get_tools_for_role
        upper = self._tool_names(get_tools_for_role("SUPPORT_AGENT"))
        lower = self._tool_names(get_tools_for_role("support_agent"))
        mixed = self._tool_names(get_tools_for_role("Support_Agent"))
        assert upper == lower == mixed, "Role lookup must be case-insensitive"


# ═══════════════════════════════════════════════════════════
# Helpers (shared by integration tests)
# ═══════════════════════════════════════════════════════════

def _tool_was_called(messages: list, tool_name: str) -> bool:
    """Check if a specific tool was called in the conversation."""
    for m in messages:
        if hasattr(m, "tool_calls") and m.tool_calls:
            for tc in m.tool_calls:
                if tc.get("name") == tool_name:
                    return True
    return False


def _any_tool_called(messages: list) -> list[str]:
    """Return list of all tool names called in the conversation."""
    tools = []
    for m in messages:
        if hasattr(m, "tool_calls") and m.tool_calls:
            for tc in m.tool_calls:
                name = tc.get("name")
                if name and name not in tools:
                    tools.append(name)
    return tools


def _last_text(messages: list) -> str:
    """Extract text content from the last message in the conversation."""
    if not messages:
        return ""
    last = messages[-1]
    if hasattr(last, "content") and last.content:
        if isinstance(last.content, str):
            return last.content
        if isinstance(last.content, list):
            texts = [
                b.get("text", "")
                for b in last.content
                if isinstance(b, dict)
            ]
            return " ".join(texts).strip()
    return ""


# ═══════════════════════════════════════════════════════════
# Layer 2: Integration smoke tests (real LLM, structural checks)
# ═══════════════════════════════════════════════════════════

@pytest.mark.skipif(
    not INTEGRATION_TEST,
    reason="Set INTEGRATION_TEST=true to run real LLM integration tests",
)
@pytest.mark.asyncio
class TestToolSelectionIntegration:
    """
    Integration smoke tests — verify the graph runs end-to-end with the real LLM.

    These tests do NOT assert which specific tool the LLM selects (routing is
    non-deterministic with real LLMs). Instead they verify:
      - The graph completes without raising exceptions
      - A non-empty response is generated
      - Forbidden tools (based on the user's role) are never called
    """

    async def _invoke(self, graph, message: str, role: str = "SUPPORT_AGENT") -> dict:
        return await graph.ainvoke({
            "messages": [{"role": "human", "content": message}],
            "user_id": "test-tool-selection",
            "user_role": role,
            "step_count": 0,
        })

    # ── Case 1: Customer context query ─────────────────────

    async def test_customer_context_query_routes_to_search_or_context(self):
        """Smoke: context query must return a non-empty response and not call
        escalate_case or create_case (not available to the SUPPORT_AGENT via
        create_case, but actually SUPPORT_AGENT does have create_case).
        For SUPPORT_AGENT, the real security boundary is escalate_case."""
        from src.graph import graph
        result = await self._invoke(graph, "Tell me about Acme Corp", "SUPPORT_AGENT")
        messages = result.get("messages", [])

        # Graph must produce messages
        assert len(messages) > 0, "Expected at least one message in response"

        # SUPPORT_AGENT doesn't have escalate_case
        assert not _tool_was_called(messages, "escalate_case"), (
            "escalate_case should NOT be called for SUPPORT_AGENT"
        )

    # ── Case 2: Open issues query ─────────────────────────

    async def test_open_issues_query_returns_response(self):
        """Smoke: open issues query must return a non-empty response."""
        from src.graph import graph
        result = await self._invoke(
            graph, "Do we have any open issues with TechNova?", "SUPPORT_AGENT"
        )
        messages = result.get("messages", [])

        assert len(messages) > 0, "Expected at least one message in response"

        # Must not call escalation (not in SUPPORT_AGENT's tools)
        assert not _tool_was_called(messages, "escalate_case"), (
            "escalate_case should NOT be called for SUPPORT_AGENT"
        )

    # ── Case 3: Draft reply ───────────────────────────────

    async def test_draft_reply_does_not_auto_update(self):
        """Smoke: reply request must never auto-send an update_case."""
        from src.graph import graph
        result = await self._invoke(
            graph, "Write a reply to case 00012345", "SUPPORT_AGENT"
        )
        messages = result.get("messages", [])

        assert len(messages) > 0, "Expected at least one message"

        # Critical security property: update_case must NOT be called
        # (drafts must not auto-send)
        assert not _tool_was_called(messages, "update_case"), (
            "update_case should NOT be called — drafts must not auto-send"
        )

        # escalate_case also not available to SUPPORT_AGENT
        assert not _tool_was_called(messages, "escalate_case"), (
            "escalate_case should NOT be called for SUPPORT_AGENT"
        )

    # ── Case 4: SUPPORT_OPS cannot mutate ──────────────────

    async def test_support_ops_cannot_mutate_cases(self):
        """Smoke: SUPPORT_OPS must not call mutation tools (already verified
        by tool filter — this confirms the LLM also respects the boundary)."""
        from src.graph import graph
        result = await self._invoke(
            graph,
            "Update the priority of case 00012345 to Critical",
            "SUPPORT_OPS",
        )
        messages = result.get("messages", [])

        # SUPPORT_OPS does NOT have create/update/escalate tools
        for forbidden in ("update_case", "create_case", "escalate_case"):
            assert not _tool_was_called(messages, forbidden), (
                f"SUPPORT_OPS should NOT call '{forbidden}'"
            )

        # There should be some text response explaining
        text = _last_text(messages)
        assert text, "Expected a text response"

    # ── Case 5: SUPPORT_AGENT cannot escalate ──────────────

    async def test_support_agent_cannot_approve_escalations(self):
        """Smoke: SUPPORT_AGENT must not call escalate_case (not in their tools)."""
        from src.graph import graph
        result = await self._invoke(
            graph,
            "Show me all escalations pending my approval",
            "SUPPORT_AGENT",
        )
        messages = result.get("messages", [])

        # SUPPORT_AGENT does not have escalate_case
        assert not _tool_was_called(messages, "escalate_case"), (
            "escalate_case should NOT be called for SUPPORT_AGENT"
        )
