"""Observability setup - Langfuse + OpenTelemetry + Prometheus."""
import os
from langfuse import Langfuse
from langfuse.decorators import observe
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanExporter
from prometheus_client import Counter, Histogram, generate_latest

# Langfuse client
_langfuse: Langfuse | None = None

def init_langfuse():
    global _langfuse
    _langfuse = Langfuse(
        public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
        secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
        host=os.getenv("LANGFUSE_BASE_URL", "http://localhost:3001"),
    )

def get_langfuse() -> Langfuse | None:
    return _langfuse

# OpenTelemetry tracer
provider = TracerProvider()
processor = BatchSpanExporter()
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

# Prometheus metrics
LLM_CALLS = Counter("llm_calls_total", "Total LLM calls", ["model", "status"])
LLM_LATENCY = Histogram("llm_call_duration_seconds", "LLM call latency", ["model"])
TOOL_CALLS = Counter("tool_calls_total", "Total tool calls", ["tool_name", "status"])
TOOL_LATENCY = Histogram("tool_call_duration_seconds", "Tool call latency", ["tool_name"])
AGENT_STEPS = Counter("agent_steps_total", "Total agent steps", ["user_role"])

def get_metrics():
    """Expose Prometheus metrics."""
    return generate_latest()
