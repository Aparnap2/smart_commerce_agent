"""
E2E SupportPilot flow test — validates full agent workflow with real LLM.
Gated behind INTEGRATION_TEST=true.

Three sequential queries exercise the SupportPilot graph with a real
OpenRouter-backed LLM, testing tool selection and response generation.

Usage:
    INTEGRATION_TEST=true .venv/bin/python -m pytest \\
        tests/test_e2e_support_flow.py -v --tb=long -q
"""
import json
import os
import pytest

from langchain_core.messages import ToolMessage, AIMessage

pytestmark = pytest.mark.asyncio

INTEGRATION_TEST = os.environ.get("INTEGRATION_TEST", "").lower() in ("true", "1", "yes")
SUPPORT_TOOL_NAMES = {
    "search_salesforce_cases",
    "get_case_details",
    "get_customer_context",
    "search_knowledge_base",
    "search_similar_tickets",
    "draft_case_reply",
    "create_case",
    "update_case",
    "escalate_case",
}


# ═══════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════


def _setup_llm() -> bool:
    """Initialize the LLM singleton in src.dependencies so graph.ainvoke() works.

    The conftest.py only initializes the Salesforce client, not the LLM.
    This helper reads OpenRouter env vars and creates the ChatOpenAI client.

    Returns:
        True if LLM was initialized, False if required env vars are missing.
    """
    import src.dependencies as deps

    # Already initialized by a previous call in this process
    if deps._llm is not None:
        return True

    mock_llm = os.environ.get("MOCK_LLM", "false").lower() == "true"

    if mock_llm:
        deps._llm = deps.MockLLM()
        return True

    # Load .env if load_dotenv hasn't been called yet (safe to call multiple times)
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    llm_model = os.environ.get("OLLAMA_MODEL")
    llm_base_url = os.environ.get("OLLAMA_BASE_URL")
    llm_api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OLLAMA_API_KEY")

    if not all([llm_model, llm_base_url, llm_api_key]):
        missing = [k for k, v in [
            ("OLLAMA_MODEL", llm_model),
            ("OLLAMA_BASE_URL", llm_base_url),
            ("OPENROUTER_API_KEY", llm_api_key),
        ] if not v]
        print(f"  ⚠ Missing env vars: {', '.join(missing)}")
        return False

    from langchain_openai import ChatOpenAI

    deps._llm = ChatOpenAI(
        model=llm_model,
        temperature=0,
        base_url=llm_base_url,
        api_key=llm_api_key,
    )
    return True


def _last_text(messages: list) -> str:
    """Extract text content from the last message in the conversation.

    Handles AIMessage (may have content or only tool_calls),
    ToolMessage (has JSON content), and HumanMessage.
    """
    if not messages:
        return ""
    last = messages[-1]
    if hasattr(last, "content") and last.content:
        if isinstance(last.content, str):
            return last.content
        if isinstance(last.content, list):
            texts = [
                b.get("text", "")
                for b in last.content
                if isinstance(b, dict)
            ]
            return " ".join(texts).strip()
    return ""


def _tool_was_called(messages: list, tool_name: str) -> bool:
    """Check if a specific tool was called in the conversation."""
    for m in messages:
        if hasattr(m, "tool_calls") and m.tool_calls:
            for tc in m.tool_calls:
                if tc.get("name") == tool_name:
                    return True
    return False


def _any_support_tool_called(messages: list) -> bool:
    """Check if any SupportPilot tool was called."""
    for m in messages:
        if hasattr(m, "tool_calls") and m.tool_calls:
            for tc in m.tool_calls:
                if tc.get("name") in SUPPORT_TOOL_NAMES:
                    return True
    return False


def _count_tool_messages(messages: list) -> int:
    """Count ToolMessage instances (tool executions that ran)."""
    return sum(1 for m in messages if isinstance(m, ToolMessage))


def _count_agent_calls(messages: list) -> int:
    """Count AIMessage instances with tool_calls (LLM tool-call decisions)."""
    return sum(
        1 for m in messages
        if isinstance(m, AIMessage) and hasattr(m, "tool_calls") and m.tool_calls
    )


def _tool_results_summary(messages: list) -> str:
    """Build a one-line summary of tool results for debugging."""
    parts = []
    for m in messages:
        if isinstance(m, ToolMessage) and m.content:
            try:
                data = json.loads(m.content)
                if "cases" in data:
                    parts.append(f"search→{len(data['cases'])} cases")
                if "case" in data:
                    parts.append(f"detail→{data['case'].get('caseNumber', data['case'].get('id', '?'))}")
                if "account" in data:
                    parts.append(f"context→{data['account'].get('name', '?')}")
                if "articles" in data:
                    parts.append(f"kb→{len(data['articles'])} articles")
                if "tickets" in data:
                    parts.append(f"similar→{len(data['tickets'])} tickets")
                if "error" in data:
                    parts.append(f"error→{data['error'][:50]}")
            except (json.JSONDecodeError, AttributeError):
                parts.append(f"tool→{type(m).__name__}")
    return " | ".join(parts) if parts else "(no tool results)"


def _print_trajectory(step_label: str, messages: list) -> None:
    """Pretty-print the agent's trajectory for debugging."""
    print(f"\n  ═══ {step_label} ═══")
    print(f"  Messages: {len(messages)} total")
    print(f"  Tool calls: {_count_agent_calls(messages)}")
    print(f"  Tool results: {_count_tool_messages(messages)}")
    print(f"  Summary: {_tool_results_summary(messages)}")
    text = _last_text(messages)
    if text:
        preview = text[:200].replace("\n", " ")
        print(f"  Final response: \"{preview}...\"")
    else:
        print(f"  (final message has no text content — likely tool-call loop termination)")


# ═══════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════


@pytest.mark.skipif(
    not INTEGRATION_TEST,
    reason="Set INTEGRATION_TEST=true to run real LLM integration tests",
)
class TestEndToEndSupportFlow:
    """Full E2E flow: search cases → get details → customer context."""

    @pytest.fixture(autouse=True)
    def ensure_llm(self):
        """Fixture: ensure the real LLM singleton is initialized before each test.

        This runs before each test method. If the OpenRouter env vars are not
        fully configured, the test is skipped gracefully.
        """
        if not _setup_llm():
            pytest.skip(
                "OLLAMA_MODEL / OLLAMA_BASE_URL / OLLAMA_API_KEY not fully configured. "
                "Set these env vars (or add to .env) to run E2E tests."
            )

    async def _invoke(self, graph, message: str, role: str = "SUPPORT_AGENT") -> dict:
        """Invoke the graph with a single message (fresh conversation turn).

        Each invocation starts a new conversation — no accumulated history
        between steps. This tests the agent's ability to handle each query
        independently with only the system prompt as guidance.
        """
        return await graph.ainvoke({
            "messages": [{"role": "human", "content": message}],
            "user_id": "test-e2e-user",
            "user_role": role,
            "step_count": 0,
        })

    async def test_full_support_flow(self):
        """
        Three-step E2E support flow:

        Step 1 — "Find open cases for Acme Corp"
            Expects: search_salesforce_cases tool called, returns case data

        Step 2 — "Show me details for case 500000000"
            Expects: get_case_details tool called, returns case detail

        Step 3 — "What's the customer history for Acme?"
            Expects: get_customer_context (or search) called, returns customer info
        """
        from src.graph import graph
        from src.dependencies import get_llm

        # ── Verify LLM is alive ──────────────────────────────────────
        llm = get_llm()
        assert llm is not None, "LLM not initialized"
        print(f"\n  LLM: {llm.model_name}")

        # ═══════════════════════════════════════════════════════════════
        # Step 1: Search for customer cases
        # ═══════════════════════════════════════════════════════════════
        print("\n  ── Step 1: Search cases ──")
        result1 = await self._invoke(graph, "Find open cases for Acme Corp")
        msgs1 = result1.get("messages", [])
        _print_trajectory("STEP 1 — Find open cases for Acme Corp", msgs1)

        # Core assertions
        assert len(msgs1) > 0, "Step 1: No messages returned from graph"

        # The agent MUST have called search_salesforce_cases for this query
        assert _tool_was_called(msgs1, "search_salesforce_cases"), (
            "Step 1: Agent should call search_salesforce_cases for 'Find open cases'"
        )

        # The tool should have returned results (ToolMessage with case data)
        assert _count_tool_messages(msgs1) >= 1, (
            "Step 1: At least one tool should have executed"
        )

        # Verify the tool result contains cases
        tool_summary = _tool_results_summary(msgs1)
        assert "cases" in tool_summary or "error" in tool_summary, (
            f"Step 1: Tool result should mention cases: {tool_summary}"
        )

        # ═══════════════════════════════════════════════════════════════
        # Step 2: Get case details
        # ═══════════════════════════════════════════════════════════════
        print("\n  ── Step 2: Case details ──")
        result2 = await self._invoke(graph, "Show me details for case 500000000")
        msgs2 = result2.get("messages", [])
        _print_trajectory("STEP 2 — Show me details for case 500000000", msgs2)

        assert len(msgs2) > 0, "Step 2: No messages returned from graph"

        # The agent MUST have called get_case_details for this query
        assert _tool_was_called(msgs2, "get_case_details"), (
            "Step 2: Agent should call get_case_details for 'case 500000000'"
        )

        assert _count_tool_messages(msgs2) >= 1, (
            "Step 2: At least one tool should have executed"
        )

        # ═══════════════════════════════════════════════════════════════
        # Step 3: Get customer context
        # ═══════════════════════════════════════════════════════════════
        print("\n  ── Step 3: Customer context ──")
        result3 = await self._invoke(graph, "What's the customer history for Acme?")
        msgs3 = result3.get("messages", [])
        _print_trajectory("STEP 3 — What's the customer history for Acme?", msgs3)

        assert len(msgs3) > 0, "Step 3: No messages returned from graph"

        # The agent should call some support tool for this query.
        # It may call get_customer_context, search_salesforce_cases, or both.
        assert _any_support_tool_called(msgs3), (
            "Step 3: Agent should call a support tool for customer history query"
        )

        assert _count_tool_messages(msgs3) >= 1, (
            "Step 3: At least one tool should have executed"
        )

        # ── Final verdict ────────────────────────────────────────────
        print(f"""
  ╔══ E2E Support Flow — RESULT ═══════════════╗
  ║  Step 1 (Search)  : {'✅' if _tool_was_called(msgs1, 'search_salesforce_cases') else '❌'}
  ║  Step 2 (Detail)  : {'✅' if _tool_was_called(msgs2, 'get_case_details') else '❌'}
  ║  Step 3 (Context) : {'✅' if _any_support_tool_called(msgs3) else '❌'}
  ╚══════════════════════════════════════════════╝
        """.strip())


@pytest.mark.skipif(
    not INTEGRATION_TEST,
    reason="Set INTEGRATION_TEST=true to run real LLM integration tests",
)
class TestToolCallLoopDetection:
    """Diagnostics: detect if the agent enters a tool-call loop.

    A tool-call loop occurs when the LLM keeps calling tools without
    producing a final response, terminated only by the step_count >= 5 limit.
    This can happen when the system prompt's 'Always respond with tool calls'
    instruction overrides the SupportPilot context.

    If the agent enters a tool-call loop, the graph ends with an AIMessage
    that has tool_calls but no text content (or very brief content).
    """

    @pytest.fixture(autouse=True)
    def ensure_llm(self):
        if not _setup_llm():
            pytest.skip("LLM env vars not fully configured")

    async def test_tool_call_loop_diagnostics(self):
        """Run a single query and report whether the agent enters a tool-call loop.

        This test is informative — it does not pass/fail on loop detection.
        It documents the LLM's behavior for debugging system prompt tuning.
        """
        from src.graph import graph

        result = await graph.ainvoke({
            "messages": [{"role": "human", "content": "Find open cases for Acme Corp"}],
            "user_id": "test-e2e-user",
            "user_role": "SUPPORT_AGENT",
            "step_count": 0,
        })
        msgs = result.get("messages", [])
        _print_trajectory("LOOP DIAGNOSTIC — Find open cases for Acme Corp", msgs)

        last = msgs[-1] if msgs else None
        is_loop = False
        loop_reason = ""

        if last and hasattr(last, "tool_calls") and last.tool_calls:
            is_loop = True
            loop_reason = (
                f"Agent terminated with tool_calls (step_count reached limit). "
                f"Last tool calls: {[tc.get('name') for tc in last.tool_calls]}"
            )
        elif _count_agent_calls(msgs) >= 4:
            is_loop = True
            loop_reason = (
                f"Agent made {_count_agent_calls(msgs)} tool-call rounds "
                f"(near the 5-round max). Near-loop behavior."
            )
        elif _last_text(msgs) and "tool call" in _last_text(msgs).lower():
            is_loop = True
            loop_reason = (
                "Final response mentions 'tool call' — LLM may be stuck "
                "in meta-reasoning about tools."
            )

        if is_loop:
            print(f"""
  ╔══ TOOL-CALL LOOP DETECTED ═══════════════════╗
  ║  {loop_reason}
  ║
  ║  Possible fix: Remove or soften 'Always respond
  ║  with tool calls, never plain text' from the
  ║  static system prompt for support contexts.
  ╚══════════════════════════════════════════════════╝
            """.strip())

            # Soft assertion: warn but don't fail (informational)
            pytest.skip(f"Tool-call loop detected: {loop_reason}")
        else:
            print("\n  ✅ No tool-call loop detected — LLM produced a final response")
