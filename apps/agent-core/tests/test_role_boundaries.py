"""
Role boundary tests.

Verifies hard security boundaries in the tool-access layer (get_tools_for_role)
rather than relying on non-deterministic LLM routing behavior.

These tests are NOT gated behind INTEGRATION_TEST — they test the
tool-filtering logic directly and do not require a real LLM.

Key boundaries verified:
  1. SUPPORT_AGENT cannot access escalate_case (tool not in role)
  2. SUPPORT_OPS is strictly read-only (no create/update tools)
  3. TEAM_LEAD has escalate_case (human-in-the-loop gate)
  4. ADMIN has all tools
  5. Unknown roles get no tools
"""
import json
import os
import pytest


# ═══════════════════════════════════════════════════════════
# Tests — all use get_tools_for_role() directly, no LLM needed
# ═══════════════════════════════════════════════════════════

class TestRoleBoundaries:
    """Hard security boundaries: roles must not access tools outside their scope."""

    # ── Boundary 1: SUPPORT_AGENT cannot escalate ───────────

    def test_support_agent_cannot_approve_escalation(self):
        """SUPPORT_AGENT must NOT have escalate_case in its tool list.
        escalate_case is excluded via SUPPORT_TOOLS[:-1]."""
        from src.tools import get_tools_for_role

        tools = get_tools_for_role("SUPPORT_AGENT")
        tool_names = [t.name for t in tools]

        assert "escalate_case" not in tool_names, (
            "escalate_case must NOT be in SUPPORT_AGENT's tool list. "
            f"Tools: {tool_names}"
        )

        # Double-check: SUPPORT_AGENT has 8 tools (all except escalate)
        from src.support import SUPPORT_TOOLS
        num_expected = len(SUPPORT_TOOLS) - 1
        assert len(tools) == num_expected, (
            f"SUPPORT_AGENT should have {num_expected} tools, "
            f"got {len(tools)}"
        )

    # ── Boundary 2: SUPPORT_OPS is read-only ────────────────

    def test_support_ops_read_only_hard_boundary(self):
        """SUPPORT_OPS must only have read-only tools (first 5).
        create_case, update_case, draft_case_reply, and escalate_case
        must NOT be accessible."""
        from src.tools import get_tools_for_role

        tools = get_tools_for_role("SUPPORT_OPS")
        tool_names = [t.name for t in tools]

        # Verify mutation tools are absent
        for forbidden in ("create_case", "update_case", "draft_case_reply", "escalate_case"):
            assert forbidden not in tool_names, (
                f"'{forbidden}' must NOT be in SUPPORT_OPS's tool list. "
                f"Tools: {tool_names}"
            )

        # Verify read tools are present
        for required in ("search_salesforce_cases", "get_case_details",
                          "get_customer_context", "search_knowledge_base",
                          "search_similar_tickets"):
            assert required in tool_names, (
                f"'{required}' must be in SUPPORT_OPS's tool list"
            )

        # Exactly 5 tools
        assert len(tools) == 5, (
            f"SUPPORT_OPS should have exactly 5 read-only tools, got {len(tools)}"
        )

    # ── Boundary 3: Escalate requires HITL (TEAM_LEAD only) ─

    def test_escalate_triggers_hitl_not_direct_execution(self):
        """Escalate_case must only be available to TEAM_LEAD and ADMIN.
        SUPPORT_AGENT and SUPPORT_OPS must NOT have it.
        This verifies escalate goes through a human-in-the-loop gate
        (TEAM_LEAD approval) rather than being directly callable."""
        from src.tools import get_tools_for_role

        # Roles that should NOT have escalate
        for role in ("SUPPORT_AGENT", "SUPPORT_OPS"):
            tools = get_tools_for_role(role)
            names = [t.name for t in tools]
            assert "escalate_case" not in names, (
                f"'{role}' must NOT have escalate_case"
            )

        # Roles that SHOULD have escalate
        for role in ("TEAM_LEAD", "ADMIN"):
            tools = get_tools_for_role(role)
            names = [t.name for t in tools]
            assert "escalate_case" in names, (
                f"'{role}' should have escalate_case"
            )

    # ── Role-tool mapping completeness ──────────────────────

    def test_all_support_roles_have_tools(self):
        """All defined support roles must return a non-empty tool list."""
        from src.tools import get_tools_for_role

        for role in ("SUPPORT_AGENT", "TEAM_LEAD", "SUPPORT_OPS", "ADMIN"):
            tools = get_tools_for_role(role)
            assert len(tools) > 0, (
                f"Role '{role}' must have at least one tool"
            )

    # ── Unknown role gets no tools ──────────────────────────

    def test_unknown_role_gets_no_tools(self):
        """An unrecognized role must get the empty tool list."""
        from src.tools import get_tools_for_role

        assert get_tools_for_role("BILLING") == []
        assert get_tools_for_role("random") == []
        assert get_tools_for_role("") == []
        assert get_tools_for_role(None) == []

    # ── Role mapping matches SUPPORT_TOOLS ──────────────────

    def test_role_tool_counts_match_support_tools(self):
        """Verify each role's tool count matches the expected slice of SUPPORT_TOOLS."""
        from src.tools import get_tools_for_role
        from src.support import SUPPORT_TOOLS

        n = len(SUPPORT_TOOLS)  # 9
        assert len(get_tools_for_role("SUPPORT_OPS")) == 5  # read-only
        assert len(get_tools_for_role("SUPPORT_AGENT")) == n - 1  # all except escalate
        assert len(get_tools_for_role("TEAM_LEAD")) == n  # all
        assert len(get_tools_for_role("ADMIN")) == n  # all
