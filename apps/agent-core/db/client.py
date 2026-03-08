# NO ORM. Raw asyncpg only.
# Only used for AgentNotification inserts.
# ALL other data access goes through graphql_tool.py → commerce-api

import asyncpg, os, json
from typing import Any

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            os.environ["DATABASE_URL"], min_size=2, max_size=10
        )
    return _pool


async def create_agent_notification(
    customer_id: str, notif_type: str, payload: dict[str, Any]
) -> None:
    pool = await get_pool()
    # Use lowercase column names as mapped by Prisma
    await pool.execute(
        "INSERT INTO agent_notifications "
        "(id, customer_id, type, payload, read, created_at) "
        "VALUES (gen_random_uuid()::text, $1, $2, $3, false, NOW())",
        customer_id,
        notif_type,
        json.dumps(payload),
    )


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
