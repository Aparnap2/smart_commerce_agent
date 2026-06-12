"""
Dependency injection - Initialize ONCE at startup, reuse everywhere.
Critical for performance: avoid creating new DB/LLM clients per request.
"""
import asyncpg
import redis.asyncio as aioredis
from langchain_openai import ChatOpenAI
from contextlib import asynccontextmanager
from fastapi import FastAPI
import os
from dotenv import load_dotenv

load_dotenv()

# Langfuse - optional (v4.x uses langfuse-langchain for callbacks)
try:
    from langfuse import Langfuse
    _langfuse: Langfuse | None = None
    LANGFUSE_AVAILABLE = True
except ImportError:
    _langfuse = None
    LANGFUSE_AVAILABLE = False

# ── Module-level singletons ──────────────────────
_db_pool: asyncpg.Pool | None = None
_redis: aioredis.Redis | None = None
_llm: "ChatOpenAI | MockLLM | None" = None
_langfuse: Langfuse | None = None
_salesforce_client: "MockSalesforceClient | None" = None


class MockLLM:
    """Mock LLM for testing without real LLM calls."""

    model_name = "mock-llm"

    def __init__(self):
        self._mock_responses = {
            "laptop": {
                "content": "Here are the laptops available in our catalog:",
                "__ui__": {
                    "name": "catalog-grid",
                    "props": {
                        "items": [
                            {"id": "1", "name": "MacBook Pro 14\"", "price": 199900, "category": "HARDWARE", "image": "https://example.com/mbp.jpg", "inStock": True},
                            {"id": "2", "name": "Dell XPS 15", "price": 149900, "category": "HARDWARE", "image": "https://example.com/xps.jpg", "inStock": True},
                            {"id": "3", "name": "ThinkPad X1 Carbon", "price": 129900, "category": "HARDWARE", "image": "https://example.com/thinkpad.jpg", "inStock": True},
                            {"id": "4", "name": "HP Spectre x360", "price": 119900, "category": "HARDWARE", "image": "https://example.com/spectre.jpg", "inStock": False},
                        ],
                        "loading": False,
                    },
                },
            },
            "budget": {
                "content": "Your department budget status:",
                "__ui__": {
                    "name": "budget-gauge",
                    "props": {
                        "totalBudget": 5000000,
                        "spent": 3250000,
                        "remaining": 1750000,
                        "percentUsed": 65,
                        "categoryBreakdown": [
                            {"category": "HARDWARE", "spent": 2000000, "budget": 3000000},
                            {"category": "SOFTWARE", "spent": 800000, "budget": 1000000},
                            {"category": "SERVICES", "spent": 450000, "budget": 1000000},
                        ],
                    },
                },
            },
            "pr": {
                "content": "I've created a draft PR for your review:",
                "__ui__": {
                    "name": "pr-draft",
                    "props": {
                        "prNumber": "PR-2026-0042",
                        "status": "DRAFT",
                        "requestor": "john.doe@company.com",
                        "items": [
                            {"name": "MacBook Pro 14\"", "quantity": 2, "totalPrice": 399800},
                            {"name": "Dell Monitor 27\"", "quantity": 4, "totalPrice": 199600},
                        ],
                        "total": 599400,
                        "justification": "Engineering team upgrade for Q2 projects",
                        "createdAt": "2026-05-20T10:30:00Z",
                    },
                },
            },
        }

    async def ainvoke(self, messages, config=None):
        """Return mock response based on last user message."""
        from langchain_core.messages import AIMessage
        import json

        last_msg = messages[-1] if messages else None
        user_message = ""
        if hasattr(last_msg, "content"):
            user_message = last_msg.content.lower()

        response_data = None
        if any(k in user_message for k in ["laptop", "laptops", "computer", "macbook", "dell", "thinkpad"]):
            response_data = self._mock_responses["laptop"]
        elif any(k in user_message for k in ["budget", "spending", "funds", "remaining"]):
            response_data = self._mock_responses["budget"]
        elif any(k in user_message for k in ["pr", "purchase request", "create pr", "draft"]):
            response_data = self._mock_responses["pr"]
        else:
            response_data = {
                "content": "This is a mock response. Try asking about 'laptops', 'budget', or 'create pr'.",
                "__ui__": None,
            }

        content = json.dumps(response_data)
        return AIMessage(content=content)

    def bind_tools(self, tools):
        return self


def init_salesforce_client(
    mode: str | None = None,
    api_key: str | None = None,
    instance_url: str | None = None,
):
    """Initialize the global Salesforce client singleton.

    Args:
        mode: 'mock' (default) or 'live'. Falls back to SALESFORCE_MODE env var.
        api_key: Optional Salesforce API key. Falls back to SALESFORCE_API_KEY env var.
        instance_url: Optional Salesforce instance URL. Falls back to SALESFORCE_INSTANCE_URL env var.
    """
    global _salesforce_client
    from src.salesforce import MockSalesforceClient

    _salesforce_client = MockSalesforceClient(
        mode=mode or os.environ.get("SALESFORCE_MODE", "mock"),
        api_key=api_key or os.environ.get("SALESFORCE_API_KEY"),
        instance_url=instance_url or os.environ.get("SALESFORCE_INSTANCE_URL"),
    )
    print(f"✅ Salesforce client initialized (mode={_salesforce_client.mode})")
    return _salesforce_client


def get_salesforce_client():
    """Get the global Salesforce client singleton."""
    return _salesforce_client


def shutdown_salesforce_client():
    """Clean up Salesforce client on shutdown."""
    global _salesforce_client
    _salesforce_client = None
    print("✅ Salesforce client shutdown")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize all clients ONCE at startup."""
    global _db_pool, _redis, _llm, _salesforce_client

    mock_llm = os.environ.get("MOCK_LLM", "false").lower() == "true"
    print(f"🔧 MOCK_LLM={mock_llm}")

    if not mock_llm:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL not set")

        _db_pool = await asyncpg.create_pool(
            database_url,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )
        print(f"✅ DB pool initialized")

        redis_url = os.environ.get("REDIS_URL")
        if redis_url:
            _redis = await aioredis.from_url(
                redis_url,
                decode_responses=True,
            )
            print(f"✅ Redis initialized")

    if mock_llm:
        _llm = MockLLM()
        print(f"✅ Mock LLM initialized (MOCK_LLM=true)")
    else:
        llm_model = os.environ.get("OLLAMA_MODEL", "nemotron-3-super:cloud")
        llm_base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        llm_api_key = os.environ.get("OLLAMA_API_KEY", "ollama")

        _llm = ChatOpenAI(
            model=llm_model,
            temperature=0,
            base_url=llm_base_url,
            api_key=llm_api_key,
        )
        print(f"✅ LLM initialized: {llm_model}")

    if LANGFUSE_AVAILABLE:
        global _langfuse
        _langfuse = Langfuse()
        print("✅ Langfuse initialized")

    # Initialize Salesforce client (always, even in mock mode)
    init_salesforce_client()
    print("✅ Salesforce client initialized")

    yield  # ← app runs here

    # Clean shutdown
    if _db_pool:
        await _db_pool.close()
        print("✅ DB pool closed")
    if _redis:
        await _redis.aclose()
        print("✅ Redis closed")
    shutdown_salesforce_client()


def get_pool() -> asyncpg.Pool:
    if _db_pool is None:
        raise RuntimeError("DB pool not initialized - ensure lifespan is used")
    return _db_pool


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialized - ensure lifespan is used")
    return _redis


def get_llm() -> "ChatOpenAI | MockLLM":
    if _llm is None:
        raise RuntimeError("LLM not initialized - ensure lifespan is used")
    return _llm


def get_langfuse() -> "Langfuse | None":
    """Get Langfuse instance for tracing. Returns None if not available."""
    return _langfuse


def get_langfuse_metadata(config: dict = None) -> dict:
    """Get Langfuse metadata from config for tracing (PRD Part 9)."""
    if not config:
        return {"app": "procureai"}
    
    # Handle non-dict config - return default app only
    if not isinstance(config, dict):
        return {"app": "procureai"}
    
    cfg = config.get("configurable", {}) if isinstance(config, dict) else {}
    return {
        "department_id": cfg.get("department_id", "unknown"),
        "role": cfg.get("role", "unknown"),
        "app": "procureai",
    }


from typing import Any
RunnableConfig = Any