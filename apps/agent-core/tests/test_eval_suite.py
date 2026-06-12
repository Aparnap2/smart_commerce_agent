"""
Eval Test Suite for SupportPilot — binary pass/fail scoring for support agent behaviors.
Tests cover support-specific failure modes.
"""
import pytest
from src.eval_suite import EVAL_CASES, evaluate_response


class TestEvalSuite:
    """Test evaluation suite for SupportPilot support agent."""

    def test_eval_cases_exist(self):
        """Should have 10 evaluation cases."""
        assert len(EVAL_CASES) == 10

    def test_agent_cannot_escalate(self):
        """Failure mode: Wrong tool selection - SUPPORT_AGENT tries escalate_case."""
        case = next(c for c in EVAL_CASES if c["name"] == "agent_cannot_escalate")
        result = evaluate_response(
            user_input=case["input"],
            role="SUPPORT_AGENT",
            tool_calls=[{"name": "escalate_case", "args": {"case_id": "500ABC"}}],
        )
        assert result["passed"] is False
        assert result["failure_mode"] == "wrong_tool_selection"

    def test_team_lead_can_escalate(self):
        """TEAM_LEAD should be able to escalate."""
        case = next(c for c in EVAL_CASES if c["name"] == "team_lead_can_escalate")
        result = evaluate_response(
            user_input=case["input"],
            role="TEAM_LEAD",
            tool_calls=[{"name": "escalate_case", "args": {"case_id": "500ABC"}}],
        )
        assert result["passed"] is True

    def test_search_before_create(self):
        """Should search before creating a new case for an existing issue."""
        case = next(c for c in EVAL_CASES if c["name"] == "search_before_create")
        result = evaluate_response(
            user_input=case["input"],
            role=case["role"],
            tool_calls=[{"name": "create_case", "args": {"subject": "Billing issue"}}],
        )
        assert result["passed"] is False  # Should fail — create without search

    def test_get_customer_context(self):
        """Should fetch customer context when asked about a customer."""
        case = next(c for c in EVAL_CASES if c["name"] == "get_customer_context_on_query")
        result = evaluate_response(
            user_input=case["input"],
            role=case["role"],
            tool_calls=[{"name": "get_customer_context", "args": {"account_id": "Acme Corp"}}],
        )
        assert result["passed"] is True

    def test_kb_search_for_troubleshooting(self):
        """Should search KB for how-to questions."""
        case = next(c for c in EVAL_CASES if c["name"] == "kb_search_for_troubleshooting")
        result = evaluate_response(
            user_input=case["input"],
            role=case["role"],
            tool_calls=[{"name": "search_knowledge_base", "args": {"query": "reset password"}}],
        )
        assert result["passed"] is True

    def test_case_details_by_number(self):
        """Should get case details when a case number is provided."""
        case = next(c for c in EVAL_CASES if c["name"] == "case_details_by_number")
        result = evaluate_response(
            user_input=case["input"],
            role=case["role"],
            tool_calls=[{"name": "get_case_details", "args": {"case_id": "500ABC"}}],
        )
        assert result["passed"] is True

    def test_support_ops_read_only(self):
        """SUPPORT_OPS should not have create/update/escalate tools."""
        case = next(c for c in EVAL_CASES if c["name"] == "support_ops_read_only")
        result = evaluate_response(
            user_input=case["input"],
            role="SUPPORT_OPS",
            tool_calls=[{"name": "create_case", "args": {"subject": "New case"}}],
        )
        assert result["passed"] is False
