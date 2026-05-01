"""
DB Pool - uses singleton from dependencies.py
Initialized once at startup, reused everywhere.
"""
import asyncpg
from src.dependencies import get_pool as get_pool_singleton


async def get_pool() -> asyncpg.Pool:
    """Get DB pool from singleton - avoids creating new pool per request."""
    return get_pool_singleton()


async def close_pool():
    """No-op - pool is closed via dependencies lifespan"""
    pass