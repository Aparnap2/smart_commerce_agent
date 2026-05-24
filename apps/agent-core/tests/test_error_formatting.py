"""
Pattern 9: Feed Errors Into Context - format errors as natural language

TDD: Tests for error formatting with natural language and suggestions.
"""
import json
import pytest
from src.tools import format_error_response


class TestFormatErrorResponse:
    """Test error response formatting."""

    def test_budget_exceeded_includes_suggestion(self):
        """Budget exceeded error should include helpful suggestion."""
        error_data = {
            "error": "budget_exceeded",
            "remaining": 50000,
            "requested": 120000
        }
        result = json.loads(format_error_response(error_data))
        
        assert result["error"] is True
        assert "message" in result
        assert "suggestion" in result
        assert "budget" in result["message"].lower()
        assert "lower-cost" in result["suggestion"].lower() or "split" in result["suggestion"].lower()

    def test_user_not_found_includes_help(self):
        """User not found should suggest checking email."""
        error_data = {"error": "User not found", "email": "test@company.com"}
        result = json.loads(format_error_response(error_data))
        
        assert result["error"] is True
        assert "message" in result
        assert "suggestion" in result
        assert "email" in result["suggestion"].lower()

    def test_catalog_item_not_found_suggests_search(self):
        """Item not found should suggest broader search."""
        error_data = {"error": "Catalog item not found", "item_id": "xyz"}
        result = json.loads(format_error_response(error_data))
        
        assert result["error"] is True
        assert "suggestion" in result
        assert "search" in result["suggestion"].lower() or "browse" in result["suggestion"].lower()

    def test_pr_not_in_draft_status(self):
        """PR not in DRAFT status should explain what statuses are allowed."""
        error_data = {"error": "PR is not in DRAFT status", "current_status": "SUBMITTED"}
        result = json.loads(format_error_response(error_data))
        
        assert result["error"] is True
        assert "message" in result
        assert "suggestion" in result

    def test_insufficient_role_includes_who_can(self):
        """Insufficient role error should mention who has permission."""
        error_data = {"error": "Only MANAGER or ADMIN can approve PRs", "current_role": "EMPLOYEE"}
        result = json.loads(format_error_response(error_data))
        
        assert result["error"] is True
        assert "message" in result
        assert "suggestion" in result
        assert "manager" in result["suggestion"].lower()

    def test_preserves_ui_for_compatible_errors(self):
        """Error responses can still include __ui__ for frontend display."""
        error_data = {
            "error": "budget_exceeded",
            "remaining": 50000,
            "__ui__": {"name": "budget-alert", "props": {"remaining": 50000}}
        }
        result = json.loads(format_error_response(error_data))
        
        assert "__ui__" in result
        assert result["__ui__"]["name"] == "budget-alert"

    def test_unknown_error_still_formatted(self):
        """Unknown errors should still be formatted properly."""
        error_data = {"error": "something_went_wrong", "details": "random info"}
        result = json.loads(format_error_response(error_data))
        
        assert result["error"] is True
        assert "message" in result
        assert "suggestion" in result