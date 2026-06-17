"""LLM-free deterministic testing of LangGraph agent infrastructure.

No real LLM calls — all tests use MockLLM variants, deterministic state
builders, and isolated node/tool execution. Covers:

- Individual graph node functions (load_context, should_continue,
  check_approval_node, build_system_prompt, strip_ui_from_messages, etc.)
- Multi-turn graph trajectories (agent→tools cycle, HITL approval gate,
  5+ step auto-termination, error propagation)
- SSE streaming contract (messages/partial, custom/ui, end/complete events)
- State machine transitions (all conditional edge paths)
"""
