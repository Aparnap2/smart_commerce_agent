# NO ORM. Raw asyncpg only.
# Uses singleton from src/dependencies.py - initialized once at startup.

import asyncpg
from typing import Any
from src.dependencies import get_pool


async def create_agent_notification(
    customer_id: str, notif_type: str, payload: dict[str, Any]
) -> None:
    pool = get_pool()
    import json
    await pool.execute(
        "INSERT INTO agent_notifications "
        "(id, customer_id, type, payload, read, created_at) "
        "VALUES (gen_random_uuid()::text, $1, $2, $3, false, NOW())",
        customer_id,
        notif_type,
        json.dumps(payload),
    )