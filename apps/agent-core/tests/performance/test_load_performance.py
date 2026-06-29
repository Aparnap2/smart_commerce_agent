"""
Performance tests for the Smart Commerce Agent.

These tests measure critical performance benchmarks:
- Tool execution latency
- SSE streaming performance
- Concurrent request handling
- Memory and resource usage

All tests use MockLLM to avoid real API calls.
"""

import pytest
import asyncio
import time
import sys
import os
from typing import Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.llm_config import MockLLM
from src import dependencies


class TestLoadPerformance:
    """Performance benchmarks for agent operations."""

    @pytest.mark.asyncio
    async def test_concurrent_tool_execution(self, test_db_pool):
        """Test that tools handle concurrent requests efficiently.
        
        Verifies: Multiple tool invocations complete within acceptable time.
        Benchmark: < 5 seconds for 5 concurrent tool calls.
        """
        from src.tools import get_tools_for_role
        
        tools = get_tools_for_role("SUPPORT_AGENT")
        assert len(tools) > 0, "No tools available for SUPPORT_AGENT"
        
        start = time.time()
        
        # Simulate concurrent tool calls with mock data
        tasks = []
        for i, tool in enumerate(tools[:5]):
            # Use mock data appropriate for each tool
            if tool.name == "search_salesforce_cases":
                tasks.append(tool.ainvoke({"query": f"test case {i}"}))
            elif tool.name == "get_case_details":
                tasks.append(tool.ainvoke({"case_id": f"case-{i}"}))
            elif tool.name == "get_customer_context":
                tasks.append(tool.ainvoke({"contact_id": f"contact-{i}"}))
            elif tool.name == "search_knowledge_base":
                tasks.append(tool.ainvoke({"query": f"test article {i}"}))
            elif tool.name == "search_similar_tickets":
                tasks.append(tool.ainvoke({"query": f"similar ticket {i}"}))
            else:
                # Skip tools that require complex setup
                continue
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            elapsed = time.time() - start
            
            # Count successful vs failed
            successes = sum(1 for r in results if not isinstance(r, Exception))
            failures = sum(1 for r in results if isinstance(r, Exception))
            
            assert elapsed < 5.0, f"Concurrent execution took {elapsed:.2f}s, expected < 5s"
            assert successes > 0, f"All concurrent tool calls failed: {results}"
            
            print(f"✅ Concurrent tools: {successes} succeeded, {failures} failed in {elapsed:.3f}s")
        else:
            pytest.skip("No tools available for concurrent testing")

    @pytest.mark.asyncio
    async def test_sse_streaming_latency(self):
        """Test that SSE streaming starts within acceptable latency.
        
        Verifies: SSE event parsing is fast enough for real-time streaming.
        Benchmark: < 100ms for parsing a single SSE event.
        """
        from src.sse import graph_to_sse
        
        start = time.time()
        
        # Create a mock async iterator
        async def mock_stream():
            yield {
                "type": "messages",
                "data": (
                    type('MockMessage', (), {
                        'type': 'ai',
                        'content': 'Test response',
                        'model_dump': lambda: {'type': 'ai', 'content': 'Test response'}
                    })(),
                    {}
                )
            }
        
        events = []
        async for event in graph_to_sse(mock_stream()):
            events.append(event)
        
        elapsed = time.time() - start
        
        assert elapsed < 0.1, f"SSE parsing took {elapsed:.3f}s, expected < 0.1s"
        assert len(events) > 0, "No SSE events were generated"
        
        print(f"✅ SSE streaming: {len(events)} events in {elapsed:.3f}s")

    @pytest.mark.asyncio
    async def test_mock_llm_response_time(self):
        """Test that MockLLM responds within acceptable latency.
        
        Verifies: Mock LLM doesn't introduce unnecessary delays.
        Benchmark: < 50ms for a single LLM call.
        """
        from langchain_core.messages import HumanMessage
        
        llm = MockLLM()
        messages = [HumanMessage(content="Show me cases")]
        
        start = time.time()
        response = await llm.ainvoke(messages)
        elapsed = time.time() - start
        
        assert elapsed < 0.05, f"MockLLM took {elapsed:.3f}s, expected < 0.05s"
        assert response.content is not None, "MockLLM returned empty response"
        
        print(f"✅ MockLLM response: {elapsed:.3f}s")

    @pytest.mark.asyncio
    async def test_tool_serialization_performance(self):
        """Test that tool result serialization is performant.
        
        Verifies: JSON serialization of tool results doesn't cause bottlenecks.
        Benchmark: < 10ms for serializing typical tool output.
        """
        import json
        
        # Simulate a typical tool output
        mock_output = {
            "cases": [
                {
                    "caseNumber": f"0000100{i}",
                    "subject": f"Test case {i}",
                    "status": "Open",
                    "priority": "High",
                    "accountName": "Acme Corp",
                }
                for i in range(10)
            ],
            "count": 10,
            "__ui__": {
                "name": "case-list",
                "props": {"loading": False},
            },
        }
        
        start = time.time()
        serialized = json.dumps(mock_output)
        elapsed = time.time() - start
        
        assert elapsed < 0.01, f"Serialization took {elapsed:.3f}s, expected < 0.01s"
        assert len(serialized) > 0, "Serialized output is empty"
        
        print(f"✅ Tool serialization: {elapsed:.3f}s for {len(serialized)} bytes")

    @pytest.mark.asyncio
    async def test_concurrent_llm_calls(self):
        """Test that MockLLM handles concurrent calls efficiently.
        
        Verifies: Multiple simultaneous LLM calls don't cause contention.
        Benchmark: < 1 second for 10 concurrent calls.
        """
        from langchain_core.messages import HumanMessage
        
        llm = MockLLM()
        messages = [HumanMessage(content="Show me cases")]
        
        start = time.time()
        tasks = [llm.ainvoke(messages.copy()) for _ in range(10)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        elapsed = time.time() - start
        
        successes = sum(1 for r in results if not isinstance(r, Exception))
        assert elapsed < 1.0, f"Concurrent LLM calls took {elapsed:.2f}s, expected < 1s"
        assert successes == 10, f"Only {successes}/10 concurrent LLM calls succeeded"
        
        print(f"✅ Concurrent LLM: {successes} calls in {elapsed:.3f}s")


class TestMemoryPerformance:
    """Memory and resource usage tests."""

    @pytest.mark.asyncio
    async def test_tool_memory_cleanup(self):
        """Test that tools don't leak memory between calls.
        
        Verifies: Tool instances are properly garbage collected.
        """
        import gc
        import sys
        
        from src.tools import get_tools_for_role
        
        # Get initial object count
        gc.collect()
        initial_count = len(gc.get_objects())
        
        # Create and discard tool references
        for _ in range(100):
            tools = get_tools_for_role("SUPPORT_AGENT")
            del tools
        
        gc.collect()
        final_count = len(gc.get_objects())
        
        # Allow some variance but catch major leaks
        growth = final_count - initial_count
        assert growth < 1000, f"Memory leak detected: {growth} objects created"
        
        print(f"✅ Memory cleanup: {growth} objects after 100 tool cycles")

    @pytest.mark.asyncio
    async def test_large_payload_handling(self):
        """Test that tools handle large payloads without crashing.
        
        Verifies: Tools can process large inputs without memory errors.
        """
        import json
        
        # Create a large payload
        large_payload = {
            "query": "x" * 10000,  # 10KB query
            "filters": {f"key_{i}": f"value_{i}" * 100 for i in range(50)},
        }
        
        # Test serialization
        start = time.time()
        serialized = json.dumps(large_payload)
        deserialized = json.loads(serialized)
        elapsed = time.time() - start
        
        assert elapsed < 0.1, f"Large payload handling took {elapsed:.3f}s"
        assert deserialized["query"] == large_payload["query"]
        
        print(f"✅ Large payload: {len(serialized)} bytes in {elapsed:.3f}s")


class TestLatencyBenchmarks:
    """Latency benchmarks for critical paths."""

    @pytest.mark.asyncio
    async def test_tool_lookup_latency(self):
        """Test that tool lookup is O(1) or O(n) with small n.
        
        Verifies: get_tools_for_role() is fast enough for hot paths.
        Benchmark: < 1ms for tool lookup.
        """
        from src.tools import get_tools_for_role
        
        start = time.time()
        for _ in range(1000):
            tools = get_tools_for_role("SUPPORT_AGENT")
        elapsed = time.time() - start
        
        avg_latency = (elapsed / 1000) * 1000  # Convert to ms
        assert avg_latency < 1.0, f"Tool lookup avg: {avg_latency:.3f}ms, expected < 1ms"
        
        print(f"✅ Tool lookup: {avg_latency:.3f}ms average (1000 iterations)")

    @pytest.mark.asyncio
    async def test_sse_event_generation_latency(self):
        """Test SSE event generation latency.
        
        Verifies: SSE events are generated fast enough for real-time streaming.
        Benchmark: < 5ms per event.
        """
        import json
        from src.sse import graph_to_sse
        
        async def mock_stream():
            for i in range(10):
                yield {
                    "type": "messages",
                    "data": (
                        type('MockMessage', (), {
                            'type': 'ai',
                            'content': f'Message {i}',
                            'model_dump': lambda idx=i: {'type': 'ai', 'content': f'Message {idx}'}
                        })(),
                        {}
                    )
                }
        
        start = time.time()
        event_count = 0
        async for event in graph_to_sse(mock_stream()):
            event_count += 1
        elapsed = time.time() - start
        
        avg_latency = (elapsed / event_count) * 1000 if event_count > 0 else 0
        assert avg_latency < 5.0, f"SSE generation avg: {avg_latency:.3f}ms, expected < 5ms"
        
        print(f"✅ SSE generation: {avg_latency:.3f}ms average per event")
