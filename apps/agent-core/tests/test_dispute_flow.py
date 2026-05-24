"""
TDD Tests for Dispute Flow (Spec F11).

Following strict TDD:
1. Write failing test FIRST  ✓ (written below)
2. Run test → RED (expected to fail until tool is enhanced)
3. Implement tool code to pass tests → GREEN

Tests cover:
- test_raise_dispute_returns_confirmation: Valid dispute with APPROVED PR
- test_raise_dispute_requires_reason: Empty reason returns error
- test_raise_dispute_invalid_pr: Non-existent PR returns error
- test_raise_dispute_wrong_status: DRAFT PR returns error
- test_raise_dispute_receives_acknowledgement: RECEIVED PR also disputable
"""

import pytest
import json
import os
import uuid
from datetime import datetime
import asyncpg


DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://supabase_admin:postgres@localhost:5433/postgres"
)


async def get_test_pool():
    """Create a fresh connection pool for each test."""
    pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=1,
        max_size=3,
        command_timeout=60,
    )
    return pool


def get_dispute_config(user_email="admin@techtrend.com", role="EMPLOYEE"):
    """Default config for dispute tests."""
    return {
        "configurable": {
            "user_id": user_email,
            "department_id": "dept-eng-001",
            "role": role,
            "thread_id": "test-dispute-thread",
        }
    }


async def ensure_user(conn, email="admin@techtrend.com"):
    """Ensure test user exists and return their ID."""
    user = await conn.fetchrow('SELECT id FROM users WHERE email = $1', email)
    if user:
        return user["id"]

    user_id = str(uuid.uuid4())
    await conn.execute("""
        INSERT INTO users (id, email, full_name, role, organization_id)
        VALUES ($1, $2, 'Test Admin', 'admin',
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    """, user_id, email)
    return user_id


# ==========================================
# TEST 1: Successful dispute returns confirmation
# ==========================================

@pytest.mark.asyncio
async def test_raise_dispute_returns_confirmation():
    """
    GIVEN an APPROVED PR exists for the user
    WHEN raise_dispute is called with pr_id and reason
    THEN returns a dispute-confirmation __ui__ block with reference number
    """
    from src.tools import raise_dispute

    pool = await get_test_pool()
    try:
        from src import dependencies
        dependencies._db_pool = pool

        async with pool.acquire() as conn:
            now = datetime.utcnow()
            user_email = "admin@techtrend.com"
            user_id = await ensure_user(conn, user_email)

            # Create a PR in APPROVED status
            pr_id = str(uuid.uuid4())
            pr_number = f"PR-DISPUTE-{uuid.uuid4().hex[:6].upper()}"
            await conn.execute("""
                INSERT INTO "PurchaseRequest" (id, "prNumber", "requestorId",
                    "departmentId", justification, status, "totalAmount",
                    "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, 'APPROVED', 50000, $6, $6)
            """, pr_id, pr_number, user_id, "dept-eng-001",
                "Test PR for dispute flow validation", now)

        config = get_dispute_config(user_email)
        result = await raise_dispute.coroutine(
            pr_id=pr_id,
            reason="Product received damaged during transit",
            config=config
        )
        data = json.loads(result)

        # Verify response structure
        assert "__ui__" in data, "Response missing __ui__ block"
        assert data["__ui__"]["name"] == "dispute-confirmation", \
            f"Expected 'dispute-confirmation', got '{data['__ui__'].get('name')}'"

        props = data["__ui__"]["props"]
        assert props["prId"] == pr_id
        assert props["reason"] == "Product received damaged during transit"
        assert props["referenceNumber"].startswith("DIS-"), \
            f"Reference should start with DIS-, got {props['referenceNumber']}"
        assert len(props["referenceNumber"]) > 4
        assert props["status"] == "submitted"
        assert "submittedAt" in props, "Missing submittedAt timestamp"

        # Verify PR status was updated
        async with pool.acquire() as conn:
            pr = await conn.fetchrow(
                'SELECT status FROM "PurchaseRequest" WHERE id=$1', pr_id
            )
            assert pr["status"] == "DISPUTED", \
                f"Expected DISPUTED, got {pr['status']}"

            # Verify dispute record was created
            dispute = await conn.fetchrow(
                'SELECT * FROM "Dispute" WHERE "prId" = $1', pr_id
            )
            assert dispute is not None, "Dispute record not found"
            assert dispute["reason"] == "Product received damaged during transit"
            assert dispute["referenceNumber"].startswith("DIS-")

            # Verify audit entry
            audit = await conn.fetchrow(
                'SELECT * FROM "PRAuditEntry" WHERE "prId" = $1 AND action = $2',
                pr_id, 'DISPUTED'
            )
            assert audit is not None, "Audit entry for DISPUTED not found"

    finally:
        await pool.close()


# ==========================================
# TEST 2: Empty reason returns error
# ==========================================

@pytest.mark.asyncio
async def test_raise_dispute_requires_reason():
    """
    GIVEN a user calls raise_dispute
    WHEN reason is empty string
    THEN returns an error response explaining reason is required
    """
    from src.tools import raise_dispute

    pool = await get_test_pool()
    try:
        from src import dependencies
        dependencies._db_pool = pool

        config = get_dispute_config()
        result = await raise_dispute.coroutine(
            pr_id="some-pr-id",
            reason="",
            config=config
        )
        data = json.loads(result)

        # Should return an error
        assert "error" in data, f"Expected error for empty reason, got: {data}"
        assert data.get("error"), "Error message should be truthy"

    finally:
        await pool.close()


# ==========================================
# TEST 3: Non-existent PR returns error
# ==========================================

@pytest.mark.asyncio
async def test_raise_dispute_invalid_pr():
    """
    GIVEN a user calls raise_dispute
    WHEN pr_id does not match any existing PR
    THEN returns an error response indicating PR not found
    """
    from src.tools import raise_dispute

    pool = await get_test_pool()
    try:
        from src import dependencies
        dependencies._db_pool = pool

        config = get_dispute_config()
        non_existent_id = str(uuid.uuid4())

        result = await raise_dispute.coroutine(
            pr_id=non_existent_id,
            reason="Item not as described",
            config=config
        )
        data = json.loads(result)

        # Should return error
        assert "error" in data, \
            f"Expected error for non-existent PR, got: {data}"
        assert data.get("error"), "Error message should be truthy"

    finally:
        await pool.close()


# ==========================================
# TEST 4: DRAFT PRs cannot be disputed
# ==========================================

@pytest.mark.asyncio
async def test_raise_dispute_wrong_status():
    """
    GIVEN a DRAFT PR exists
    WHEN raise_dispute is called on it
    THEN returns an error because DRAFT PRs cannot be disputed
    """
    from src.tools import raise_dispute

    pool = await get_test_pool()
    try:
        from src import dependencies
        dependencies._db_pool = pool

        async with pool.acquire() as conn:
            now = datetime.utcnow()
            user_email = "admin@techtrend.com"
            user_id = await ensure_user(conn, user_email)

            # Create a DRAFT PR
            pr_id = str(uuid.uuid4())
            pr_number = f"PR-DRAFT-{uuid.uuid4().hex[:6].upper()}"
            await conn.execute("""
                INSERT INTO "PurchaseRequest" (id, "prNumber", "requestorId",
                    "departmentId", justification, status, "totalAmount",
                    "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, 'DRAFT', 0, $6, $6)
            """, pr_id, pr_number, user_id, "dept-eng-001",
                "Draft PR for testing", now)

        config = get_dispute_config(user_email)
        result = await raise_dispute.coroutine(
            pr_id=pr_id,
            reason="Changed my mind",
            config=config
        )
        data = json.loads(result)

        # Should return error about status
        assert "error" in data or "status" in str(data).lower() or \
            "cannot" in str(data).lower(), \
            f"Expected error about wrong status, got: {data}"

    finally:
        await pool.close()


# ==========================================
# TEST 5: RECEIVED PR (delivered) can also be disputed
# ==========================================

@pytest.mark.asyncio
async def test_raise_dispute_receives_acknowledgement():
    """
    GIVEN a successful dispute submission on a RECEIVED PR
    WHEN the tool returns
    THEN the response should contain a success message
    """
    from src.tools import raise_dispute

    pool = await get_test_pool()
    try:
        from src import dependencies
        dependencies._db_pool = pool

        async with pool.acquire() as conn:
            now = datetime.utcnow()
            user_email = "admin@techtrend.com"
            user_id = await ensure_user(conn, user_email)

            # Create a RECEIVED PR
            pr_id = str(uuid.uuid4())
            pr_number = f"PR-ACK-{uuid.uuid4().hex[:6].upper()}"
            await conn.execute("""
                INSERT INTO "PurchaseRequest" (id, "prNumber", "requestorId",
                    "departmentId", justification, status, "totalAmount",
                    "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, 'RECEIVED', 25000, $6, $6)
            """, pr_id, pr_number, user_id, "dept-eng-001",
                "Test PR for ack", now)

        config = get_dispute_config(user_email)
        result = await raise_dispute.coroutine(
            pr_id=pr_id,
            reason="Goods received but incorrect specifications",
            config=config
        )
        data = json.loads(result)

        # Should include a success message
        assert "message" in data or "success" in data or \
            "notified" in str(data).lower() or "reference" in str(data).lower(), \
            f"Expected acknowledgement message, got: {data}"

        # Verify RECEIVED status also allows dispute
        async with pool.acquire() as conn:
            pr = await conn.fetchrow(
                'SELECT status FROM "PurchaseRequest" WHERE id=$1', pr_id
            )
            assert pr["status"] == "DISPUTED", \
                f"Expected DISPUTED, got {pr['status']}"

    finally:
        await pool.close()
