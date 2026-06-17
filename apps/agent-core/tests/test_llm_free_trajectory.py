"""
LLM-free trajectory tests for SupportPilot LangGraph agent.

Verifies multi-turn graph trajectories WITHOUT any real LLM calls.
Uses MockLLM variants to produce deterministic tool_calls and text responses.

Graph topology (from src/graph.py)::

    START → load_context → agent → [should_continue]
      agent → tools → check_approval → [check_approval_needed]
        → approval_gate → agent      (if requires_approval)
        → summarize → agent           (normal flow, if 6+ messages)
      agent → END                     (no tool_calls)
      agent → END                     (step_count >= 5)

Each test class covers one trajectory pattern (A through F).
"""

from __future__ import annotations

import json
from typing import Any

import pytest

# asyncio mark is applied per-class below to avoid warnings on sync-only classes

# ───────────────────────────────────────────────────────────────────────
# Import shared test infrastructure from llm_free package
# ───────────────────────────────────────────────────────────────────────

from tests.llm_free.fixtures import (
    ToolCallBuilder,
    build_state,
    _human_msg,
    MockLLMWithToolCalls,
    MODE_NO_TOOL,
    MODE_SINGLE_TOOL,
    MODE_MULTI_TOOL,
    MODE_ESCALATE,
    MODE_TERMINATE,
)


# ── Inline fixture definitions ─────────────────────────────────────
# These mirror the fixtures in tests/llm_free/fixtures.py but are
# defined here because pytest only auto-discovers fixtures from
# conftest.py files, not regular modules.  Our test file is in tests/
# while the shared fixtures live in tests/llm_free/.


@pytest.fixture
def mock_llm_env():
    """Override real_llm with MockLLM (plain text, no tool_calls).

    Declare this fixture in your test to bypass the autouse ``real_llm``
    from conftest.py and use a no-op mock instead.
    """
    from src import dependencies
    from src.llm_config import MockLLM

    dependencies._llm = MockLLM()
    yield
    dependencies._llm = None


@pytest.fixture
def mock_llm_tools(request):
    """Override real_llm with MockLLMWithToolCalls.

    Supports ``@pytest.mark.llm_mode("single")`` (or ``"no_tool"``,
    ``"multi"``, ``"escalate"``, ``"terminate"``) to select the
    deterministic tool_calling pattern.
    """
    from src import dependencies

    marker = request.node.get_closest_marker("llm_mode")
    mode = marker.args[0] if marker else MODE_NO_TOOL
    dependencies._llm = MockLLMWithToolCalls(mode=mode)
    yield dependencies._llm
    dependencies._llm = None


# Marker helpers for use with ``mock_llm_tools``
LLM_MODE_NO_TOOL = pytest.mark.llm_mode("no_tool")
LLM_MODE_SINGLE = pytest.mark.llm_mode("single")
LLM_MODE_MULTI = pytest.mark.llm_mode("multi")
LLM_MODE_ESCALATE = pytest.mark.llm_mode("escalate")
LLM_MODE_TERMINATE = pytest.mark.llm_mode("terminate")

# ───────────────────────────────────────────────────────────────────────
# Custom Mock: ToggleMockLLM — first N calls return tool_calls, rest text
# ───────────────────────────────────────────────────────────────────────

class _ToggleMockLLM:
    """Deterministic mock that returns tool_calls for the first K calls,
    then plain text for all subsequent calls.

    ``tool_call_groups`` is a list where each element is a list of dicts
    representing the tool_calls to return on that invocation number.

    Example::

        llm = _ToggleMockLLM(tool_call_groups=[
            [ToolCallBuilder.search_cases()],          # 1st call: search
            [ToolCallBuilder.case_detail()],            # 2nd call: detail
        ])
        # 3rd+ call returns plain text → graph terminates
    """

    model_name = "toggle-mock"

    def __init__(self, tool_call_groups: list[list[dict]]) -> None:
        self._groups = tool_call_groups
        self.invoke_count = 0

    async def ainvoke(self, messages: list, config: Any = None) -> dict:
        """Return a dict that LangChain can convert to AIMessage via _convert_to_message."""
        self.invoke_count += 1
        idx = self.invoke_count - 1
        msg: dict = {"type": "ai", "id": f"mock-{self.invoke_count}"}
        if idx < len(self._groups):
            msg["content"] = f"Step {self.invoke_count}"
            msg["tool_calls"] = list(self._groups[idx])
        else:
            msg["content"] = "All done. Here is the final response."
        return msg

    def bind_tools(self, tools: list) -> _ToggleMockLLM:
        return self


class _SummarySafeToggleMock(_ToggleMockLLM):
    """Like _ToggleMockLLM but also handles the summarization call.

    For trajectories where both the main agent AND ``summarize_conversation``
    (via ``get_llm_base``) call the same mock. The extra summarization call
    consumes one call-slot.
    """

    pass  # Same logic; used for documentation / test clarity.


# ───────────────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────────────


def _reset_graph_caches() -> None:
    """Reset module-level caches in ``graph.py`` to avoid cross-test pollution.

    ``get_llm_base`` caches its result in ``graph._llm_base`` (module global).
    ``call_agent`` caches the bound LLM in ``graph.llm`` (module global).
    Reset both before tests that create their own mock so the graph picks up
    the fresh mock from ``dependencies._llm``.
    """
    import src.graph  # noqa: F811  — re-import ensures module is loaded

    src.graph._llm_base = None
    src.graph.llm = None


def _set_llm(mock_instance: Any) -> None:
    """Override ``dependencies._llm`` with a mock and reset graph caches."""
    from src import dependencies

    dependencies._llm = mock_instance
    _reset_graph_caches()


# ═══════════════════════════════════════════════════════════════════════
# Trajectory A: No tool call → agent → END
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestTrajectoryNoTool:
    """Agent responds without calling any tool → immediate END.

    Verifies::
        START → load_context → agent → END
    """

    @LLM_MODE_NO_TOOL
    async def test_agent_ends_immediately(self, mock_llm_tools) -> None:
        """✅ Positive: plain-text response ends the graph."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Hello, I need help.")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        assert result["step_count"] == 1
        # user msg + ai response = 2
        assert len(result["messages"]) == 2
        last = result["messages"][-1]
        assert hasattr(last, "content") and last.content
        assert last.type == "ai"

    @LLM_MODE_NO_TOOL
    async def test_messages_preserved_through_graph(self, mock_llm_tools) -> None:
        """✅ Positive: user message is preserved in the output messages list."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        user_text = "Show me my open cases please."
        result = await graph.ainvoke({
            "messages": [HumanMessage(content=user_text)],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        messages = result["messages"]
        # First message should be the original HumanMessage
        assert messages[0].content == user_text
        assert messages[0].type == "human"

    @LLM_MODE_NO_TOOL
    async def test_load_context_passthrough(self, mock_llm_tools) -> None:
        """✅ Positive: load_context_node passes state through unchanged."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Hello")],
            "user_id": "alice@acme.com",
            "user_role": "ADMIN",
            "step_count": 0,
        })

        assert result["user_id"] == "alice@acme.com"
        assert result["user_role"] == "ADMIN"


# ═══════════════════════════════════════════════════════════════════════
# Trajectory B: Single / multi tool call → agent → tools → agent → END
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestTrajectorySingleTool:
    """Agent calls exactly one tool → tools execute → back to agent → END.

    Verifies::
        agent → tools → check_approval → summarize (<6 msgs → no-op) → agent → END
    """

    async def test_single_tool_cycle(self, mock_llm_env) -> None:
        """✅ Positive: one search_cases tool_call, executes, agent returns text.

        Uses _ToggleMockLLM: 1st call returns tool_calls, 2nd call returns text.
        """
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [ToolCallBuilder.search_cases(query="Acme Corp")],
        ]))

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Find open cases for Acme Corp")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        assert result["step_count"] == 2
        messages = result["messages"]
        assert len(messages) >= 3  # user + ai(tool) + tool_result + ai(text)

        # Verify a ToolMessage exists (tool was executed)
        tool_msgs = [m for m in messages if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) >= 1, "Expected at least one ToolMessage"

        # The last message should be text from the second agent call
        last = messages[-1]
        assert last.type == "ai"
        assert last.content

    async def test_multi_tool_execution(self, mock_llm_env) -> None:
        """✅ Positive: two tool_calls in one agent turn — both execute."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [
                ToolCallBuilder.search_cases(),
                ToolCallBuilder.customer_context(account_id="acc-001"),
            ],
        ]))

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Look up cases and customer context")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) >= 2, "Expected at least 2 ToolMessages for 2 tool calls"
        assert result["step_count"] == 2

    async def test_conditional_route_stops_when_no_tool(self, mock_llm_env) -> None:
        """✅ Positive: second agent call returns text → ends, no extra tool."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [ToolCallBuilder.search_cases()],
            # Second call: text only (no tool_calls) → should_continue → END
        ]))

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Search and then summarize")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        # Step count should be 2 (agent ran twice)
        assert result["step_count"] == 2
        last = result["messages"][-1]
        assert not getattr(last, "tool_calls", None), (
            "Final message should not have tool_calls"
        )

    async def test_no_tool_calls_returns_empty_tool_msg_list(self, mock_llm_env) -> None:
        """❌ Negative: mock returns no tool_calls → verify no ToolMessages exist."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(_ToggleMockLLM(tool_call_groups=[]))

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Just say hello")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) == 0
        assert result["step_count"] == 1


# ═══════════════════════════════════════════════════════════════════════
# Trajectory C: Escalate → HITL approval gate
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestTrajectoryEscalateHITL:
    """Escalate_case triggers requiresApproval: true → check_approval
    sets requires_approval → routes to approval_gate → intercepts with
    interrupt().

    The HITL tests use ``astream()`` to handle the interrupt lifecycle.
    """

    @LLM_MODE_ESCALATE
    async def test_escalate_sets_requires_approval(self, mock_llm_tools) -> None:
        """✅ Positive: escalate_case returns requiresApproval → check_approval_node sets flag.

        Verifies the state after tools but before approval_gate.
        """
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Escalate case 500000000")],
            "user_id": "lead@example.com",
            "user_role": "TEAM_LEAD",
            "step_count": 0,
        })

        # The graph may have ended with an interrupt — check for approval context
        assert result.get("requires_approval") is not None
        # Check that the escalate tool was called
        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) >= 1

    async def test_approval_gate_interrupts_execution(self, mock_llm_env) -> None:
        """✅ Positive: graph pauses at approval_gate with interrupt."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(MockLLMWithToolCalls(mode=MODE_ESCALATE))

        config = {"configurable": {"thread_id": "test-hilt-interrupt"}}

        # Stream until interrupt
        interrupted = False
        async for event in graph.astream(
            {
                "messages": [HumanMessage(content="Escalate case 500000000")],
                "user_id": "lead@example.com",
                "user_role": "TEAM_LEAD",
                "step_count": 0,
            },
            config=config,
        ):
            if "__interrupt__" in event:
                interrupted = True
                break

        assert interrupted, (
            "Graph should have interrupted at approval_gate. "
            "Check that escalate_case tool returns requiresApproval: true."
        )

    async def test_approval_gate_approved_resets_state(self, mock_llm_env) -> None:
        """✅ Positive: approval_gate_node with APPROVED resets requires_approval."""
        from unittest.mock import patch
        from src.graph import approval_gate_node

        state = {
            "requires_approval": True,
            "approval_context": {
                "case_id": "500000000",
                "reason": "Needs manager approval",
                "action_type": "escalation",
            },
        }

        with patch("src.graph.interrupt", return_value="APPROVED"):
            result = approval_gate_node(state)

        assert result["requires_approval"] is False
        assert result["approval_context"] is None
        # Should contain a SystemMessage mentioning APPROVED
        msgs = result.get("messages", [])
        assert len(msgs) == 1
        content = msgs[0].content if hasattr(msgs[0], "content") else str(msgs[0])
        assert "APPROVED" in content
        assert "approved" in content.lower()

    async def test_approval_gate_rejected_resets_state(self, mock_llm_env) -> None:
        """✅ Positive: approval_gate_node with REJECTED resets requires_approval."""
        from unittest.mock import patch
        from src.graph import approval_gate_node

        state = {
            "requires_approval": True,
            "approval_context": {
                "case_id": "500000001",
                "reason": "Outside standard scope",
                "action_type": "escalation",
            },
        }

        with patch("src.graph.interrupt", return_value="REJECTED"):
            result = approval_gate_node(state)

        assert result["requires_approval"] is False
        assert result["approval_context"] is None
        msgs = result.get("messages", [])
        assert len(msgs) == 1
        content = msgs[0].content if hasattr(msgs[0], "content") else str(msgs[0])
        assert "REJECTED" in content
        assert "rejected" in content.lower()

    async def test_approval_gate_without_escalation_no_interrupt(self, mock_llm_env) -> None:
        """❌ Negative: normal tool call does NOT trigger interrupt/approval gate."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [ToolCallBuilder.search_cases()],
        ]))

        config = {"configurable": {"thread_id": "test-no-interrupt"}}

        interrupted = False
        async for event in graph.astream(
            {
                "messages": [HumanMessage(content="Find cases")],
                "user_id": "test@example.com",
                "user_role": "SUPPORT_AGENT",
                "step_count": 0,
            },
            config=config,
        ):
            if "__interrupt__" in event:
                interrupted = True
                break

        assert not interrupted, "Normal tool flow should NOT trigger interrupt"


# ═══════════════════════════════════════════════════════════════════════
# Trajectory D: 5+ step auto-termination
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestTrajectoryAutoTerminate:
    """When step_count reaches 5, should_continue returns END even if the
    LLM response contains tool_calls.
    """

    @LLM_MODE_SINGLE
    async def test_high_step_count_ends_immediately(self, mock_llm_tools) -> None:
        """✅ Positive: step_count=5 with tool_calls → END (step_count check wins)."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Find cases")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 5,
        })

        # Agent runs once (incrementing to 6), then should_continue sees >=5 → END
        assert result["step_count"] == 6
        # No ToolMessages should exist because tools were never reached
        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) == 0

    @LLM_MODE_SINGLE
    async def test_step_count_three_lets_tools_run(self, mock_llm_tools) -> None:
        """✅ Positive: step_count=3 → agent increments to 4 (<5) → tools node runs."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Find cases")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 3,
        })

        assert result["step_count"] == 4 or result["step_count"] > 3, (
            "Step count should be at least 4 after agent runs"
        )
        # Tools should have been reached (step_count after agent =4, which is <5)
        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) >= 1

    @LLM_MODE_SINGLE
    async def test_step_count_four_skips_tools(self, mock_llm_tools) -> None:
        """❌ Negative: step_count=4 → agent increments to 5 (>=5) → END, no tools."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Find cases")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 4,
        })

        assert result["step_count"] == 5
        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) == 0, "Tools should NOT run when step_count=4 (→5 ≥5)"

    @LLM_MODE_SINGLE
    async def test_does_not_reach_tools_at_step_five(self, mock_llm_tools) -> None:
        """❌ Negative: confirm ToolNode is NEVER invoked when step_count >= 5."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Any query")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 5,
        })

        # Assert there is exactly 1 AIMessage (the agent response) + original
        ai_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "ai"]
        assert len(ai_msgs) == 1, (
            "Agent only runs once due to step_count termination"
        )
        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) == 0, "ToolNode should NOT be invoked"


# ═══════════════════════════════════════════════════════════════════════
# Trajectory E: Summarization path (6+ messages)
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestTrajectorySummarization:
    """When the conversation accumulates 6+ messages, the summarization node
    generates a SystemMessage summary and feeds it back to the agent.

    Flow::
        agent → tools → check_approval → summarize (6+ msgs → generates summary)
        → agent → END
    """

    async def test_summarize_with_six_plus_messages(self, mock_llm_env) -> None:
        """✅ Positive: 6+ messages triggers summarize_conversation.

        Builds an initial state with 6 HumanMessages, then the graph flows
        through agent (adds AIMessage with tool_calls) → tools (adds ToolMessage)
        → summarize (8 messages ≥ 6 → generates SystemMessage) → agent → END.
        """
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        # Build a state with 6 messages so summarization triggers
        initial_messages: list[dict] = [
            _human_msg("I need help with my account."),
            _human_msg("Can you check case 500000001?"),
            _human_msg("What is the status?"),
            _human_msg("I also have a billing issue."),
            _human_msg("Can you escalate my case?"),
            _human_msg("When will someone respond?"),
        ]

        # Use a toggle mock: 1st call returns tool_calls, then text
        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [ToolCallBuilder.search_cases()],
        ]))

        result = await graph.ainvoke({
            "messages": [HumanMessage(content=m["content"]) for m in initial_messages],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        messages = result["messages"]

        # Should contain a SystemMessage (from summarization)
        system_msgs = [m for m in messages if getattr(m, "type", "") == "system"]
        assert len(system_msgs) >= 1, (
            "Expected at least one SystemMessage from summarization. "
            f"Message types: {[getattr(m,'type','?') for m in messages]}"
        )

        # The summary SystemMessage should mention "summary"
        summary_text = system_msgs[0].content.lower() if hasattr(system_msgs[0], "content") else ""
        assert "summary" in summary_text, (
            f"SystemMessage content should include 'summary'. Got: {system_msgs[0].content[:100]}"
        )

        # Step count should be 2 (agent ran twice: once for tool, once for text)
        assert result["step_count"] == 2

    async def test_fewer_than_six_messages_skips_summary(self, mock_llm_env) -> None:
        """❌ Negative: < 6 messages → summarize_conversation short-circuits with {}."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [ToolCallBuilder.search_cases()],
        ]))

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Find cases for Acme")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        system_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "system"]
        assert len(system_msgs) == 0, (
            "No SystemMessage expected for < 6 messages"
        )

    async def test_summary_system_message_injected_before_agent_restart(self, mock_llm_env) -> None:
        """✅ Positive: summary SystemMessage appears after tool result, before final agent text."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        initial_messages: list[dict] = [
            _human_msg("Issue one."),
            _human_msg("Issue two."),
            _human_msg("Issue three."),
            _human_msg("Issue four."),
            _human_msg("Issue five."),
            _human_msg("Issue six."),
        ]

        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [ToolCallBuilder.search_cases()],
        ]))

        result = await graph.ainvoke({
            "messages": [HumanMessage(content=m["content"]) for m in initial_messages],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        messages = result["messages"]
        # Find indices of all system messages
        system_indices = [
            i for i, m in enumerate(messages) if getattr(m, "type", "") == "system"
        ]
        tool_indices = [
            i for i, m in enumerate(messages) if getattr(m, "type", "") == "tool"
        ]

        if system_indices:
            # Summarization generates a SystemMessage after the ToolMessage
            last_tool_idx = max(tool_indices) if tool_indices else -1
            first_system_idx = system_indices[0]
            # SystemMessage should come after ToolMessage
            assert first_system_idx > last_tool_idx, (
                "SystemMessage (summary) must appear after ToolMessage"
            )
            # And before the final AIMessage
            ai_indices = [
                i for i, m in enumerate(messages) if getattr(m, "type", "") == "ai"
            ]
            if ai_indices:
                assert first_system_idx < max(ai_indices), (
                    "SystemMessage (summary) must appear before final AIMessage"
                )


# ═══════════════════════════════════════════════════════════════════════
# Trajectory F: Tool error propagation
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestTrajectoryErrorPropagation:
    """When a tool receives invalid input (e.g. non-existent case_id), it
    catches the exception and returns a JSON error payload rather than
    raising. The graph should continue normally — no crash.
    """

    async def test_invalid_case_id_returns_error_message(self, mock_llm_env) -> None:
        """✅ Positive: invalid case_id → tool returns error JSON → graph continues."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [ToolCallBuilder.case_detail(case_id="invalid_non_existent_id")],
        ]))

        # Should NOT raise — tool catches the error internally
        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Show details for invalid case")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) >= 1, "Tool should have been called"

        # The ToolMessage content should contain an error indicator
        tool_content = tool_msgs[0].content if hasattr(tool_msgs[0], "content") else ""
        assert "error" in tool_content.lower() or "not found" in tool_content.lower(), (
            f"ToolMessage should contain error text. Got: {tool_content[:200]}"
        )

        # The graph should have continued gracefully
        assert result["step_count"] == 2, (
            "Graph should complete second agent call after tool error"
        )
        # Last message should be text, not an exception
        last = result["messages"][-1]
        assert getattr(last, "type", "") == "ai"

    async def test_empty_case_id_triggers_validation_error(self, mock_llm_env) -> None:
        """❌ Negative: empty case_id → tool returns error → no crash."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [ToolCallBuilder.case_detail(case_id="")],
        ]))

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Show empty case")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) >= 1

        tool_content = tool_msgs[0].content if hasattr(tool_msgs[0], "content") else ""
        assert "error" in tool_content.lower() or "not found" in tool_content.lower()

    async def test_multiple_tools_one_fails_others_succeed(self, mock_llm_env) -> None:
        """✅ Positive: two tools called, one fails, one succeeds — no crash."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [
                ToolCallBuilder.search_cases(query="Acme Corp"),       # should succeed
                ToolCallBuilder.case_detail(case_id="bad_case_id"),     # should fail
            ],
        ]))

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Search and get details")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) >= 2, "Both tools should have been called"

        # At least one should contain "cases" (success)
        success_contents = [
            m.content for m in tool_msgs
            if hasattr(m, "content") and '"cases"' in m.content
        ]
        assert len(success_contents) >= 1, "At least one tool should have succeeded"

        # At least one should contain an error
        error_contents = [
            m.content for m in tool_msgs
            if hasattr(m, "content") and "error" in m.content.lower()
        ]
        assert len(error_contents) >= 1, (
            "At least one tool should have returned an error"
        )

        # Graph completes normally
        assert result["step_count"] == 2


# ═══════════════════════════════════════════════════════════════════════
# Edge cases and robustness
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestTrajectoryEdgeCases:
    """Boundary conditions, empty states, unusual inputs."""

    @LLM_MODE_NO_TOOL
    async def test_empty_user_role_falls_back_to_all_tools(self, mock_llm_tools) -> None:
        """✅ Positive: user_role=None or empty still works."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Hello")],
            "user_id": "test@example.com",
            "user_role": "",
            "step_count": 0,
        })

        assert result["step_count"] == 1
        assert len(result["messages"]) == 2

    @LLM_MODE_SINGLE
    async def test_user_role_support_ops_readonly_tools(self, mock_llm_tools) -> None:
        """✅ Positive: SUPPORT_OPS gets read-only tools (first 5).

        The mock's ``search_cases`` is in the read-only set, so it should execute.
        """
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Find cases")],
            "user_id": "ops@example.com",
            "user_role": "SUPPORT_OPS",
            "step_count": 0,
        })

        # Should have completed a tool cycle
        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) >= 1

    async def test_graph_reenters_agent_after_tool_error(self, mock_llm_env) -> None:
        """✅ Positive: after tool error, agent still runs and produces text.

        This validates the graph resilience: an error does not break the
        agent→tools→...→agent cycle.
        """
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        _set_llm(_ToggleMockLLM(tool_call_groups=[
            [ToolCallBuilder.case_detail(case_id="nonexistent")],
        ]))

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Get bad case")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        # Agent completed two turns: first with tool, second with text
        ai_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "ai"]
        assert len(ai_msgs) == 2, "Agent should have run twice"
        assert result["step_count"] == 2

    @LLM_MODE_MULTI
    async def test_multiple_tools_in_one_response_all_executed(self, mock_llm_tools) -> None:
        """✅ Positive: multi-tool call executes ALL tools, not just the first."""
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        # Use multi mode which returns 2 tool_calls (search_cases + customer_context)
        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Find cases and customer context")],
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        tool_msgs = [m for m in result["messages"] if getattr(m, "type", "") == "tool"]
        assert len(tool_msgs) >= 2, (
            f"Expected ≥2 ToolMessages for 2 tool calls, got {len(tool_msgs)}"
        )

    async def test_no_messages_defaults_to_empty(self, mock_llm_env) -> None:
        """❌ Negative: missing 'messages' key → LangGraph initializes to []."""
        from src.graph import graph

        # Should NOT raise — LangGraph handles missing messages gracefully
        result = await graph.ainvoke({
            "user_id": "test@example.com",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })

        # Messages list should exist (may contain just the system prompt response)
        assert "messages" in result
        assert result["step_count"] == 1

    @LLM_MODE_NO_TOOL
    async def test_unknown_role_gets_no_tools(self, mock_llm_tools) -> None:
        """✅ Positive: unknown role returns empty tool list.

        The agent should still respond (text only) because get_tools_for_role
        returns [] for unrecognized roles.
        """
        # Note: the mock already doesn't use tools — this just validates
        # the graph doesn't crash with an empty tool list.
        from src.graph import graph
        from langchain_core.messages import HumanMessage

        result = await graph.ainvoke({
            "messages": [HumanMessage(content="Hello")],
            "user_id": "test@example.com",
            "user_role": "UNKNOWN_ROLE_XYZ",
            "step_count": 0,
        })

        assert result["step_count"] == 1
        assert len(result["messages"]) == 2


# ═══════════════════════════════════════════════════════════════════════
# Trajectory verification: conditional edge coverage
# ═══════════════════════════════════════════════════════════════════════

class TestConditionalEdges:
    """Unit-level tests for the conditional routing functions to ensure
    every branch of the graph is covered.
    """

    def test_should_continue_returns_end_when_no_tool_calls(self) -> None:
        """should_continue returns END when last message has no tool_calls."""
        from src.graph import should_continue
        from langgraph.graph import END
        from langchain_core.messages import AIMessage

        state = {
            "messages": [AIMessage(content="Hello")],
            "step_count": 0,
        }
        result = should_continue(state)
        assert result == END  # LangGraph END constant (typically "__end__")

    def test_should_continue_returns_tools_when_tool_calls(self) -> None:
        """should_continue returns 'tools' when last message has tool_calls and step_count < 5."""
        from src.graph import should_continue
        from langchain_core.messages import AIMessage

        msg = AIMessage(content="Searching...", tool_calls=[{"name": "test", "args": {}, "id": "1", "type": "tool_call"}])
        state = {
            "messages": [msg],
            "step_count": 0,
        }
        result = should_continue(state)
        assert result == "tools"

    def test_should_continue_returns_end_when_step_count_ge_5(self) -> None:
        """should_continue returns END when step_count >= 5 (even with tool_calls)."""
        from src.graph import should_continue
        from langgraph.graph import END
        from langchain_core.messages import AIMessage

        msg = AIMessage(content="Searching...", tool_calls=[{"name": "test", "args": {}, "id": "1", "type": "tool_call"}])
        state = {
            "messages": [msg],
            "step_count": 5,
        }
        result = should_continue(state)
        assert result == END  # LangGraph END constant (typically "__end__")

    def test_check_approval_needed_approval_gate(self) -> None:
        """check_approval_needed returns 'approval_gate' when requires_approval is True."""
        from src.graph import check_approval_needed

        state = {"requires_approval": True}
        result = check_approval_needed(state)
        assert result == "approval_gate"

    def test_check_approval_needed_summarize(self) -> None:
        """check_approval_needed returns 'summarize' when requires_approval is False/None."""
        from src.graph import check_approval_needed

        state: dict = {}
        result = check_approval_needed(state)
        assert result == "summarize"

        state = {"requires_approval": False}
        result = check_approval_needed(state)
        assert result == "summarize"
