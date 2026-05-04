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
_llm: ChatOpenAI | None = None
_langfuse: Langfuse | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize all clients ONCE at startup."""
    global _db_pool, _redis, _llm

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not set")

    _db_pool = await asyncpg.create_pool(
        database_url,
        min_size=2,
        max_size=10,
        command_timeout=60,
    )
    print(f"✅ DB pool initialized: {database_url}")

    redis_url = os.environ.get("REDIS_URL")
    if redis_url:
        _redis = await aioredis.from_url(
            redis_url,
            decode_responses=True,
        )
        print(f"✅ Redis initialized: {redis_url}")

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

    yield  # ← app runs here

    # Clean shutdown
    if _db_pool:
        await _db_pool.close()
        print("✅ DB pool closed")
    if _redis:
        await _redis.aclose()
        print("✅ Redis closed")


def get_pool() -> asyncpg.Pool:
    if _db_pool is None:
        raise RuntimeError("DB pool not initialized - ensure lifespan is used")
    return _db_pool


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialized - ensure lifespan is used")
    return _redis


def get_llm() -> ChatOpenAI:
    if _llm is None:
        raise RuntimeError("LLM not initialized - ensure lifespan is used")
    return _llm


def get_langfuse_metadata(config: dict = None) -> dict:
    """Get Langfuse metadata from config for tracing (PRD Part 9)."""
    if not config:
        return {"app": "procureai"}
    cfg = config.get("configurable", {}) if isinstance(config, dict) else {}
    return {
        "department_id": cfg.get("department_id", "unknown"),
        "role": cfg.get("role", "unknown"),
        "app": "procureai",
    }


from typing import Any
RunnableConfig = Any