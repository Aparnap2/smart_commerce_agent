"""
Pattern 3: Dynamic Agents - Filter toolset by role

TDD: Tests for role-based tool filtering.
"""
import pytest
from src.tools import get_tools_for_role, ALL_TOOLS


class TestGetToolsForRole:
    """Test role-based tool filtering."""

    def test_employee_gets_base_tools_only(self):
        """EMPLOYEE role should get base tools + PR management, but NOT approval tools."""
        tools = get_tools_for_role("EMPLOYEE")
        tool_names = [t.name for t in tools]
        
        # Should have base tools
        assert "search_catalog" in tool_names
        assert "get_budget_status" in tool_names
        assert "get_purchase_requests" in tool_names
        
        # Should have PR management tools
        assert "manage_purchase_request" in tool_names
        assert "submit_for_approval" in tool_names
        assert "raise_dispute" in tool_names
        
        # Should NOT have approval tools (security - EMPLOYEE cannot approve)
        assert "process_approval" not in tool_names

    def test_manager_gets_all_tools(self):
        """MANAGER role should get all tools including process_approval."""
        tools = get_tools_for_role("MANAGER")
        tool_names = [t.name for t in tools]
        
        # Should have ALL tools
        assert "search_catalog" in tool_names
        assert "get_budget_status" in tool_names
        assert "manage_purchase_request" in tool_names
        assert "submit_for_approval" in tool_names
        assert "get_purchase_requests" in tool_names
        assert "process_approval" in tool_names
        assert "raise_dispute" in tool_names

    def test_admin_gets_all_tools(self):
        """ADMIN role should get all tools."""
        tools = get_tools_for_role("ADMIN")
        tool_names = [t.name for t in tools]
        
        assert "process_approval" in tool_names
        assert len(tool_names) == len(ALL_TOOLS)

    def test_finance_gets_restricted_tools(self):
        """FINANCE role should NOT have submit_for_approval or process_approval."""
        tools = get_tools_for_role("FINANCE")
        tool_names = [t.name for t in tools]
        
        # Base tools OK
        assert "search_catalog" in tool_names
        assert "get_budget_status" in tool_names
        assert "get_purchase_requests" in tool_names
        
        # Cannot submit PRs (employees do that)
        assert "submit_for_approval" not in tool_names
        # Cannot process approvals (managers do that)
        assert "process_approval" not in tool_names

    def test_unknown_role_gets_empty(self):
        """Unknown role should get empty tool list (security)."""
        tools = get_tools_for_role("UNKNOWN")
        
        assert tools == []

    def test_case_insensitive_role(self):
        """Role matching should be case-insensitive."""
        tools_lower = get_tools_for_role("employee")
        tools_upper = get_tools_for_role("EMPLOYEE")
        tools_mixed = get_tools_for_role("Employee")
        
        assert [t.name for t in tools_lower] == [t.name for t in tools_upper]
        assert [t.name for t in tools_upper] == [t.name for t in tools_mixed]