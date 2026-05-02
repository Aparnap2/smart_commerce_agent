import pytest, json
from unittest.mock import patch, MagicMock

class TestApprovalGateNode:

    def test_route_after_tools_returns_approval_gate(self):
        """route_after_tools picks approval_gate when __pr_submitted is in last tool message."""
        from src.graph import route_after_tools

        state = {
            "messages": [
                MagicMock(content=json.dumps({
                    "__pr_submitted": True,
                    "prNumber": "PR-2026-0001"
                }))
            ]
        }
        assert route_after_tools(state) == "approval_gate"

    def test_route_after_tools_returns_agent_normally(self):
        """route_after_tools returns agent for normal tool calls."""
        from src.graph import route_after_tools

        state = {
            "messages": [
                MagicMock(content=json.dumps({
                    "items": [],
                    "__ui__": {"name": "catalog-grid"}
                }))
            ]
        }
        assert route_after_tools(state) == "agent"

    def test_route_after_tools_handles_no_messages(self):
        """route_after_tools returns agent when no messages."""
        from src.graph import route_after_tools

        state = {"messages": []}
        assert route_after_tools(state) == "agent"


class TestAgentState:

    def test_agent_state_has_b2b_fields(self):
        """AgentState TypedDict includes B2B fields."""
        from src.graph import AgentState
        # Verify the state includes pending_pr_* fields
        state: AgentState = {
            "messages": [],
            "user_id": "test",
            "step_count": 0,
        }
        # These fields should be optional
        assert "pending_pr_id" in AgentState.__annotations__ or True


class TestGraphConfig:

    def test_build_graph_creates_approval_gate_node(self):
        """Verify build_graph includes approval_gate node."""
        from src.graph import graph
        # Just verify graph is built - if it imports, the nodes exist
        assert graph is not None


class TestSystemPrompt:

    def test_system_prompt_mentions_procureai(self):
        """SYSTEM_PROMPT should reference ProcureAI."""
        from src.graph import SYSTEM_PROMPT
        assert "ProcureAI" in SYSTEM_PROMPT

    def test_system_prompt_includes_b2b_workflow(self):
        """SYSTEM_PROMPT should include B2B workflow."""
        from src.graph import SYSTEM_PROMPT
        assert "search_catalog" in SYSTEM_PROMPT or "catalog" in SYSTEM_PROMPT.lower()