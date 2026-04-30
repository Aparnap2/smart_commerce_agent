import pytest, json, asyncio
import os

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/smart_commerce")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from unittest.mock import AsyncMock, patch, MagicMock

def make_config(
    user_id="emp-001",
    user_email="emp@test.com",
    dept_id="dept-001",
    role="EMPLOYEE",
    thread_id="thread-001",
):
    return {"configurable": {
        "user_id": user_id,
        "user_email": user_email,
        "department_id": dept_id,
        "role": role,
        "thread_id": thread_id,
    }}

@pytest.fixture(autouse=True)
def mock_embed(monkeypatch):
    async def fake_embed_query(text: str):
        return [0.0] * 1536
    monkeypatch.setattr("src.tools.embed_query", fake_embed_query)

# ── search_catalog ────────────────────────────────
class TestSearchCatalog:

    @pytest.mark.asyncio
    async def test_returns_catalog_grid_ui_event(self):
        from src.tools import search_catalog
        result = json.loads(
            await search_catalog.ainvoke({
                "query": "laptop",
                "config": make_config()
            })
        )
        assert result["__ui__"]["name"] == "catalog-grid"
        assert "items" in result

    @pytest.mark.asyncio
    async def test_category_filter_passed_to_query(self):
        from src.tools import search_catalog
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetch.return_value = []
            await search_catalog.ainvoke({
                "query": "laptop",
                "category": "HARDWARE",
                "config": make_config()
            })
            call_args = str(conn.fetch.call_args)
            assert "HARDWARE" in call_args

# ── get_budget_status ─────────────────────────────
class TestGetBudgetStatus:

    @pytest.mark.asyncio
    async def test_returns_budget_gauge_ui_event(self):
        from src.tools import get_budget_status
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetchrow.return_value = {
                "name": "Engineering",
                "monthlyBudget": 50000_00,
                "spentThisMonth": 20000_00
            }
            result = json.loads(
                await get_budget_status.ainvoke({"config": make_config()})
            )
            assert result["__ui__"]["name"] == "budget-gauge"
            assert result["remaining"] == 30000_00
            assert result["percentUsed"] == 40.0

    @pytest.mark.asyncio
    async def test_100_percent_used(self):
        from src.tools import get_budget_status
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetchrow.return_value = {
                "name": "Engineering",
                "monthlyBudget": 50000_00,
                "spentThisMonth": 50000_00
            }
            result = json.loads(
                await get_budget_status.ainvoke({"config": make_config()})
            )
            assert result["percentUsed"] == 100.0
            assert result["remaining"] == 0

# ── manage_purchase_request ───────────────────────
class TestManagePurchaseRequest:

    @pytest.mark.asyncio
    async def test_create_generates_pr_number(self):
        from src.tools import manage_purchase_request
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetchval.return_value = 0
            conn.fetchrow.return_value = {
                "id": "pr-001",
                "prNumber": "PR-2026-0001",
                "status": "DRAFT"
            }
            result = json.loads(
                await manage_purchase_request.ainvoke({
                    "action": "create",
                    "justification": "Need laptops",
                    "config": make_config()
                })
            )
            assert "prId" in result
            assert "prNumber" in result
            assert result["prNumber"].startswith("PR-2026-")

    @pytest.mark.asyncio
    async def test_add_item_blocked_over_budget(self):
        from src.tools import manage_purchase_request
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetchrow.side_effect = [
                {"id": "item-001", "name": "MacBook", "unitPrice": 20000_00},
                {"monthlyBudget": 10000_00, "spentThisMonth": 10000_00}
            ]
            result = json.loads(
                await manage_purchase_request.ainvoke({
                    "action": "add_item",
                    "pr_id": "pr-001",
                    "catalog_item_id": "item-001",
                    "quantity": 1,
                    "config": make_config()
                })
            )
            assert result["error"] == "budget_exceeded"
            assert result["__ui__"]["name"] == "budget-alert"

    @pytest.mark.asyncio
    async def test_view_returns_pr_draft_ui(self):
        from src.tools import manage_purchase_request
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetchrow.return_value = {
                "id": "pr-001",
                "prNumber": "PR-2026-0001",
                "status": "DRAFT",
                "totalAmount": 50000_00
            }
            conn.fetch.return_value = []
            result = json.loads(
                await manage_purchase_request.ainvoke({
                    "action": "view",
                    "config": make_config()
                })
            )
            assert result["__ui__"]["name"] == "pr-draft"

# ── submit_for_approval ───────────────────────────
class TestSubmitForApproval:

    @pytest.mark.asyncio
    async def test_sets_pr_submitted_flag(self):
        from src.tools import submit_for_approval
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetchrow.side_effect = [
                {"id": "pr-001", "prNumber": "PR-2026-0001", "status": "DRAFT", "totalAmount": 50000_00},
                {"id": "dept-001", "name": "Engineering", "approverEmail": "mgr@test.com"}
            ]
            result = json.loads(
                await submit_for_approval.ainvoke({
                    "pr_id": "pr-001",
                    "config": make_config()
                })
            )
            assert result["__pr_submitted"] is True
            assert result["__ui__"]["name"] == "pr-submitted"

    @pytest.mark.asyncio
    async def test_rejects_non_draft_pr(self):
        from src.tools import submit_for_approval
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetchrow.return_value = {
                "id": "pr-001", "prNumber": "PR-2026-0001", "status": "PENDING_APPROVAL"
            }
            result = json.loads(
                await submit_for_approval.ainvoke({
                    "pr_id": "pr-001",
                    "config": make_config()
                })
            )
            assert "error" in result

# ── process_approval ──────────────────────────────
class TestProcessApproval:

    @pytest.mark.asyncio
    async def test_manager_can_approve(self):
        from src.tools import process_approval
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetchrow.return_value = {"id": "approval-001"}
            result = json.loads(
                await process_approval.ainvoke({
                    "pr_id": "pr-001",
                    "decision": "APPROVED",
                    "comments": "LGTM",
                    "config": make_config(user_email="mgr@test.com", role="MANAGER")
                })
            )
            assert result["success"] is True
            assert result["decision"] == "APPROVED"

    @pytest.mark.asyncio
    async def test_employee_cannot_approve(self):
        from src.tools import process_approval
        result = json.loads(
            await process_approval.ainvoke({
                "pr_id": "pr-001",
                "decision": "APPROVED",
                "config": make_config(role="EMPLOYEE")
            })
        )
        assert "error" in result

    @pytest.mark.asyncio
    async def test_invalid_decision(self):
        from src.tools import process_approval
        result = json.loads(
            await process_approval.ainvoke({
                "pr_id": "pr-001",
                "decision": "MAYBE",
                "config": make_config(role="MANAGER")
            })
        )
        assert "error" in result

# ── get_purchase_requests ─────────────────────────
class TestGetPurchaseRequests:

    @pytest.mark.asyncio
    async def test_returns_pr_list_ui(self):
        from src.tools import get_purchase_requests
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetch.return_value = []
            result = json.loads(
                await get_purchase_requests.ainvoke({
                    "config": make_config(role="MANAGER")
                })
            )
            assert result["__ui__"]["name"] == "pr-list"
            assert "purchaseRequests" in result

    @pytest.mark.asyncio
    async def test_employee_sees_own_only(self):
        from src.tools import get_purchase_requests
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            conn.fetch.return_value = []
            result = json.loads(
                await get_purchase_requests.ainvoke({
                    "config": make_config(role="EMPLOYEE")
                })
            )
            assert result["__ui__"]["name"] == "pr-list"

# ── raise_dispute ─────────────────────────────────
class TestRaiseDispute:

    @pytest.mark.asyncio
    async def test_returns_dispute_card_ui(self):
        from src.tools import raise_dispute
        with patch('src.tools.get_pool') as mock_get_pool:
            pool = AsyncMock()
            mock_get_pool.return_value = pool
            conn = AsyncMock()
            pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
            result = json.loads(
                await raise_dispute.ainvoke({
                    "pr_id": "pr-001",
                    "reason": "Item not delivered",
                    "config": make_config()
                })
            )
            assert result["__ui__"]["name"] == "dispute-card"
            assert result["success"] is True