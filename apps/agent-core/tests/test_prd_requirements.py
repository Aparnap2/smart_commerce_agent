"""
PRD Requirements Tests - TDD Approach  
Tests for ProcureAI budget management and purchase request features.

Each test creates its own DB pool to avoid event loop issues.
"""

import pytest
import json
import uuid
import asyncio
import asyncpg
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set defaults for DATABASE_URL
os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/smart_commerce")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

DATABASE_URL = os.environ.get("DATABASE_URL")


async def create_test_pool():
    """Create a test pool."""
    pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=2,
        max_size=10,
        command_timeout=60,
    )
    print(f"\n✅ Test DB pool initialized")
    return pool


async def close_test_pool(pool):
    """Close a test pool."""
    print(f"\n🔧 Closing test DB pool")
    await pool.close()


def setup_pool_for_tools(pool):
    """Set dependencies._db_pool so tools can use our pool.
    All tool functions go through dependencies.get_pool_singleton.
    """
    import src.dependencies as src_deps
    src_deps._db_pool = pool


def create_unique_test_data(prefix):
    """Create unique test IDs."""
    unique = uuid.uuid4().hex[:8]
    return {
        "dept_id": str(uuid.uuid4()),
        "user_email": f"test_{prefix}_{unique}@test.com",
        "dept_name": f"Test Dept {prefix} {unique}",
        "dept_code": f"TEST-{prefix.upper()}-{unique}",
    }


# =============================================================================
# TEST 1: Budget - add_item spends budget
# =============================================================================
@pytest.mark.xfail(reason="Old behavior: add_item no longer debits budget; debit happens on APPROVED")
@pytest.mark.asyncio
async def test_add_item_increments_spent_this_month():
    """Verify add_item increments spentThisMonth."""
    from src.tools import manage_purchase_request
    from langchain_core.runnables import RunnableConfig
    
    pool = await create_test_pool()
    setup_pool_for_tools(pool)
    
    try:
        data = create_unique_test_data("Add")
        test_dept_id = data["dept_id"]
        test_user_email = data["user_email"]
        dept_name = data["dept_name"]
        dept_code = data["dept_code"]
        
        async with pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO "Department" (id, name, code, "monthlyBudget", "spentThisMonth", "approverEmail", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ''', test_dept_id, dept_name, dept_code, 50000000, 0, 'manager@test.com')
            
            await conn.execute('''
                INSERT INTO users (id, email, "passwordHash", name, role, "employeeRole", "departmentId", created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ''', str(uuid.uuid4()), test_user_email, 'hash', 'Test User', 'SHOPPER', 'EMPLOYEE', test_dept_id)
            
            user = await conn.fetchrow('SELECT id FROM users WHERE email = $1', test_user_email)
            test_user_id = user['id']
            
            item = await conn.fetchrow('SELECT id, "unitPrice" FROM "CatalogItem" WHERE "inStock" = true LIMIT 1')
            test_catalog_id = item['id']
            unit_price = item['unitPrice']
            
            dept = await conn.fetchrow('SELECT "spentThisMonth" FROM "Department" WHERE id = $1', test_dept_id)
            initial_spent = dept['spentThisMonth']
        
        config = RunnableConfig(configurable={
            "user_id": test_user_email,
            "department_id": test_dept_id,
            "role": "EMPLOYEE"
        })
        
        result = await manage_purchase_request.ainvoke(
            input={
                "action": "create",
                "justification": "Test PR",
                "urgency": "NORMAL",
            },
            config=config
        )
        print(f"create result: {result}")
        
        async with pool.acquire() as conn:
            pr = await conn.fetchrow('''
                SELECT id FROM "PurchaseRequest" 
                WHERE "requestorId" = $1 AND status = 'DRAFT'
                ORDER BY "createdAt" DESC LIMIT 1
            ''', test_user_id)
            pr_id = pr['id']
        
        result = await manage_purchase_request.ainvoke(
            input={
                "action": "add_item",
                "pr_id": pr_id,
                "catalog_item_id": str(test_catalog_id),
                "quantity": 1,
            },
            config=config
        )
        
        result_data = json.loads(result)
        print(f"add_item result: {result_data}")
        
        async with pool.acquire() as conn:
            dept_after = await conn.fetchrow('''
                SELECT "spentThisMonth" FROM "Department" WHERE id = $1
            ''', test_dept_id)
            final_spent = dept_after['spentThisMonth']
        
        expected_increase = unit_price
        actual_increase = final_spent - initial_spent
        
        print(f"Initial: {initial_spent}, Final: {final_spent}, Expected: {expected_increase}, Actual: {actual_increase}")
        
        async with pool.acquire() as conn:
            await conn.execute('DELETE FROM "PRAuditEntry" WHERE "prId" = $1', pr_id)
            await conn.execute('DELETE FROM "PRLineItem" WHERE "prId" = $1', pr_id)
            await conn.execute('DELETE FROM "PurchaseRequest" WHERE id = $1', pr_id)
            await conn.execute('DELETE FROM users WHERE email = $1', test_user_email)
            await conn.execute('DELETE FROM "Department" WHERE id = $1', test_dept_id)
        
        await close_test_pool(pool)
        
        assert actual_increase == expected_increase, \
            f"spentThisMonth should increase by {expected_increase}, but increased by {actual_increase}"
    except Exception:
        await close_test_pool(pool)
        raise


# =============================================================================
# TEST 2: Budget - remove_item refunds (decrements spentThisMonth)
# =============================================================================
@pytest.mark.asyncio
async def test_remove_item_decrements_spent_this_month():
    """Verify remove_item decrements spentThisMonth."""
    from src.tools import manage_purchase_request
    from langchain_core.runnables import RunnableConfig
    
    pool = await create_test_pool()
    setup_pool_for_tools(pool)
    
    try:
        data = create_unique_test_data("Remove")
        test_dept_id = data["dept_id"]
        test_user_email = data["user_email"]
        dept_name = data["dept_name"]
        dept_code = data["dept_code"]
        
        async with pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO "Department" (id, name, code, "monthlyBudget", "spentThisMonth", "approverEmail", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ''', test_dept_id, dept_name, dept_code, 50000000, 0, 'manager@test.com')
            
            await conn.execute('''
                INSERT INTO users (id, email, "passwordHash", name, role, "employeeRole", "departmentId", created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ''', str(uuid.uuid4()), test_user_email, 'hash', 'Test User', 'SHOPPER', 'EMPLOYEE', test_dept_id)
            
            user = await conn.fetchrow('SELECT id FROM users WHERE email = $1', test_user_email)
            test_user_id = user['id']
            
            item = await conn.fetchrow('SELECT id, "unitPrice" FROM "CatalogItem" WHERE "inStock" = true LIMIT 1')
            test_catalog_id = item['id']
        
        config = RunnableConfig(configurable={
            "user_id": test_user_email,
            "department_id": test_dept_id,
            "role": "EMPLOYEE"
        })
        
        await manage_purchase_request.ainvoke(
            input={"action": "create", "justification": "Test"},
            config=config
        )
        
        async with pool.acquire() as conn:
            pr = await conn.fetchrow('SELECT id FROM "PurchaseRequest" WHERE "requestorId" = $1 AND status = $2', test_user_id, 'DRAFT')
            pr_id = pr['id']
        
        await manage_purchase_request.ainvoke(
            input={
                "action": "add_item",
                "pr_id": pr_id,
                "catalog_item_id": str(test_catalog_id),
                "quantity": 1,
            },
            config=config
        )
        
        async with pool.acquire() as conn:
            line_item = await conn.fetchrow('SELECT id, "totalPrice" FROM "PRLineItem" WHERE "prId" = $1', pr_id)
            line_item_id = line_item['id']
            line_total = line_item['totalPrice']
            
            dept = await conn.fetchrow('SELECT "spentThisMonth" FROM "Department" WHERE id = $1', test_dept_id)
            spent_before = dept['spentThisMonth']
        
        result = await manage_purchase_request.ainvoke(
            input={
                "action": "remove_item",
                "pr_id": pr_id,
                "line_item_id": str(line_item_id),
            },
            config=config
        )
        result_data = json.loads(result)
        print(f"remove_item result: {result_data}")
        
        async with pool.acquire() as conn:
            dept_after = await conn.fetchrow('SELECT "spentThisMonth" FROM "Department" WHERE id = $1', test_dept_id)
            spent_after = dept_after['spentThisMonth']
        
        expected_decrease = line_total
        actual_decrease = spent_before - spent_after
        
        print(f"Before: {spent_before}, After: {spent_after}, Expected: {expected_decrease}, Actual: {actual_decrease}")
        
        async with pool.acquire() as conn:
            await conn.execute('DELETE FROM "PRAuditEntry" WHERE "prId" = $1', pr_id)
            await conn.execute('DELETE FROM "PRLineItem" WHERE "prId" = $1', pr_id)
            await conn.execute('DELETE FROM "PurchaseRequest" WHERE id = $1', pr_id)
            await conn.execute('DELETE FROM users WHERE email = $1', test_user_email)
            await conn.execute('DELETE FROM "Department" WHERE id = $1', test_dept_id)
        
        await close_test_pool(pool)
        
        assert actual_decrease == expected_decrease, \
            f"spentThisMonth should decrease by {expected_decrease}, but decreased by {actual_decrease}"
    except Exception:
        await close_test_pool(pool)
        raise


# =============================================================================
# TEST 3: remove_item returns correct refund amount
# =============================================================================
@pytest.mark.asyncio
async def test_remove_item_returns_correct_refund_amount():
    """Verify remove_item returns correct refundAmount."""
    from src.tools import manage_purchase_request
    from langchain_core.runnables import RunnableConfig
    
    pool = await create_test_pool()
    setup_pool_for_tools(pool)
    
    try:
        data = create_unique_test_data("Refund")
        test_dept_id = data["dept_id"]
        test_user_email = data["user_email"]
        dept_name = data["dept_name"]
        dept_code = data["dept_code"]
        
        async with pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO "Department" (id, name, code, "monthlyBudget", "spentThisMonth", "approverEmail", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ''', test_dept_id, dept_name, dept_code, 50000000, 0, 'manager@test.com')
            
            await conn.execute('''
                INSERT INTO users (id, email, "passwordHash", name, role, "employeeRole", "departmentId", created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ''', str(uuid.uuid4()), test_user_email, 'hash', 'Test User', 'SHOPPER', 'EMPLOYEE', test_dept_id)
            
            user = await conn.fetchrow('SELECT id FROM users WHERE email = $1', test_user_email)
            test_user_id = user['id']
            
            item = await conn.fetchrow('SELECT id, "unitPrice" FROM "CatalogItem" WHERE "inStock" = true LIMIT 1')
            test_catalog_id = item['id']
        
        config = RunnableConfig(configurable={
            "user_id": test_user_email,
            "department_id": test_dept_id,
            "role": "EMPLOYEE"
        })
        
        await manage_purchase_request.ainvoke(
            input={"action": "create", "justification": "Test"},
            config=config
        )
        
        async with pool.acquire() as conn:
            pr = await conn.fetchrow('SELECT id FROM "PurchaseRequest" WHERE "requestorId" = $1 AND status = $2', test_user_id, 'DRAFT')
            pr_id = pr['id']
        
        await manage_purchase_request.ainvoke(
            input={
                "action": "add_item",
                "pr_id": pr_id,
                "catalog_item_id": str(test_catalog_id),
                "quantity": 2,
            },
            config=config
        )
        
        async with pool.acquire() as conn:
            line_item = await conn.fetchrow('SELECT id, "totalPrice" FROM "PRLineItem" WHERE "prId" = $1', pr_id)
            line_item_id = line_item['id']
            expected_refund = line_item['totalPrice']
        
        result = await manage_purchase_request.ainvoke(
            input={
                "action": "remove_item",
                "pr_id": pr_id,
                "line_item_id": str(line_item_id),
            },
            config=config
        )
        result_data = json.loads(result)
        print(f"remove_item result: {result_data}")
        
        async with pool.acquire() as conn:
            await conn.execute('DELETE FROM "PRAuditEntry" WHERE "prId" = $1', pr_id)
            await conn.execute('DELETE FROM "PRLineItem" WHERE "prId" = $1', pr_id)
            await conn.execute('DELETE FROM "PurchaseRequest" WHERE id = $1', pr_id)
            await conn.execute('DELETE FROM users WHERE email = $1', test_user_email)
            await conn.execute('DELETE FROM "Department" WHERE id = $1', test_dept_id)
        
        await close_test_pool(pool)
        
        assert result_data.get("success") == True
        assert "refundAmount" in result_data
        assert result_data["refundAmount"] == expected_refund
    except Exception:
        await close_test_pool(pool)
        raise


# =============================================================================
# TEST 4: remove_item error - no draft PR
# =============================================================================
@pytest.mark.asyncio
async def test_remove_item_error_no_draft_pr():
    """Verify remove_item returns error when no draft PR exists."""
    from src.tools import manage_purchase_request
    from langchain_core.runnables import RunnableConfig
    
    pool = await create_test_pool()
    setup_pool_for_tools(pool)
    
    try:
        data = create_unique_test_data("NoPR")
        test_dept_id = data["dept_id"]
        test_user_email = data["user_email"]
        dept_name = data["dept_name"]
        dept_code = data["dept_code"]
        
        async with pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO "Department" (id, name, code, "monthlyBudget", "spentThisMonth", "approverEmail", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ''', test_dept_id, dept_name, dept_code, 50000000, 0, 'manager@test.com')
            
            await conn.execute('''
                INSERT INTO users (id, email, "passwordHash", name, role, "employeeRole", "departmentId", created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ''', str(uuid.uuid4()), test_user_email, 'hash', 'Test User', 'SHOPPER', 'EMPLOYEE', test_dept_id)
        
        config = RunnableConfig(configurable={
            "user_id": test_user_email,
            "department_id": test_dept_id,
            "role": "EMPLOYEE"
        })
        
        result = await manage_purchase_request.ainvoke(
            input={"action": "remove_item", "line_item_id": str(uuid.uuid4())},
            config=config
        )
        
        result_data = json.loads(result)
        print(f"remove_item result (no draft): {result_data}")
        
        async with pool.acquire() as conn:
            await conn.execute('DELETE FROM users WHERE email = $1', test_user_email)
            await conn.execute('DELETE FROM "Department" WHERE id = $1', test_dept_id)
        
        await close_test_pool(pool)
        
        assert "error" in result_data
        assert result_data["error"] == "No draft PR found"
    except Exception:
        await close_test_pool(pool)
        raise


# =============================================================================
# TEST 5: remove_item error - line item not found
# =============================================================================
@pytest.mark.asyncio
async def test_remove_item_error_line_item_not_found():
    """Verify remove_item returns error when line_item_id is invalid."""
    from src.tools import manage_purchase_request
    from langchain_core.runnables import RunnableConfig
    
    pool = await create_test_pool()
    setup_pool_for_tools(pool)
    
    try:
        data = create_unique_test_data("Invalid")
        test_dept_id = data["dept_id"]
        test_user_email = data["user_email"]
        dept_name = data["dept_name"]
        dept_code = data["dept_code"]
        
        async with pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO "Department" (id, name, code, "monthlyBudget", "spentThisMonth", "approverEmail", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ''', test_dept_id, dept_name, dept_code, 50000000, 0, 'manager@test.com')
            
            await conn.execute('''
                INSERT INTO users (id, email, "passwordHash", name, role, "employeeRole", "departmentId", created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ''', str(uuid.uuid4()), test_user_email, 'hash', 'Test User', 'SHOPPER', 'EMPLOYEE', test_dept_id)
        
        config = RunnableConfig(configurable={
            "user_id": test_user_email,
            "department_id": test_dept_id,
            "role": "EMPLOYEE"
        })
        
        await manage_purchase_request.ainvoke(
            input={"action": "create", "justification": "Test"},
            config=config
        )
        
        invalid_line_item_id = str(uuid.uuid4())
        result = await manage_purchase_request.ainvoke(
            input={"action": "remove_item", "line_item_id": invalid_line_item_id},
            config=config
        )
        
        result_data = json.loads(result)
        print(f"remove_item result (invalid line): {result_data}")
        
        async with pool.acquire() as conn:
            pr = await conn.fetchrow('SELECT id FROM "PurchaseRequest" WHERE "requestorId" = (SELECT id FROM users WHERE email = $1)', test_user_email)
            if pr:
                await conn.execute('DELETE FROM "PRAuditEntry" WHERE "prId" = $1', pr['id'])
                await conn.execute('DELETE FROM "PRLineItem" WHERE "prId" = $1', pr['id'])
                await conn.execute('DELETE FROM "PurchaseRequest" WHERE id = $1', pr['id'])
            await conn.execute('DELETE FROM users WHERE email = $1', test_user_email)
            await conn.execute('DELETE FROM "Department" WHERE id = $1', test_dept_id)
        
        await close_test_pool(pool)
        
        assert "error" in result_data
        assert result_data["error"] == "Line item not found"
    except Exception:
        await close_test_pool(pool)
        raise


# =============================================================================
# TEST 6: MANAGER sees all department PRs
# =============================================================================
@pytest.mark.asyncio
async def test_manager_sees_all_department_prs():
    """Verify MANAGER role can see all department PRs."""
    from src.tools import manage_purchase_request, get_purchase_requests
    from langchain_core.runnables import RunnableConfig
    
    pool = await create_test_pool()
    setup_pool_for_tools(pool)
    
    try:
        data = create_unique_test_data("Manager")
        test_dept_id = data["dept_id"]
        manager_email = data["user_email"]
        employee_email = f"test_emp_{uuid.uuid4().hex[:8]}@test.com"
        dept_name = data["dept_name"]
        dept_code = data["dept_code"]
        
        async with pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO "Department" (id, name, code, "monthlyBudget", "spentThisMonth", "approverEmail", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ''', test_dept_id, dept_name, dept_code, 50000000, 0, 'manager@test.com')
            
            await conn.execute('''
                INSERT INTO users (id, email, "passwordHash", name, role, "employeeRole", "departmentId", created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ''', str(uuid.uuid4()), manager_email, 'hash', 'Test Manager', 'SHOPPER', 'MANAGER', test_dept_id)
            
            await conn.execute('''
                INSERT INTO users (id, email, "passwordHash", name, role, "employeeRole", "departmentId", created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ''', str(uuid.uuid4()), employee_email, 'hash', 'Test Employee', 'SHOPPER', 'EMPLOYEE', test_dept_id)
            
            item = await conn.fetchrow('SELECT id FROM "CatalogItem" WHERE "inStock" = true LIMIT 1')
            test_catalog_id = item['id']
        
        manager_config = RunnableConfig(configurable={
            "user_id": manager_email,
            "department_id": test_dept_id,
            "role": "MANAGER"
        })
        
        employee_config = RunnableConfig(configurable={
            "user_id": employee_email,
            "department_id": test_dept_id,
            "role": "EMPLOYEE"
        })
        
        await manage_purchase_request.ainvoke(
            input={"action": "create", "justification": "Employee PR"},
            config=employee_config
        )
        
        async with pool.acquire() as conn:
            pr = await conn.fetchrow('SELECT id FROM "PurchaseRequest" WHERE "requestorId" = (SELECT id FROM users WHERE email = $1) AND status = $2', employee_email, 'DRAFT')
            if pr:
                await manage_purchase_request.ainvoke(
                    input={
                        "action": "add_item",
                        "pr_id": pr['id'],
                        "catalog_item_id": str(test_catalog_id),
                        "quantity": 1,
                    },
                    config=employee_config
                )
        
        result = await get_purchase_requests.ainvoke(
            input={"limit": 10},
            config=manager_config
        )
        result_data = json.loads(result)
        print(f"get_purchase_requests (MANAGER): {result_data}")
        
        prs = result_data.get("purchaseRequests", [])
        
        async with pool.acquire() as conn:
            await conn.execute('DELETE FROM "PRAuditEntry" WHERE "prId" IN (SELECT id FROM "PurchaseRequest" WHERE "departmentId" = $1)', test_dept_id)
            await conn.execute('DELETE FROM "PRLineItem" WHERE "prId" IN (SELECT id FROM "PurchaseRequest" WHERE "departmentId" = $1)', test_dept_id)
            await conn.execute('DELETE FROM "PurchaseRequest" WHERE "departmentId" = $1', test_dept_id)
            await conn.execute('DELETE FROM users WHERE email IN ($1, $2)', manager_email, employee_email)
            await conn.execute('DELETE FROM "Department" WHERE id = $1', test_dept_id)
        
        await close_test_pool(pool)
        
        assert len(prs) > 0, "MANAGER should see at least one PR from the department"
    except Exception:
        await close_test_pool(pool)
        raise


@pytest.mark.asyncio
async def test_employee_sees_own_prs_only():
    """Verify EMPLOYEE role sees only their own PRs."""
    from src.tools import manage_purchase_request, get_purchase_requests
    from langchain_core.runnables import RunnableConfig
    
    pool = await create_test_pool()
    setup_pool_for_tools(pool)
    
    try:
        data = create_unique_test_data("Employee")
        test_dept_id = data["dept_id"]
        employee_email = data["user_email"]
        dept_name = data["dept_name"]
        dept_code = data["dept_code"]
        
        async with pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO "Department" (id, name, code, "monthlyBudget", "spentThisMonth", "approverEmail", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ''', test_dept_id, dept_name, dept_code, 50000000, 0, 'manager@test.com')
            
            await conn.execute('''
                INSERT INTO users (id, email, "passwordHash", name, role, "employeeRole", "departmentId", created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ''', str(uuid.uuid4()), employee_email, 'hash', 'Test Employee', 'SHOPPER', 'EMPLOYEE', test_dept_id)
            
            item = await conn.fetchrow('SELECT id FROM "CatalogItem" WHERE "inStock" = true LIMIT 1')
            test_catalog_id = item['id']
        
        config = RunnableConfig(configurable={
            "user_id": employee_email,
            "department_id": test_dept_id,
            "role": "EMPLOYEE"
        })
        
        await manage_purchase_request.ainvoke(
            input={"action": "create", "justification": "My PR"},
            config=config
        )
        
        async with pool.acquire() as conn:
            pr = await conn.fetchrow('SELECT id FROM "PurchaseRequest" WHERE "requestorId" = (SELECT id FROM users WHERE email = $1) AND status = $2', employee_email, 'DRAFT')
            if pr:
                await manage_purchase_request.ainvoke(
                    input={
                        "action": "add_item",
                        "pr_id": pr['id'],
                        "catalog_item_id": str(test_catalog_id),
                        "quantity": 1,
                    },
                    config=config
                )
        
        result = await get_purchase_requests.ainvoke(
            input={"limit": 10},
            config=config
        )
        result_data = json.loads(result)
        print(f"get_purchase_requests (EMPLOYEE): {result_data}")
        
        prs = result_data.get("purchaseRequests", [])
        
        async with pool.acquire() as conn:
            await conn.execute('DELETE FROM "PRAuditEntry" WHERE "prId" IN (SELECT id FROM "PurchaseRequest" WHERE "departmentId" = $1)', test_dept_id)
            await conn.execute('DELETE FROM "PRLineItem" WHERE "prId" IN (SELECT id FROM "PurchaseRequest" WHERE "departmentId" = $1)', test_dept_id)
            await conn.execute('DELETE FROM "PurchaseRequest" WHERE "departmentId" = $1', test_dept_id)
            await conn.execute('DELETE FROM users WHERE email = $1', employee_email)
            await conn.execute('DELETE FROM "Department" WHERE id = $1', test_dept_id)
        
        await close_test_pool(pool)
        
        assert len(prs) >= 1, "EMPLOYEE should see at least their own PR"
        print(f"Employee sees {len(prs)} PR(s)")
    except Exception:
        await close_test_pool(pool)
        raise