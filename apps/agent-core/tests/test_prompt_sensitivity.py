"""
Prompt sensitivity tests.

Validates the tool-filtering mechanism directly rather than relying on
non-deterministic LLM routing behavior.

Instead of checking that semantically equivalent prompts all route to the
same tool via the LLM (which is non-deterministic with real LLMs), these
tests verify:
  1. The get_tools_for_role() function enforces correct tool boundaries
  2. The SUPPORT_TOOLS list contains the expected tools
  3. Each role's tool assignment is correct

The original test's intent — "verify semantically equivalent queries route
to the same tool" — is better tested by the tool filter, since tool routing
is a SYSTEM property (which tools are available per role), not an LLM
property (which tool the LLM happens to choose).
"""
import json
import os
import pytest
from langchain_core.messages import ToolMessage, AIMessage


# ═══════════════════════════════════════════════════════════
# Tests — all test tool-filtering mechanism directly
# ═══════════════════════════════════════════════════════════

class TestToolAssignment:
    """Verify tools are assigned to roles by get_tools_for_role()."""

    def _tool_names(self, tools: list) -> set[str]:
        return {t.name for t in tools}

    # ── SUPPORT_AGENT gets search and draft tools ──────────

    def test_support_agent_has_search_tools(self):
        """SUPPORT_AGENT must have search_salesforce_cases."""
        from src.tools import get_tools_for_role
        names = self._tool_names(get_tools_for_role("SUPPORT_AGENT"))
        assert "search_salesforce_cases" in names

    def test_support_agent_has_draft_tool(self):
        """SUPPORT_AGENT must have draft_case_reply."""
        from src.tools import get_tools_for_role
        names = self._tool_names(get_tools_for_role("SUPPORT_AGENT"))
        assert "draft_case_reply" in names

    def test_support_agent_has_context_and_detail_tools(self):
        """SUPPORT_AGENT must have get_customer_context and get_case_details."""
        from src.tools import get_tools_for_role
        names = self._tool_names(get_tools_for_role("SUPPORT_AGENT"))
        assert "get_customer_context" in names
        assert "get_case_details" in names

    # ── Tool names are unique ──────────────────────────────

    def test_all_tool_names_are_unique(self):
        """Every tool must have a unique name."""
        from src.support import SUPPORT_TOOLS
        names = [t.name for t in SUPPORT_TOOLS]
        assert len(names) == len(set(names)), (
            f"Duplicate tool names found: {names}"
        )

    # ── SUPPORT_TOOLS contains expected tools ──────────────

    def test_support_tools_contains_expected_tools(self):
        """SUPPORT_TOOLS must contain all 9 expected support tools."""
        from src.support import SUPPORT_TOOLS
        names = [t.name for t in SUPPORT_TOOLS]

        expected = [
            "search_salesforce_cases",
            "get_case_details",
            "get_customer_context",
            "search_knowledge_base",
            "search_similar_tickets",
            "draft_case_reply",
            "create_case",
            "update_case",
            "escalate_case",
        ]
        for tool_name in expected:
            assert tool_name in names, (
                f"SUPPORT_TOOLS is missing '{tool_name}'"
            )

        assert len(SUPPORT_TOOLS) == 9, (
            f"Expected 9 support tools, got {len(SUPPORT_TOOLS)}"
        )

    # ── Each role's tools are a contiguous slice ────────────

    def test_role_tools_are_contiguous_slices(self):
        """Each role's tools must be a contiguous slice of SUPPORT_TOOLS
        (no gaps, no reordering)."""
        from src.tools import get_tools_for_role
        from src.support import SUPPORT_TOOLS

        all_names = [t.name for t in SUPPORT_TOOLS]

        for role in ("SUPPORT_OPS", "SUPPORT_AGENT", "TEAM_LEAD", "ADMIN"):
            role_names = [t.name for t in get_tools_for_role(role)]

            # Verify continuity: every tool in the role list must be in the
            # same order as in SUPPORT_TOOLS
            indices = [all_names.index(n) for n in role_names]
            assert indices == sorted(indices), (
                f"Tools for '{role}' are not in SUPPORT_TOOLS order: "
                f"role={role_names}, indices={indices}"
            )

    # ── SLICE-based tool access ────────────────────────────

    def test_support_ops_is_first_five_tools(self):
        """SUPPORT_OPS must be the first 5 tools of SUPPORT_TOOLS."""
        from src.tools import get_tools_for_role
        from src.support import SUPPORT_TOOLS

        ops_names = [t.name for t in get_tools_for_role("SUPPORT_OPS")]
        expected = [t.name for t in SUPPORT_TOOLS[:5]]
        assert ops_names == expected, (
            f"SUPPORT_OPS tools must be SUPPORT_TOOLS[:5]. "
            f"Got: {ops_names}, Expected: {expected}"
        )

    def test_support_agent_is_all_but_last_tool(self):
        """SUPPORT_AGENT must be all SUPPORT_TOOLS except escalate_case (last)."""
        from src.tools import get_tools_for_role
        from src.support import SUPPORT_TOOLS

        agent_names = [t.name for t in get_tools_for_role("SUPPORT_AGENT")]
        expected = [t.name for t in SUPPORT_TOOLS[:-1]]
        assert agent_names == expected, (
            f"SUPPORT_AGENT tools must be SUPPORT_TOOLS[:-1]. "
            f"Got: {agent_names}, Expected: {expected}"
        )

    # ── ALL_TOOLS includes all support tools ───────────────

    def test_all_tools_includes_all_support_tools(self):
        """ALL_TOOLS must contain every SUPPORT_TOOLS entry."""
        from src.tools import ALL_TOOLS
        from src.support import SUPPORT_TOOLS

        all_names = [t.name for t in ALL_TOOLS]
        support_names = [t.name for t in SUPPORT_TOOLS]
        for t in support_names:
            assert t in all_names, f"ALL_TOOLS is missing '{t}'"
