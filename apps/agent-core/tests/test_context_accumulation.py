"""
Context accumulation tests.

Verifies that __ui__ blocks and other UI-only data do NOT accumulate
in message history. Tests the strip_ui_from_messages() function directly
rather than running the full graph with a real LLM.

strip_ui_from_messages() (Pattern 7) is called inside call_agent()
before passing messages to the LLM. It strips:
  - __ui__ keys from ToolMessage JSON content
  - embedding vectors (which add noise to context)
  - embedding fields nested inside product items
"""
import json
import os
import pytest
from langchain_core.messages import ToolMessage, AIMessage, HumanMessage


# ═══════════════════════════════════════════════════════════
# Helper: build a realistic ToolMessage with __ui__ payload
# ═══════════════════════════════════════════════════════════

def _make_tool_message(content_dict: dict, name: str = "search_salesforce_cases") -> ToolMessage:
    """Create a ToolMessage with JSON content (as support tools return)."""
    return ToolMessage(
        content=json.dumps(content_dict),
        name=name,
        tool_call_id="test-call-id",
    )


def _make_case_result_with_ui() -> dict:
    """A realistic tool result with __ui__ and embeddings."""
    return {
        "cases": [
            {
                "caseNumber": "00001001",
                "subject": "Login issue",
                "status": "Open",
            },
        ],
        "count": 1,
        "__ui__": {
            "name": "case-list",
            "props": {"cases": [{"caseNumber": "00001001", "subject": "Login issue"}]},
        },
    }


def _make_case_result_with_all_fields() -> dict:
    """A realistic tool result with __ui__, embedding, and product embeddings."""
    return {
        "cases": [
            {
                "caseNumber": "00001001",
                "subject": "Login issue",
            },
        ],
        "count": 1,
        "embedding": [0.1, 0.2, 0.3],
        "products": [
            {"id": 1, "name": "Widget", "embedding": [0.4, 0.5, 0.6]},
            {"id": 2, "name": "Gadget", "embedding": [0.7, 0.8, 0.9]},
        ],
        "__ui__": {
            "name": "case-list",
            "props": {"cases": [{"caseNumber": "00001001", "subject": "Login issue"}]},
        },
    }


# ═══════════════════════════════════════════════════════════
# Tests — all call strip_ui_from_messages() directly
# ═══════════════════════════════════════════════════════════

class TestContextAccumulation:
    """Verify strip_ui_from_messages correctly removes UI-only data."""

    # ── __ui__ stripping ───────────────────────────────────

    def test_strip_ui_from_tool_message(self):
        """__ui__ key must be removed from ToolMessage JSON content."""
        from src.graph import strip_ui_from_messages

        msg = _make_tool_message(_make_case_result_with_ui())
        result = strip_ui_from_messages([msg])
        assert len(result) == 1

        stripped = json.loads(result[0].content)
        assert "__ui__" not in stripped, (
            "__ui__ must be stripped from tool message content. "
            f"Keys: {list(stripped.keys())}"
        )
        # Other data must be preserved
        assert "cases" in stripped, "cases data must be preserved"

    def test_strip_ui_preserves_tool_data(self):
        """Non-UI fields like cases, count must survive stripping."""
        from src.graph import strip_ui_from_messages

        msg = _make_tool_message(_make_case_result_with_ui())
        result = strip_ui_from_messages([msg])
        stripped = json.loads(result[0].content)

        assert stripped["count"] == 1
        assert len(stripped["cases"]) == 1
        assert stripped["cases"][0]["caseNumber"] == "00001001"

    def test_strip_ui_leaves_non_tool_messages_untouched(self):
        """Human and AI messages must not be modified."""
        from src.graph import strip_ui_from_messages

        human = HumanMessage(content="Show me cases for Acme")
        ai = AIMessage(content="Here are the cases for Acme Corp")

        result = strip_ui_from_messages([human, ai])
        assert len(result) == 2
        assert result[0].content == "Show me cases for Acme"
        assert result[1].content == "Here are the cases for Acme Corp"

    # ── Embedding stripping ────────────────────────────────

    def test_strip_embedding_from_tool_message(self):
        """Top-level embedding field must be removed."""
        from src.graph import strip_ui_from_messages

        msg = _make_tool_message(_make_case_result_with_all_fields())
        result = strip_ui_from_messages([msg])
        stripped = json.loads(result[0].content)

        assert "embedding" not in stripped, (
            "embedding must be stripped from tool message"
        )

    def test_strip_product_embeddings(self):
        """Nested embedding fields inside product items must be removed."""
        from src.graph import strip_ui_from_messages

        msg = _make_tool_message(_make_case_result_with_all_fields())
        result = strip_ui_from_messages([msg])
        stripped = json.loads(result[0].content)

        for product in stripped.get("products", []):
            assert "embedding" not in product, (
                f"embedding must be stripped from product: {product}"
            )

    # ── Multiple messages ──────────────────────────────────

    def test_strip_multiple_tool_messages(self):
        """All tool messages in a list must have __ui__ stripped."""
        from src.graph import strip_ui_from_messages

        msgs = [
            _make_tool_message(_make_case_result_with_ui(), "search_salesforce_cases"),
            _make_tool_message(_make_case_result_with_ui(), "get_case_details"),
            HumanMessage(content="thanks"),
        ]
        result = strip_ui_from_messages(msgs)
        assert len(result) == 3

        for i in range(2):
            stripped = json.loads(result[i].content)
            assert "__ui__" not in stripped, (
                f"__ui__ must be stripped from msg {i}"
            )
        # Human message untouched
        assert result[2].content == "thanks"

    # ── Edge cases ─────────────────────────────────────────

    def test_strip_empty_messages(self):
        """Empty message list must return empty list."""
        from src.graph import strip_ui_from_messages
        assert strip_ui_from_messages([]) == []

    def test_strip_non_json_tool_content(self):
        """ToolMessage with non-JSON content must pass through unchanged."""
        from src.graph import strip_ui_from_messages

        msg = ToolMessage(
            content="plain text response",
            name="some_tool",
            tool_call_id="test-call-id",
        )
        result = strip_ui_from_messages([msg])
        assert result[0].content == "plain text response"

    def test_strip_no_ui_in_content(self):
        """ToolMessage without __ui__ key must remain unchanged."""
        from src.graph import strip_ui_from_messages

        msg = _make_tool_message({"cases": [], "count": 0})
        result = strip_ui_from_messages([msg])
        assert json.loads(result[0].content) == {"cases": [], "count": 0}

    def test_strip_ui_does_not_break_other_json_keys(self):
        """All non-UI, non-embedding JSON keys must survive."""
        from src.graph import strip_ui_from_messages

        data = {
            "cases": [{"id": 1}],
            "count": 5,
            "metadata": {"page": 1},
            "__ui__": {"name": "test"},
            "embedding": [0.1],
        }
        msg = _make_tool_message(data)
        result = strip_ui_from_messages([msg])
        stripped = json.loads(result[0].content)

        assert "cases" in stripped
        assert "count" in stripped
        assert "metadata" in stripped
        assert stripped["metadata"]["page"] == 1
