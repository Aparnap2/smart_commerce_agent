"""
TDD Tests for Budget Timing - Audit Fix #1.

BUDGET TIMING AUDIT REQUIREMENT:
- add_item: Should NOT debit budget (items are in draft)
- APPROVED decision: MUST debit spentThisMonth
- REJECTED decision: Should NOT change spentThisMonth

TDD Process:
1. Write failing test FIRST
2. Run test → RED (should fail with current code)
3. Implement code to pass test → GREEN
4. Refactor if needed
"""
import pytest
import json
import uuid
from datetime import datetime


async def get_test_pool():
    """Create a fresh async connection pool for tests."""
    import os
    import asyncpg

    DATABASE_URL = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/techtrend"
    )

    pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=1,
        max_size=3,
        command_timeout=60,
    )

    return pool


async def setup_test_data(pool):
    """Set up test data and return IDs."""
    async with pool.acquire() as conn:
        # Get department
        dept = await conn.fetchrow("""
            SELECT id FROM "Department" WHERE name = 'Engineering' LIMIT 1
        """)
        if not dept:
            return None
        test_dept_id = dept["id"]

        # Get or create user
        user = await conn.fetchrow("""
            SELECT id FROM users WHERE email = 'admin@techtrend.com' LIMIT 1
        """)
        if not user:
            test_user_id = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO users (id, email, "passwordHash", role, "employeeRole", "departmentId", created_at, updated_at)
                VALUES ($1, 'admin@techtrend.com', 'test-hash', 'ADMIN', 'ADMIN', $2, NOW(), NOW())
            """, test_user_id, test_dept_id)
        else:
            test_user_id = user["id"]

        # Get catalog item
        item = await conn.fetchrow('SELECT id FROM "CatalogItem" LIMIT 1')
        if not item:
            return None
        test_item_id = item["id"]

        # Create test PR
        test_pr_id = str(uuid.uuid4())
        test_pr_number = f"TEST-PR-{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        await conn.execute("""
            INSERT INTO "PurchaseRequest"
              (id, "prNumber", "requestorId", "departmentId", justification, urgency, status, "totalAmount", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, 'Budget timing test', 'NORMAL', 'DRAFT', 0, NOW(), NOW())
        """, test_pr_id, test_pr_number, test_user_id, test_dept_id)

        # Reset department spent
        await conn.execute('UPDATE "Department" SET "spentThisMonth" = 0 WHERE id = $1', test_dept_id)

        return {
            "dept_id": test_dept_id,
            "user_id": test_user_id,
            "item_id": test_item_id,
            "pr_id": test_pr_id,
        }


async def cleanup_test_data(pool, pr_id):
    """Clean up test data."""
    async with pool.acquire() as conn:
        await conn.execute('DELETE FROM "PRAuditEntry" WHERE "prId" = $1', pr_id)
        await conn.execute('DELETE FROM "PRLineItem" WHERE "prId" = $1', pr_id)
        await conn.execute('DELETE FROM "PRApproval" WHERE "prId" = $1', pr_id)
        await conn.execute('DELETE FROM "PurchaseRequest" WHERE id = $1', pr_id)


@pytest.mark.asyncio
async def test_add_item_does_not_debit_budget():
    """
    AUDIT FIX #1.1: add_item should NOT change spentThisMonth.

    GIVEN dept with spentThisMonth = 0
    WHEN user adds item to draft PR (action='add_item')
    THEN spentThisMonth should REMAIN 0 (no budget debit)
    """
    from src.tools import manage_purchase_request

    # Create fresh pool for this test
    pool = await get_test_pool()
    
    try:
        # Set dependencies pool
        from src import dependencies
        dependencies._db_pool = pool

        # Setup
        data = await setup_test_data(pool)
        if not data:
            pytest.skip("Test data not available")

        tool_config = {
            "configurable": {
                "user_id": "admin@techtrend.com",
                "department_id": data["dept_id"],
                "role": "EMPLOYEE",
                "thread_id": "test-thread",
            }
        }

        # Execute
        tool_func = manage_purchase_request.coroutine
        result = await tool_func(
            action="add_item",
            pr_id=data["pr_id"],
            catalog_item_id=data["item_id"],
            quantity=1,
            config=tool_config,
        )

        result_data = json.loads(result)
        assert result_data.get("success") is True, f"add_item failed: {result}"

        # Verify budget NOT debited
        async with pool.acquire() as conn:
            dept = await conn.fetchrow('SELECT "spentThisMonth" FROM "Department" WHERE id = $1', data["dept_id"])
            spent_after = int(dept["spentThisMonth"])

            assert spent_after == 0, (
                f"BUDGET TIMING FAIL: add_item debited budget! "
                f"Expected spentThisMonth=0, got {spent_after}. "
                f"Budget should only be debited on APPROVED."
            )

        # Cleanup
        await cleanup_test_data(pool, data["pr_id"])

    finally:
        pool.close()


@pytest.mark.asyncio
async def test_approval_approved_debits_budget():
    """
    AUDIT FIX #1.2: APPROVED decision MUST increment spentThisMonth.

    GIVEN dept with spentThisMonth = 0, PR with ₹X total
    WHEN process_approval(pr_id, decision='APPROVED')
    THEN spentThisMonth should equal PR totalAmount
    """
    from src.tools import process_approval, manage_purchase_request

    pool = await get_test_pool()
    
    try:
        from src import dependencies
        dependencies._db_pool = pool

        # Setup
        data = await setup_test_data(pool)
        if not data:
            pytest.skip("Test data not available")

        tool_config = {
            "configurable": {
                "user_id": "admin@techtrend.com",
                "department_id": data["dept_id"],
                "role": "EMPLOYEE",
            }
        }

        add_item_func = manage_purchase_request.coroutine
        process_func = process_approval.coroutine

        # Add item to PR
        add_result = await add_item_func(
            action="add_item",
            pr_id=data["pr_id"],
            catalog_item_id=data["item_id"],
            quantity=2,
            config=tool_config,
        )
        add_data = json.loads(add_result)
        assert add_data.get("success") is True

        # Submit for approval
        async with pool.acquire() as conn:
            await conn.execute("UPDATE \"PurchaseRequest\" SET status='PENDING_APPROVAL' WHERE id=$1", data["pr_id"])
            await conn.execute("""
                INSERT INTO "PRApproval" (id, "prId", "approverEmail", status)
                VALUES ($1, $2, $3, 'PENDING')
            """, str(uuid.uuid4()), data["pr_id"], "manager@example.com")

            pr = await conn.fetchrow('SELECT "totalAmount" FROM "PurchaseRequest" WHERE id=$1', data["pr_id"])
            expected_total = int(pr["totalAmount"])

        # Approve
        manager_config = {
            "configurable": {
                "user_email": "manager@example.com",
                "role": "MANAGER",
                "department_id": data["dept_id"],
            }
        }

        approve_result = await process_func(
            pr_id=data["pr_id"],
            decision="APPROVED",
            comments="Approved for budget test",
            config=manager_config,
        )
        approve_data = json.loads(approve_result)
        assert approve_data.get("success") is True

        # Verify budget debited
        async with pool.acquire() as conn:
            dept = await conn.fetchrow('SELECT "spentThisMonth" FROM "Department" WHERE id = $1', data["dept_id"])
            spent_after = int(dept["spentThisMonth"])

            assert spent_after == expected_total, (
                f"BUDGET TIMING FAIL: APPROVED did not debit budget! "
                f"Expected {expected_total}, got {spent_after}."
            )

        await cleanup_test_data(pool, data["pr_id"])

    finally:
        pool.close()


@pytest.mark.asyncio
async def test_approval_rejected_keeps_budget():
    """
    AUDIT FIX #1.3: REJECTED decision should NOT change spentThisMonth.

    GIVEN dept with spentThisMonth = 0
    WHEN process_approval(pr_id, decision='REJECTED')
    THEN spentThisMonth should REMAIN 0
    """
    from src.tools import process_approval, manage_purchase_request

    pool = await get_test_pool()
    
    try:
        from src import dependencies
        dependencies._db_pool = pool

        # Setup
        data = await setup_test_data(pool)
        if not data:
            pytest.skip("Test data not available")

        tool_config = {
            "configurable": {
                "user_id": "admin@techtrend.com",
                "department_id": data["dept_id"],
                "role": "EMPLOYEE",
            }
        }

        add_item_func = manage_purchase_request.coroutine
        process_func = process_approval.coroutine

        # Add item
        await add_item_func(
            action="add_item",
            pr_id=data["pr_id"],
            catalog_item_id=data["item_id"],
            quantity=1,
            config=tool_config,
        )

        # Submit for approval
        async with pool.acquire() as conn:
            await conn.execute("UPDATE \"PurchaseRequest\" SET status='PENDING_APPROVAL' WHERE id=$1", data["pr_id"])
            await conn.execute("""
                INSERT INTO "PRApproval" (id, "prId", "approverEmail", status)
                VALUES ($1, $2, $3, 'PENDING')
            """, str(uuid.uuid4()), data["pr_id"], "manager@example.com")

            dept_before = await conn.fetchrow('SELECT "spentThisMonth" FROM "Department" WHERE id = $1', data["dept_id"])
            spent_before = int(dept_before["spentThisMonth"])

        # Reject
        manager_config = {
            "configurable": {
                "user_email": "manager@example.com",
                "role": "MANAGER",
                "department_id": data["dept_id"],
            }
        }

        reject_result = await process_func(
            pr_id=data["pr_id"],
            decision="REJECTED",
            comments="Rejected for test",
            config=manager_config,
        )
        reject_data = json.loads(reject_result)
        assert reject_data.get("success") is True

        # Verify budget unchanged
        async with pool.acquire() as conn:
            dept = await conn.fetchrow('SELECT "spentThisMonth" FROM "Department" WHERE id = $1', data["dept_id"])
            spent_after = int(dept["spentThisMonth"])

            assert spent_after == spent_before, (
                f"BUDGET TIMING FAIL: REJECTED changed budget! "
                f"Expected {spent_before}, got {spent_after}."
            )

        await cleanup_test_data(pool, data["pr_id"])

    finally:
        pool.close()
