"""
GenUI contract tests — synchronous unit tests (no LLM gating needed).

Validates:
  1. Every support tool emits a valid __ui__ block with name + props
  2. __ui__ blocks are stripped before reaching LLM context
  3. Null/None priority values don't crash JSON or UI rendering
"""
import json
import pytest
from langchain_core.messages import ToolMessage


pytestmark = pytest.mark.asyncio


# ═══════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════

class TestGenUiContracts:
    """Validate GenUI __ui__ contract for all support tools."""

    # ── Test 1: Every tool emits a valid __ui__ block ───────

    @pytest.mark.parametrize("tool_name,tool_func,kwargs", [
        pytest.param(
            "search_salesforce_cases",
            "search_salesforce_cases",
            {"query": "Acme"},
            id="search_salesforce_cases",
        ),
        pytest.param(
            "get_case_details",
            "get_case_details",
            {"case_id": "500000000"},
            id="get_case_details",
        ),
        pytest.param(
            "get_customer_context",
            "get_customer_context",
            {"account_id": "ACC-001"},
            id="get_customer_context",
        ),
        pytest.param(
            "search_knowledge_base",
            "search_knowledge_base",
            {"query": "password reset"},
            id="search_knowledge_base",
        ),
        pytest.param(
            "search_similar_tickets",
            "search_similar_tickets",
            {"query": "payment failed"},
            id="search_similar_tickets",
        ),
        pytest.param(
            "draft_case_reply",
            "draft_case_reply",
            {"case_id": "500000000"},
            id="draft_case_reply",
        ),
        pytest.param(
            "create_case",
            "create_case",
            {"subject": "Test", "description": "Test", "priority": "Low", "account_id": "ACC-001"},
            id="create_case",
        ),
        pytest.param(
            "update_case",
            "update_case",
            {"case_id": "500000000", "fields": {"status": "Closed"}},
            id="update_case",
        ),
        pytest.param(
            "escalate_case",
            "escalate_case",
            {"case_id": "500000000", "reason": "VIP customer escalation"},
            id="escalate_case",
        ),
    ])
    async def test_all_tools_emit_ui_block(self, tool_name, tool_func, kwargs):
        """Each support tool must return a JSON string with __ui__ containing
        name and props keys. This is the GenUI contract for frontend rendering."""
        from src.support.tools import (
            search_salesforce_cases,
            get_case_details,
            get_customer_context,
            search_knowledge_base,
            search_similar_tickets,
            draft_case_reply,
            create_case,
            update_case,
            escalate_case,
        )

        tool_map = {
            "search_salesforce_cases": search_salesforce_cases,
            "get_case_details": get_case_details,
            "get_customer_context": get_customer_context,
            "search_knowledge_base": search_knowledge_base,
            "search_similar_tickets": search_similar_tickets,
            "draft_case_reply": draft_case_reply,
            "create_case": create_case,
            "update_case": update_case,
            "escalate_case": escalate_case,
        }

        tool = tool_map[tool_name]
        result = await tool.coroutine(**kwargs)
        data = json.loads(result)

        # Core contract: __ui__ key MUST exist
        assert "__ui__" in data, (
            f"GenUI FAIL: {tool_name} missing __ui__ key in output"
        )

        ui = data["__ui__"]

        # name key MUST exist and be a non-empty string
        assert "name" in ui, (
            f"GenUI FAIL: {tool_name} __ui__ missing 'name' key"
        )
        assert isinstance(ui["name"], str) and ui["name"], (
            f"GenUI FAIL: {tool_name} __ui__.name must be non-empty string, "
            f"got {ui.get('name')!r}"
        )

        # props key MUST exist and be a dict
        assert "props" in ui, (
            f"GenUI FAIL: {tool_name} __ui__ missing 'props' key"
        )
        assert isinstance(ui["props"], dict), (
            f"GenUI FAIL: {tool_name} __ui__.props must be a dict, "
            f"got {type(ui['props']).__name__}"
        )

        # Re-serialize to verify JSON serializability (no dates, no circular refs)
        roundtrip = json.loads(json.dumps(ui))
        assert roundtrip["name"] == ui["name"], (
            f"GenUI FAIL: {tool_name} __ui__ not roundtrip-safe"
        )

    # ── Test 2: __ui__ stripped before LLM context ──────────

    async def test_ui_block_stripped_before_llm_context(self):
        """Verify that strip_ui_from_messages removes __ui__ from tool results
        before they enter the LLM context window."""
        from src.graph import strip_ui_from_messages

        # Create a mock tool result with __ui__ payload
        tool_content = json.dumps({
            "cases": [{"caseNumber": "00012345", "subject": "Test case"}],
            "count": 1,
            "__ui__": {
                "name": "case-list",
                "props": {"cases": [{"caseNumber": "00012345"}], "totalCount": 1},
            },
        })

        msg = ToolMessage(content=tool_content, tool_call_id="call-test-ui-strip")
        stripped = strip_ui_from_messages([msg])

        assert len(stripped) == 1, "strip_ui_from_messages should return 1 message"

        parsed = json.loads(stripped[0].content)

        # __ui__ must be removed
        assert "__ui__" not in parsed, (
            "GenUI FAIL: __ui__ was NOT stripped from tool result content"
        )

        # Actual data must be preserved
        assert "cases" in parsed, "Tool result data (cases) was lost during stripping"
        assert parsed["count"] == 1, "Tool result data (count) was corrupted during stripping"

    # ── Test 3: Null priority doesn't crash ─────────────────

    async def test_null_priority_in_case_card_does_not_crash(self):
        """Null/None priority values in tool results must not crash JSON
        deserialization or the __ui__ stripping pipeline."""
        from src.graph import strip_ui_from_messages

        # Simulate a tool result where priority is None/null — this can
        # happen for cases where priority hasn't been assigned
        tool_content = json.dumps({
            "case": {
                "caseNumber": "00012345",
                "subject": "Billing inquiry",
                "priority": None,
                "status": "Open",
            },
            "__ui__": {
                "name": "case-detail",
                "props": {
                    "case": {
                        "caseNumber": "00012345",
                        "priority": None,
                    },
                },
            },
        })

        # JSON parsing must handle null — json.loads handles this natively
        parsed = json.loads(tool_content)
        assert parsed["case"]["priority"] is None, (
            "JSON deserialization should preserve null priority as None"
        )

        # strip_ui_from_messages must not crash on null values
        msg = ToolMessage(content=tool_content, tool_call_id="call-null-priority")
        try:
            stripped = strip_ui_from_messages([msg])
        except Exception as exc:
            pytest.fail(
                f"strip_ui_from_messages crashed on null priority: {exc}"
            )

        stripped_parsed = json.loads(stripped[0].content)

        # __ui__ must be removed
        assert "__ui__" not in stripped_parsed, (
            "GenUI FAIL: __ui__ not stripped when priority is null"
        )

        # Null priority must be preserved (it's valid data, not UI)
        assert stripped_parsed["case"]["priority"] is None, (
            "Null priority was corrupted during stripping"
        )

        # Verify roundtrip safety with null values
        roundtrip = json.loads(json.dumps(stripped_parsed))
        assert roundtrip["case"]["priority"] is None, (
            "Null priority failed JSON roundtrip"
        )
