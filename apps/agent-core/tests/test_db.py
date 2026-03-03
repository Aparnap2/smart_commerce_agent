# Real Docker postgres — no mocks
import pytest
from db.client import create_agent_notification, get_pool


@pytest.mark.asyncio
async def test_create_notification_writes_to_db():
    """Test that agent notifications can be written to the DB.

    Note: This test requires the AgentNotification table to exist.
    The table is created via Prisma migration.
    """
    pool = await get_pool()

    # Clean up before test - use lowercase table name and column names for asyncpg
    await pool.execute(
        "DELETE FROM agent_notifications WHERE customer_id = $1", "test-user-notify"
    )

    await create_agent_notification(
        customer_id="test-user-notify",
        notif_type="price_alert",
        payload={"productId": "p1", "oldPrice": 999, "newPrice": 799},
    )

    row = await pool.fetchrow(
        "SELECT * FROM agent_notifications WHERE customer_id = $1", "test-user-notify"
    )
    assert row is not None
    assert row["type"] == "price_alert"
    assert row["read"] == False
    payload = row["payload"]
    if isinstance(payload, str):
        import json

        payload = json.loads(payload)
    assert "productId" in payload

    # Cleanup
    await pool.execute(
        "DELETE FROM agent_notifications WHERE customer_id = $1", "test-user-notify"
    )


@pytest.mark.asyncio
async def test_asyncpg_pool_creation():
    """Test that asyncpg pool can be created.

    Note: This verifies agent-core can connect to the same DB as commerce-api.
    Full query testing is done in integration tests.
    """
    # Just verify pool creation works
    pool = await get_pool()
    assert pool is not None
    # Don't close pool here - let lifespan handle it
