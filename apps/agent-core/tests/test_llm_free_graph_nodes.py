"""
LLM-free unit tests for individual LangGraph graph node functions.

Tests all pure (non-LLM) functions from src.graph in isolation:
  - strip_ui_from_messages   — strip UI payloads and embeddings from tool results
  - build_system_prompt      — compose the dynamic system prompt
  - load_context_node        — pass-through entry node
  - should_continue          — conditional edge router (END vs "tools")
  - check_approval_needed    — HITL conditional router
  - check_approval_node      — scan tool results for requiresApproval flag
  - approval_gate_node       — HITL interrupt node (interrupt mocked)

No LLM calls, no Docker, no database. All external deps mocked.
"""

import json
from unittest.mock import patch

import pytest
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

from src.graph import (
    approval_gate_node,
    build_system_prompt,
    check_approval_needed,
    check_approval_node,
    load_context_node,
    should_continue,
    strip_ui_from_messages,
)
from tests.llm_free.fixtures import (
    AIMessageStub,
    APPROVAL_STATE,
    EMPTY_STATE,
    HIGH_STEP_COUNT_STATE,
    MULTI_TURN_STATE,
    SINGLE_TURN_STATE,
    TOOL_CALLING_STATE,
    ToolCallBuilder,
    build_state,
)


# ─────────────────────────────────────────────────────────────────────
# strip_ui_from_messages  (line 13-38)
# ─────────────────────────────────────────────────────────────────────

class TestStripUiFromMessages:
    """Strip __ui__ and embedding keys from ToolMessage JSON content.

    Edge cases covered beyond the basics in test_context_stripping.py:
    top-level embedding removal, simultaneous __ui__ + embedding stripping,
    and non-dict items in the products list.
    """

    def test_strips_ui_from_tool_message(self):
        """ToolMessage with __ui__ key should have it removed from JSON."""
        content = json.dumps({
            "result": "ok",
            "caseId": "500000000",
            "__ui__": {"name": "case-detail", "props": {}},
        })
        msg = ToolMessage(content=content, tool_call_id="call-1")

        result = strip_ui_from_messages([msg])

        parsed = json.loads(result[0].content)
        assert "__ui__" not in parsed
        assert parsed["result"] == "ok"
        assert parsed["caseId"] == "500000000"

    def test_strips_embedding_from_top_level(self):
        """Top-level embedding key should be stripped from JSON content."""
        content = json.dumps({
            "result": "ok",
            "embedding": [0.1] * 32,
            "caseId": "500000000",
        })
        msg = ToolMessage(content=content, tool_call_id="call-2")

        result = strip_ui_from_messages([msg])

        parsed = json.loads(result[0].content)
        assert "embedding" not in parsed
        assert parsed["caseId"] == "500000000"

    def test_strips_embedding_from_products_items(self):
        """Each dict item in products list should have embedding stripped."""
        content = json.dumps({
            "products": [
                {"id": "p1", "name": "Laptop", "embedding": [0.1, 0.2]},
                {"id": "p2", "name": "Mouse", "embedding": [0.3, 0.4]},
            ],
        })
        msg = ToolMessage(content=content, tool_call_id="call-3")

        result = strip_ui_from_messages([msg])

        parsed = json.loads(result[0].content)
        for item in parsed["products"]:
            assert "embedding" not in item, f"{item['id']} still has embedding"

    def test_strips_both_ui_and_embedding_simultaneously(self):
        """Both __ui__ and embedding should be stripped in one pass."""
        content = json.dumps({
            "result": "ok",
            "embedding": [0.5] * 64,
            "__ui__": {"name": "catalog-grid", "props": {"items": []}},
            "products": [
                {"id": "p1", "embedding": [0.1, 0.2]},
            ],
        })
        msg = ToolMessage(content=content, tool_call_id="call-4")

        result = strip_ui_from_messages([msg])

        parsed = json.loads(result[0].content)
        assert "__ui__" not in parsed
        assert "embedding" not in parsed
        assert "embedding" not in parsed["products"][0]

    def test_leaves_non_json_messages_untouched(self):
        """Non-JSON string content passes through unchanged."""
        msg = ToolMessage(content="This is plain text, not JSON.", tool_call_id="call-5")

        result = strip_ui_from_messages([msg])

        assert result[0].content == "This is plain text, not JSON."

    def test_leaves_messages_without_ui_untouched(self):
        """Valid JSON without __ui__ or embedding keys is preserved."""
        content = json.dumps({"status": "resolved", "caseId": "500000001"})
        msg = ToolMessage(content=content, tool_call_id="call-6")

        result = strip_ui_from_messages([msg])

        assert json.loads(result[0].content) == {"status": "resolved", "caseId": "500000001"}

    def test_handles_non_dict_items_in_products_list(self):
        """Non-dict items (strings, numbers) in products list don't crash."""
        content = json.dumps({
            "products": [
                {"id": "p1", "embedding": [0.1]},
                "not-a-dict",
                42,
                None,
            ],
        })
        msg = ToolMessage(content=content, tool_call_id="call-7")

        result = strip_ui_from_messages([msg])

        parsed = json.loads(result[0].content)
        assert "embedding" not in parsed["products"][0]
        # Non-dict items are left as-is
        assert parsed["products"][1] == "not-a-dict"
        assert parsed["products"][2] == 42

    def test_handles_empty_message_list(self):
        """Empty list returns empty list."""
        result = strip_ui_from_messages([])
        assert result == []


# ─────────────────────────────────────────────────────────────────────
# build_system_prompt  (line 118-128)
# ─────────────────────────────────────────────────────────────────────

class TestBuildSystemPrompt:
    """Build the composite system prompt with dynamic context sections."""

    def test_contains_support_prompt_core_content(self):
        """Output includes the SUPPORT_SYSTEM_PROMPT core rules."""
        result = build_system_prompt("mary@example.com", "dept-eng-001")
        assert "You are SupportPilot" in result
        assert "CORE RULES" in result
        assert "TOOL CALLING" in result
        assert "HUMAN-IN-THE-LOOP" in result

    def test_includes_user_email_and_dept_id(self):
        """Dynamic section contains the caller's email and department."""
        result = build_system_prompt("mary@example.com", "dept-eng-001")
        assert "mary@example.com" in result
        assert "dept-eng-001" in result

    def test_includes_current_date(self):
        """Dynamic section contains today's date in YYYY-MM-DD format."""
        from datetime import date

        result = build_system_prompt("mary@example.com", "dept-eng-001")
        today = date.today().isoformat()
        assert today in result

    def test_structure_separates_static_and_dynamic_sections(self):
        """Static and dynamic prompts are concatenated with separator."""
        result = build_system_prompt("a@b.co", "d-1")
        # The dynamic section appears after the static content ends
        static_tail = "handles rich cards automatically"
        assert static_tail in result
        assert "Current session context" in result
        assert result.index("Current session context") > result.index(static_tail)


# ─────────────────────────────────────────────────────────────────────
# load_context_node  (line 319-324)
# ─────────────────────────────────────────────────────────────────────

class TestLoadContextNode:
    """Entry node that passes state through unchanged."""

    def test_returns_state_unchanged_with_user_id(self):
        """State is returned as-is when user_id is present."""
        result = load_context_node(EMPTY_STATE)
        assert result is EMPTY_STATE or result == EMPTY_STATE

    def test_returns_state_unchanged_without_user_id(self):
        """State is returned as-is when user_id is missing."""
        state = {"messages": [], "step_count": 0, "user_role": None}
        result = load_context_node(state)
        assert result is state or result == state

    def test_preserves_all_state_keys(self):
        """All original state keys survive the pass-through."""
        state = build_state(
            messages=[HumanMessage(content="hi")],
            user_id="test@example.com",
            user_role="TEAM_LEAD",
            step_count=2,
        )
        result = load_context_node(state)
        for key in ("messages", "user_id", "user_role", "step_count"):
            assert key in result


# ─────────────────────────────────────────────────────────────────────
# should_continue  (line 267-274)
# ─────────────────────────────────────────────────────────────────────

class TestShouldContinue:
    """Conditional edge: END if no tool_calls or step_count >= 5, else 'tools'."""

    def test_returns_end_when_last_message_has_no_tool_calls(self):
        """Message with empty tool_calls list → END."""
        state = build_state(
            messages=[AIMessageStub(content="Done.", tool_calls=[])],
            step_count=1,
        )
        assert should_continue(state) == "__end__"

    def test_returns_end_when_last_message_lacks_tool_calls_attr(self):
        """Message type (HumanMessage) without tool_calls attr → END."""
        state = build_state(
            messages=[HumanMessage(content="I need help")],
            step_count=1,
        )
        assert should_continue(state) == "__end__"

    def test_returns_end_when_step_count_is_five(self):
        """Tool_calls present but step_count == 5 → END (guard against loops)."""
        tc = ToolCallBuilder.search_cases()
        state = build_state(
            messages=[AIMessageStub(content="Searching.", tool_calls=[tc])],
            step_count=5,
        )
        assert should_continue(state) == "__end__"

    def test_returns_end_when_step_count_exceeds_five(self):
        """Tool_calls present but step_count > 5 → END."""
        tc = ToolCallBuilder.search_cases()
        state = build_state(
            messages=[AIMessageStub(content="Searching.", tool_calls=[tc])],
            step_count=7,
        )
        assert should_continue(state) == "__end__"

    def test_returns_tools_when_tool_calls_and_step_count_below_limit(self):
        """Tool_calls present and step_count < 5 → 'tools'."""
        tc = ToolCallBuilder.search_cases()
        state = build_state(
            messages=[AIMessageStub(content="Searching.", tool_calls=[tc])],
            step_count=2,
        )
        assert should_continue(state) == "tools"

    def test_preserves_end_reference_from_langgraph(self):
        """The returned END constant matches langgraph.graph.END."""
        from langgraph.graph import END as LG_END

        no_tool_state = build_state(
            messages=[AIMessageStub(content="Done.")],
            step_count=1,
        )
        assert should_continue(no_tool_state) == LG_END


# ─────────────────────────────────────────────────────────────────────
# check_approval_needed  (line 277-281)
# ─────────────────────────────────────────────────────────────────────

class TestCheckApprovalNeeded:
    """Route after tools: 'approval_gate' if requires_approval, else 'summarize'."""

    def test_returns_approval_gate_when_requires_approval_true(self):
        """requires_approval=True routes to the HITL gate."""
        state = build_state(requires_approval=True)
        assert check_approval_needed(state) == "approval_gate"

    def test_returns_summarize_when_requires_approval_is_none(self):
        """Missing requires_approval field routes to summarize."""
        state = build_state()  # no requires_approval set
        assert check_approval_needed(state) == "summarize"

    def test_returns_summarize_when_requires_approval_is_false(self):
        """Explicit False routes to summarize (approval already handled)."""
        state = build_state(requires_approval=False)
        assert check_approval_needed(state) == "summarize"


# ─────────────────────────────────────────────────────────────────────
# check_approval_node  (line 327-352)
# ─────────────────────────────────────────────────────────────────────

class TestCheckApprovalNode:
    """Scan tool results for requiresApproval flag and extract escalation context."""

    def _build_approval_tool_message(
        self,
        case_id: str = "500000000",
        reason: str = "Needs manager review",
        requires_approval: bool = True,
    ) -> ToolMessage:
        """Helper to construct a ToolMessage with approval payload."""
        content = {
            "caseId": case_id,
            "status": "pending_approval" if requires_approval else "completed",
            "requiresApproval": requires_approval,
            "__ui__": {
                "name": "escalation-card",
                "props": {
                    "escalation": {
                        "caseId": case_id,
                        "reason": reason,
                        "escalatedTo": "team-lead@example.com",
                    }
                },
            },
        }
        return ToolMessage(content=json.dumps(content), tool_call_id="call-esc-1")

    def test_detects_requires_approval_and_extracts_context(self):
        """Finds requiresApproval: true and returns escalation context."""
        msg = self._build_approval_tool_message(
            case_id="500000999", reason="Outside support scope"
        )
        state = build_state(messages=[msg])

        result = check_approval_node(state)

        assert result["requires_approval"] is True
        assert result["approval_context"]["case_id"] == "500000999"
        assert result["approval_context"]["reason"] == "Outside support scope"
        assert result["approval_context"]["action_type"] == "escalation"

    def test_returns_empty_dict_when_no_requires_approval(self):
        """ToolMessage without requiresApproval returns empty dict."""
        content = json.dumps({"caseId": "500000000", "status": "resolved"})
        msg = ToolMessage(content=content, tool_call_id="call-1")
        state = build_state(messages=[msg])

        result = check_approval_node(state)

        assert result == {}

    def test_returns_empty_dict_when_no_messages(self):
        """Empty messages list returns empty dict."""
        state = build_state(messages=[])
        result = check_approval_node(state)
        assert result == {}

    def test_handles_malformed_json_gracefully(self):
        """Non-JSON ToolMessage content raises JSONDecodeError; function catches it."""
        msg = ToolMessage(content="NOT_VALID_JSON{{{", tool_call_id="call-1")
        state = build_state(messages=[msg])

        result = check_approval_node(state)

        assert result == {}

    def test_checks_most_recent_message_first_reverse_scan(self):
        """Reverse scan: newer message without flag skipped; older with flag found."""
        older_with_flag = self._build_approval_tool_message(
            case_id="old-001", reason="Old escalation"
        )
        newer_without_flag = ToolMessage(
            content=json.dumps({"caseId": "new-002", "status": "ok"}),
            tool_call_id="call-new-1",
        )
        # Prepend order: older first, newer second. Reverse scan hits
        # newer_without_flag first (skips), then finds older_with_flag.
        state = build_state(messages=[older_with_flag, newer_without_flag])

        result = check_approval_node(state)

        assert result["requires_approval"] is True
        assert result["approval_context"]["case_id"] == "old-001"

    def test_newest_requires_approval_wins_reverse_scan(self):
        """When newest also has requiresApproval, it wins (reverse scan stops early)."""
        older_without = ToolMessage(
            content=json.dumps({"caseId": "old-001", "status": "ok"}),
            tool_call_id="call-old-1",
        )
        newer_with_flag = self._build_approval_tool_message(
            case_id="new-002", reason="New escalation"
        )
        state = build_state(messages=[older_without, newer_with_flag])

        result = check_approval_node(state)

        assert result["requires_approval"] is True
        assert result["approval_context"]["case_id"] == "new-002"

    def test_extracts_default_values_when_escalation_props_missing(self):
        """Missing escalation props fall back to defaults (caseId=unknown, etc.)."""
        content = {
            "requiresApproval": True,
            "__ui__": {
                "name": "escalation-card",
                "props": {},  # no escalation key
            },
        }
        msg = ToolMessage(content=json.dumps(content), tool_call_id="call-1")
        state = build_state(messages=[msg])

        result = check_approval_node(state)

        assert result["requires_approval"] is True
        assert result["approval_context"]["case_id"] == "unknown"
        assert result["approval_context"]["reason"] == ""


# ─────────────────────────────────────────────────────────────────────
# approval_gate_node  (line 284-316)
# ─────────────────────────────────────────────────────────────────────

class TestApprovalGateNode:
    """HITL node that calls interrupt() and returns a SystemMessage.

    The langgraph.types.interrupt function is patched to return a
    deterministic resume value without pausing execution.
    """

    def _call_with_mock_interrupt(self, state: dict, resume_value: str) -> dict:
        """Call approval_gate_node with interrupt patched to return resume_value."""
        with patch("src.graph.interrupt", return_value=resume_value) as mock_interrupt:
            result = approval_gate_node(state)
        return result

    def test_approved_creates_approval_system_message(self):
        """APPROVED decision produces SystemMessage with approval confirmation."""
        state = build_state(
            requires_approval=True,
            approval_context={
                "case_id": "500000000",
                "reason": "Outside scope",
                "action_type": "escalation",
            },
        )

        result = self._call_with_mock_interrupt(state, "APPROVED")

        assert result["requires_approval"] is False
        assert result["approval_context"] is None
        # Should have one SystemMessage
        assert len(result["messages"]) == 1
        msg = result["messages"][0]
        assert isinstance(msg, SystemMessage)
        assert "APPROVED" in msg.content
        assert "approved" in msg.content.lower()
        assert "Proceed with the action" in msg.content

    def test_rejected_creates_rejection_system_message(self):
        """REJECTED decision produces SystemMessage with rejection info."""
        state = build_state(
            requires_approval=True,
            approval_context={
                "case_id": "500000000",
                "reason": "Outside scope",
                "action_type": "escalation",
            },
        )

        result = self._call_with_mock_interrupt(state, "REJECTED")

        assert result["requires_approval"] is False
        assert result["approval_context"] is None
        msg = result["messages"][0]
        assert isinstance(msg, SystemMessage)
        assert "REJECTED" in msg.content
        assert "rejected" in msg.content.lower()
        assert "suggest alternatives" in msg.content

    def test_handles_missing_approval_context_with_defaults(self):
        """When approval_context is missing, uses default values in interrupt payload."""
        state = build_state(requires_approval=True)

        with patch("src.graph.interrupt", return_value="APPROVED") as mock_interrupt:
            result = approval_gate_node(state)

        assert result["requires_approval"] is False
        assert result["approval_context"] is None
        msg = result["messages"][0]
        assert isinstance(msg, SystemMessage)
        assert "APPROVED" in msg.content
        assert "approved" in msg.content.lower()
        # Verify the interrupt was called with defaults
        mock_interrupt.assert_called_once()
        call_kwargs = mock_interrupt.call_args[0][0]
        assert call_kwargs["case_id"] == "unknown"
        assert call_kwargs["action_type"] == "escalation"
        assert call_kwargs["reason"] == ""
