"""
Shared fixtures for LLM-free deterministic testing of LangGraph agent infrastructure.

Provides:
  1. MockLLMWithToolCalls — LLM replacement that returns deterministic tool_calls
  2. StateBuilder — compose AgentState dicts without boilerplate
  3. Pre-built states for common scenarios (empty, single turn, multi-turn, approval)
  4. MockSalesforceClient singleton injection (already done by conftest.py)
  5. conftest_override — fixture that sets LLM_PROVIDER=mock + injects MockLLM
"""

import json
import os
from typing import Any, Optional

import pytest


# ───────────────────────────────────────────────────────────────────────
# 1. MockLLMWithToolCalls — 5 modes for deterministic tool trajectories
# ───────────────────────────────────────────────────────────────────────

class AIMessageStub:
    """Minimal AIMessage stand-in that mimics the parts we need.

    Avoids importing langchain_core for these fixtures so they load
    eagerly even if langchain has import-order edge cases.
    """

    def __init__(self, content: str = "", tool_calls: list | None = None,
                 additional_kwargs: dict | None = None):
        self.content = content
        self.tool_calls = tool_calls or []
        self.additional_kwargs = additional_kwargs or {}
        self.type = "ai"
        self.response_metadata = {}
        self.id = "mock-msg-1"

    def pretty_print(self):
        print(f"{self.type}: {self.content[:80]}...")


def _to_ai_message(content: str = "", tool_calls: list | None = None) -> dict:
    """Return a dict that LangChain's ``_convert_to_message`` can process.

    LangChain expects messages to be ``BaseMessage`` instances, dicts, or
    tuples.  Plain dicts are safest in test fixtures because they avoid
    importing ``langchain_core`` at module level (which can cause import-order
    edge cases) while still being fully compatible with LangGraph's
    ``add_messages`` reducer.
    """
    msg: dict = {
        "type": "ai",
        "content": content,
        "id": f"mock-msg-{abs(hash(str(tool_calls) + content)) % 10**6}",
    }
    if tool_calls:
            msg["tool_calls"] = list(tool_calls)
    return msg


class ToolCallBuilder:
    """Build tool_call dicts that LangGraph's ToolNode can consume."""

    @staticmethod
    def search_cases(query: str = "Acme Corp",
                     filters: dict | None = None) -> dict:
        return {
            "name": "search_salesforce_cases",
            "args": {"query": query, "filters": filters},
            "id": "call_search_1",
            "type": "tool_call",
        }

    @staticmethod
    def case_detail(case_id: str = "500000000") -> dict:
        return {
            "name": "get_case_details",
            "args": {"case_id": case_id},
            "id": "call_detail_1",
            "type": "tool_call",
        }

    @staticmethod
    def customer_context(account_id: str = "acc-001") -> dict:
        return {
            "name": "get_customer_context",
            "args": {"account_id": account_id},
            "id": "call_ctx_1",
            "type": "tool_call",
        }

    @staticmethod
    def kb_search(query: str = "password reset") -> dict:
        return {
            "name": "search_knowledge_base",
            "args": {"query": query},
            "id": "call_kb_1",
            "type": "tool_call",
        }

    @staticmethod
    def similar_tickets(query: str = "login issue") -> dict:
        return {
            "name": "search_similar_tickets",
            "args": {"query": query},
            "id": "call_sim_1",
            "type": "tool_call",
        }

    @staticmethod
    def create_case(subject: str = "New issue",
                    description: str = "Test description",
                    priority: str = "Medium",
                    account_id: str = "acc-001") -> dict:
        return {
            "name": "create_case",
            "args": {"subject": subject, "description": description,
                     "priority": priority, "account_id": account_id},
            "id": "call_create_1",
            "type": "tool_call",
        }

    @staticmethod
    def update_case(case_id: str = "500000000",
                    fields: dict | None = None) -> dict:
        return {
            "name": "update_case",
            "args": {"case_id": case_id,
                     "fields": fields or {"status": "Closed"}},
            "id": "call_upd_1",
            "type": "tool_call",
        }

    @staticmethod
    def escalate_case(case_id: str = "500000000",
                      reason: str = "Needs manager approval") -> dict:
        return {
            "name": "escalate_case",
            "args": {"case_id": case_id, "reason": reason},
            "id": "call_esc_1",
            "type": "tool_call",
        }

    @staticmethod
    def draft_reply(case_id: str = "500000000",
                    tone: str = "professional") -> dict:
        return {
            "name": "draft_case_reply",
            "args": {"case_id": case_id, "tone": tone},
            "id": "call_draft_1",
            "type": "tool_call",
        }

    @staticmethod
    def send_reply(case_id: str = "500000000",
                   message: str = "Thank you for your patience",
                   channel: str = "email") -> dict:
        return {
            "name": "send_case_reply",
            "args": {"case_id": case_id, "message": message, "channel": channel},
            "id": "call_reply_1",
            "type": "tool_call",
        }


# ── MockLLM modes ─────────────────────────────────────────────────────

MODE_NO_TOOL = "no_tool"      # returns plain text — agent → END
MODE_SINGLE_TOOL = "single"   # returns one tool_call — agent → tools
MODE_MULTI_TOOL = "multi"     # returns 2 tool_calls — agent → tools
MODE_ESCALATE = "escalate"    # returns escalate_case call — triggers HITL
MODE_TERMINATE = "terminate"  # returns no tool but step_count >= 5 — END


class MockLLMWithToolCalls:
    """Deterministic LLM stand-in that returns configurable tool_calls.

    Usage in tests:
        llm = MockLLMWithToolCalls(mode="single")
        response = await llm.ainvoke([HumanMessage(content="hi")])
        assert len(response.tool_calls) == 1
        assert response.tool_calls[0]["name"] == "search_salesforce_cases"
    """

    model_name = "mock-llm-tools"

    def __init__(self, mode: str = MODE_NO_TOOL):
        self.mode = mode
        self.invoke_count = 0

    async def ainvoke(self, messages, config=None):
        self.invoke_count += 1
        if self.mode == MODE_SINGLE_TOOL:
            return _to_ai_message(
                content="Let me search for that case.",
                tool_calls=[ToolCallBuilder.search_cases()],
            )
        elif self.mode == MODE_MULTI_TOOL:
            return _to_ai_message(
                content="Let me look up both the case and customer context.",
                tool_calls=[
                    ToolCallBuilder.search_cases(),
                    ToolCallBuilder.customer_context(),
                ],
            )
        elif self.mode == MODE_ESCALATE:
            return _to_ai_message(
                content="This needs escalation to a team lead.",
                tool_calls=[ToolCallBuilder.escalate_case()],
            )
        elif self.mode == MODE_TERMINATE:
            # Returns no tool_calls — should_continue will check step_count
            return _to_ai_message(
                content="I've completed all steps. The case is resolved.",
            )
        else:  # MODE_NO_TOOL
            return _to_ai_message(
                content="I understand your request. Let me help with that.",
            )

    def bind_tools(self, tools):
        return self


class SummarizerMockLLM:
    """Deterministic summarizer that returns a fixed summary text."""

    model_name = "mock-summarizer"

    async def ainvoke(self, messages, config=None):
        return _to_ai_message(
            content="Earlier conversation summary: User asked about case 500000000. "
                    "Agent searched for cases and found 4 results. "
                    "User requested escalation which was approved."
        )


# ── 2. StateBuilder — compose AgentState dicts ────────────────────────

def build_state(
    messages: list | None = None,
    user_id: str = "test@example.com",
    user_role: str = "SUPPORT_AGENT",
    step_count: int = 0,
    last_tool_result: dict | None = None,
    requires_approval: bool | None = None,
    approval_context: dict | None = None,
) -> dict:
    """Build an AgentState dict with only the fields needed for the test.

    ``messages`` can be plain dicts (which will be converted) or
    langchain_core BaseMessage objects.
    """
    state: dict = {
        "messages": messages or [],
        "user_id": user_id,
        "user_role": user_role,
        "step_count": step_count,
    }
    if last_tool_result is not None:
        state["last_tool_result"] = last_tool_result
    if requires_approval is not None:
        state["requires_approval"] = requires_approval
    if approval_context is not None:
        state["approval_context"] = approval_context
    return state


def _human_msg(content: str = "Find open cases for Acme Corp"):
    """Create a minimal HumanMessage-like dict."""
    return {"type": "human", "content": content, "role": "user"}


# ── Pre-built states ──────────────────────────────────────────────────

EMPTY_STATE = build_state(messages=[_human_msg()])

SINGLE_TURN_STATE = build_state(
    messages=[_human_msg("Show me case 500000000")],
    step_count=1,
)

TOOL_CALLING_STATE = build_state(
    messages=[
        _human_msg("Find open cases for Acme Corp"),
        AIMessageStub(
            content="Let me search.",
            tool_calls=[ToolCallBuilder.search_cases()],
        ),
    ],
    step_count=1,
    user_role="TEAM_LEAD",
)

APPROVAL_STATE = build_state(
    messages=[
        _human_msg("Escalate case 500000000"),
        AIMessageStub(
            content="Let me escalate that.",
            tool_calls=[ToolCallBuilder.escalate_case()],
        ),
    ],
    step_count=1,
    user_role="TEAM_LEAD",
    requires_approval=True,
    approval_context={
        "case_id": "500000000",
        "reason": "Needs manager approval",
        "action_type": "escalation",
    },
)

HIGH_STEP_COUNT_STATE = build_state(
    messages=[AIMessageStub(content="This is the 5th response.")],
    step_count=5,
)

MULTI_TURN_STATE = build_state(
    messages=[
        _human_msg("Find open cases for Acme Corp"),
        AIMessageStub(
            content="Let me search.",
            tool_calls=[ToolCallBuilder.search_cases()],
        ),
        # Tool result would go here in real flow — for node isolation we
        # skip to the next agent invocation
        _human_msg("Show me details for case 500000000"),
        AIMessageStub(
            content="Here are the details.",
            tool_calls=[ToolCallBuilder.case_detail()],
        ),
    ],
    step_count=3,
    user_role="TEAM_LEAD",
)

# Map from GenUI name to the tool that produces it
GENUI_TO_TOOL_NAME = {
    "case-list": "search_salesforce_cases",
    "case-detail": "get_case_details",
    "customer-context": "get_customer_context",
    "kb-results": "search_knowledge_base",
    "similar-tickets": "search_similar_tickets",
    "reply-draft": "draft_case_reply",
    "case-created": "create_case",
    "case-updated": "update_case",
    "escalation-card": "escalate_case",
    "error-display": None,  # produced on error by any tool
}


# ── 3. Pytest fixture to override the real_llm autouse fixture ────────

@pytest.fixture
def mock_llm_env():
    """Set LLM_PROVIDER=mock and inject MockLLM into dependencies.

    This fixture MUST be declared in your test function's parameter list to
    override the autouse ``real_llm`` fixture from conftest.py.

    Usage:
        async def test_something(self, mock_llm_env):
            # dependencies._llm is now MockLLM (no real LLM calls)
            ...
    """
    from src import dependencies
    from src.llm_config import MockLLM

    # Override the singleton with MockLLM
    dependencies._llm = MockLLM()
    yield
    dependencies._llm = None


@pytest.fixture
def mock_llm_tools(request):
    """Inject MockLLMWithToolCalls with a configurable mode.

    Use pytest's ``indirect`` parameterization or request a ``mode`` mark::

        @pytest.mark.parametrize(
            "mock_llm_tools", ["single", "multi", "escalate"], indirect=True
        )
        async def test_trajectory(self, mock_llm_tools):
            ...

    If no mode is requested, defaults to ``MODE_NO_TOOL``.
    """
    from src import dependencies

    marker = request.node.get_closest_marker("llm_mode")
    mode = marker.args[0] if marker else MODE_NO_TOOL
    dependencies._llm = MockLLMWithToolCalls(mode=mode)
    yield dependencies._llm
    dependencies._llm = None


# Mark class for cleaner test markers
LLM_MODE_SINGLE = pytest.mark.llm_mode("single")
LLM_MODE_MULTI = pytest.mark.llm_mode("multi")
LLM_MODE_ESCALATE = pytest.mark.llm_mode("escalate")
LLM_MODE_TERMINATE = pytest.mark.llm_mode("terminate")
LLM_MODE_NO_TOOL = pytest.mark.llm_mode("no_tool")
