"""
SupportPilot - Role-based tool filtering tests.

Tests for get_tools_for_role() which now only handles support roles.
"""
import pytest
from src.tools import get_tools_for_role, ALL_TOOLS


SUPPORT_TOOL_NAMES = [
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


class TestGetToolsForRole:
    """Test role-based tool filtering for support roles."""

    def test_support_agent_gets_8_tools(self):
        """SUPPORT_AGENT should get all tools except escalate."""
        tools = get_tools_for_role("SUPPORT_AGENT")
        tool_names = [t.name for t in tools]

        assert len(tool_names) == 8
        for name in SUPPORT_TOOL_NAMES[:-1]:
            assert name in tool_names, f"SUPPORT_AGENT should have {name}"
        assert "escalate_case" not in tool_names

    def test_team_lead_gets_all_9_tools(self):
        """TEAM_LEAD should get all 9 tools including escalate."""
        tools = get_tools_for_role("TEAM_LEAD")
        tool_names = [t.name for t in tools]

        assert len(tool_names) == 9
        for name in SUPPORT_TOOL_NAMES:
            assert name in tool_names, f"TEAM_LEAD should have {name}"

    def test_support_ops_gets_5_read_only_tools(self):
        """SUPPORT_OPS should get 5 read-only tools (no create/update/escalate)."""
        tools = get_tools_for_role("SUPPORT_OPS")
        tool_names = [t.name for t in tools]

        assert len(tool_names) == 5
        read_only = SUPPORT_TOOL_NAMES[:5]
        mutations = SUPPORT_TOOL_NAMES[5:]
        for name in read_only:
            assert name in tool_names, f"SUPPORT_OPS should have {name}"
        for name in mutations:
            assert name not in tool_names, f"SUPPORT_OPS should NOT have {name}"

    def test_admin_gets_9_support_tools(self):
        """ADMIN role should get all 9 support tools."""
        tools = get_tools_for_role("ADMIN")
        tool_names = [t.name for t in tools]

        assert len(tool_names) == len(ALL_TOOLS)
        for name in SUPPORT_TOOL_NAMES:
            assert name in tool_names

    def test_unknown_role_gets_empty(self):
        """Unknown role should get empty tool list (security)."""
        tools = get_tools_for_role("UNKNOWN")
        assert tools == []

    def test_case_insensitive_role(self):
        """Role matching should be case-insensitive."""
        tools_upper = get_tools_for_role("SUPPORT_AGENT")
        tools_lower = get_tools_for_role("support_agent")
        tools_mixed = get_tools_for_role("Support_Agent")

        names_upper = [t.name for t in tools_upper]
        names_lower = [t.name for t in tools_lower]
        names_mixed = [t.name for t in tools_mixed]

        assert names_upper == names_lower
        assert names_lower == names_mixed

    def test_procurement_roles_return_empty(self):
        """Old procurement roles (EMPLOYEE, MANAGER, FINANCE) should get no tools."""
        for role in ("EMPLOYEE", "MANAGER", "FINANCE"):
            tools = get_tools_for_role(role)
            assert tools == [], f"{role} should get no tools"
