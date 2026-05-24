"""
Pattern 7: Avoid Context Failure - Strip __ui__ from tool results before LLM context

TDD: Tests for stripping UI payload from tool results.
"""
import json
import pytest
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from src.graph import strip_ui_from_messages


class TestStripUiFromMessages:
    """Test __ui__ stripping from messages."""

    def test_strips_ui_from_tool_message_content(self):
        """ToolMessage with __ui__ in content should have it stripped."""
        tool_content = json.dumps({
            "result": "success",
            "products": [{"name": "Laptop", "price": 50000}],
            "__ui__": {"name": "catalog-grid", "props": {"products": []}}
        })
        msg = ToolMessage(content=tool_content, tool_call_id="call-123")
        
        result = strip_ui_from_messages([msg])
        
        assert len(result) == 1
        parsed = json.loads(result[0].content)
        assert "result" in parsed
        assert "__ui__" not in parsed
        assert "products" in parsed  # Keep actual data

    def test_preserves_non_json_content(self):
        """Non-JSON content should be preserved as-is."""
        msg = ToolMessage(content="Simple text response", tool_call_id="call-123")
        
        result = strip_ui_from_messages([msg])
        
        assert result[0].content == "Simple text response"

    def test_preserves_messages_without_ui(self):
        """Messages without __ui__ should be unchanged."""
        msg = ToolMessage(content='{"status": "ok"}', tool_call_id="call-123")
        
        result = strip_ui_from_messages([msg])
        
        assert json.loads(result[0].content) == {"status": "ok"}

    def test_strips_embedding_from_tool_message(self):
        """Embedding field should be stripped to reduce context noise."""
        tool_content = json.dumps({
            "products": [{"name": "Item", "embedding": [0.1] * 1536}],
            "__ui__": {"name": "test"}
        })
        msg = ToolMessage(content=tool_content, tool_call_id="call-123")
        
        result = strip_ui_from_messages([msg])
        
        parsed = json.loads(result[0].content)
        assert "embedding" not in parsed["products"][0]

    def test_handles_human_and_ai_messages(self):
        """HumanMessage and AIMessage should pass through unchanged."""
        human = HumanMessage(content="I need a laptop")
        ai = AIMessage(content="Let me search for you")
        
        result = strip_ui_from_messages([human, ai])
        
        assert result[0].content == "I need a laptop"
        assert result[1].content == "Let me search for you"

    def test_handles_empty_message_list(self):
        """Empty list should return empty list."""
        result = strip_ui_from_messages([])
        assert result == []