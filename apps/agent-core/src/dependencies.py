"""
Dependency injection - Initialize ONCE at startup, reuse everywhere.
Critical for performance: avoid creating new DB/LLM clients per request.
"""
import asyncpg
import redis.asyncio as aioredis
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
_llm: "Any | None" = None
_langfuse: Langfuse | None = None
_salesforce_client: "MockSalesforceClient | None" = None


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

    provider = os.environ.get("LLM_PROVIDER", "cohere").lower().strip()
    is_mock = provider == "mock"
    print(f"🔧 LLM_PROVIDER={provider}")

    if not is_mock:
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

    from src.llm_config import create_llm

    _llm = create_llm()

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


def get_llm() -> "Any":
    if _llm is None:
        raise RuntimeError("LLM not initialized - ensure lifespan is used")
    return _llm


def get_langfuse() -> "Langfuse | None":
    """Get Langfuse instance for tracing. Returns None if not available."""
    return _langfuse


def get_langfuse_metadata(config: dict = None) -> dict:
    """Get Langfuse metadata from config for tracing."""
    if not config:
        return {"app": "supportpilot"}
    
    if not isinstance(config, dict):
        return {"app": "supportpilot"}
    
    cfg = config.get("configurable", {}) if isinstance(config, dict) else {}
    return {
        "department_id": cfg.get("department_id", "unknown"),
        "role": cfg.get("role", "unknown"),
        "app": "supportpilot",
    }


from typing import Any
RunnableConfig = Any