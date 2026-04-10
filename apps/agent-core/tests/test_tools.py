import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta


class MockAsyncContextManager:
    """Proper async context manager mock"""
    async def __aenter__(self):
        return self.conn
    async def __aexit__(self, *args):
        pass


@pytest.fixture
def mock_db_pool(monkeypatch):
    mock_conn = AsyncMock()
    mock_acquire = MockAsyncContextManager()
    mock_acquire.conn = mock_conn
    
    mock_pool = MagicMock()  # Not AsyncMock - acquire is sync method
    mock_pool.acquire.return_value = mock_acquire
    
    async def mock_get_pool():
        return mock_pool
    
    monkeypatch.setattr("src.tools.get_pool", mock_get_pool)
    return mock_conn


@pytest.fixture
def mock_embed(monkeypatch):
    monkeypatch.setattr(
        "src.tools.embed_query",
        AsyncMock(return_value=[0.1] * 1536)
    )


class TestSearchProducts:

    @pytest.mark.asyncio
    async def test_returns_products_json(self, mock_db_pool, mock_embed):
        mock_db_pool.fetch.return_value = [
            {"id": 1, "name": "Sony WH-1000XM5", "price": 26990,
             "stock": 5, "category": "headphones", "brand": "Sony",
             "imageUrl": None, "rating": 4.8, "semantic_dist": 0.1}
        ]

        from src.tools import search_products
        result = await search_products.ainvoke(
            {"query": "headphones"},
            config={"configurable": {"user_id": "u1"}}
        )

        data = json.loads(result)
        assert len(data["products"]) == 1
        assert data["products"][0]["name"] == "Sony WH-1000XM5"
        assert "__ui__" in data
        assert data["__ui__"]["name"] == "product-grid"

    @pytest.mark.asyncio
    async def test_ui_event_structure(self, mock_db_pool, mock_embed):
        mock_db_pool.fetch.return_value = []
        from src.tools import search_products

        result = await search_products.ainvoke(
            {"query": "test"},
            config={"configurable": {"user_id": "u1"}}
        )

        data = json.loads(result)
        ui = data["__ui__"]
        assert ui["name"] == "product-grid"
        assert "products" in ui["props"]
        assert ui["props"]["loading"] == False


class TestViewCart:

    @pytest.mark.asyncio
    async def test_calculates_total_correctly(self, mock_db_pool):
        mock_db_pool.fetch.return_value = [
            {"productId": 1, "name": "Sony WH-1000XM5",
             "price": 26990, "quantity": 1, "stock": 5, "imageUrl": None},
            {"productId": 4, "name": "Boat Airdopes",
             "price": 1299, "quantity": 2, "stock": 10, "imageUrl": None},
        ]

        from src.tools import view_cart
        result = await view_cart.ainvoke(
            {},
            config={"configurable": {"user_id": "u1"}}
        )

        data = json.loads(result)
        assert data["total"] == 29588
        assert data["__ui__"]["name"] == "cart-canvas"

    @pytest.mark.asyncio
    async def test_empty_cart_returns_zero(self, mock_db_pool):
        mock_db_pool.fetch.return_value = []
        from src.tools import view_cart

        result = await view_cart.ainvoke(
            {},
            config={"configurable": {"user_id": "u1"}}
        )

        data = json.loads(result)
        assert data["total"] == 0
        assert data["items"] == []


class TestInitiateReturn:

    @pytest.mark.asyncio
    async def test_eligible_within_7_days(self, mock_db_pool):
        mock_db_pool.fetchrow.return_value = {
            "id": "order-abc", "status": "DELIVERED", "total": 26990,
            "createdAt": datetime.now(timezone.utc) - timedelta(days=3),
        }

        from src.tools import initiate_return
        result = await initiate_return.ainvoke(
            {"order_id": "order-abc", "reason": "DEFECTIVE"},
            config={"configurable": {"user_id": "u1"}}
        )

        data = json.loads(result)
        assert data["eligible"] == True
        assert len(data["options"]) == 3
        types = [o["type"] for o in data["options"]]
        assert "refund" in types
        assert "exchange" in types
        assert "store_credit" in types

    @pytest.mark.asyncio
    async def test_ineligible_after_7_days(self, mock_db_pool):
        mock_db_pool.fetchrow.return_value = {
            "id": "order-old", "status": "DELIVERED", "total": 1499,
            "createdAt": datetime.now(timezone.utc) - timedelta(days=30),
        }

        from src.tools import initiate_return
        result = await initiate_return.ainvoke(
            {"order_id": "order-old", "reason": "OTHER"},
            config={"configurable": {"user_id": "u1"}}
        )

        data = json.loads(result)
        assert data["eligible"] == False
        assert len(data["options"]) == 0


class TestAllToolsExported:

    def test_all_tools_list_has_5_tools(self):
        from src.tools import ALL_TOOLS
        assert len(ALL_TOOLS) == 5

    def test_all_tool_names_correct(self):
        from src.tools import ALL_TOOLS
        names = [t.name for t in ALL_TOOLS]
        assert "search_products" in names
        assert "view_cart" in names
        assert "add_to_cart" in names
        assert "get_orders" in names
        assert "initiate_return" in names
