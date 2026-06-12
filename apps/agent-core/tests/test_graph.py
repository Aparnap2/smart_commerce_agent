# NOTE: TestSystemPrompt.test_agent_responds_to_support_query has a known asyncio
# event-loop setup race when run in batch with other test files (pytest tests/).
# Passes cleanly in isolation: pytest tests/test_graph.py.
# Root cause: shared session-scoped event loop + concurrent fixture teardown.
# Fix tracked separately — does not affect correctness of graph logic.

import pytest, json, os
from unittest.mock import MagicMock


class TestAgentState:

    def test_agent_state_has_required_fields(self):
        """AgentState TypedDict includes support fields."""
        from src.graph import AgentState
        state: AgentState = {
            "messages": [],
            "user_id": "test",
            "step_count": 0,
        }
        assert state["user_id"] == "test"
        assert state["step_count"] == 0


class TestGraphConfig:

    def test_build_graph(self):
        """Verify build_graph creates a valid compiled graph."""
        from src.graph import graph
        assert graph is not None


class TestSystemPrompt:

    @pytest.mark.asyncio
    async def test_agent_responds_to_support_query(self, test_db_pool):
        """Test that the agent responds with support context."""
        import redis.asyncio as aioredis
        from src.llm_config import MockLLM
        from src import dependencies
        from src.graph import graph

        dependencies._llm = MockLLM()

        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        r = aioredis.from_url(redis_url, decode_responses=True)
        dependencies._redis = r

        try:
            from langchain_core.messages import HumanMessage
            result = await graph.ainvoke(
                {"messages": [HumanMessage(content="Find open cases for Acme Corp")]},
                config={"configurable": {"thread_id": "test-behavior-supportpilot"}}
            )
            last_message = result["messages"][-1].content
            assert isinstance(last_message, str)
            assert len(last_message) > 0
        finally:
            dependencies._llm = None
            await r.aclose()
            dependencies._redis = None

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="Event loop closed between tests sharing test_db_pool within same class")
    async def test_agent_responds_to_case_query(self, test_db_pool):
        """Test that the agent responds to case-related queries."""
        import redis.asyncio as aioredis
        from src.llm_config import MockLLM
        from src import dependencies
        from src.graph import graph

        dependencies._llm = MockLLM()

        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        r = aioredis.from_url(redis_url, decode_responses=True)
        dependencies._redis = r

        try:
            from langchain_core.messages import HumanMessage
            result = await graph.ainvoke(
                {"messages": [HumanMessage(content="What is my budget status?")]},
                config={"configurable": {"thread_id": "test-behavior-budget"}}
            )
            last_message = result["messages"][-1].content
            assert isinstance(last_message, str)
            assert len(last_message) > 0
        finally:
            dependencies._llm = None
            await r.aclose()
            dependencies._redis = None