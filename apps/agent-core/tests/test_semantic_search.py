"""
Integration tests for search_catalog tool (FTS + pgvector hybrid search).
Tests cover: FTS matching, category filtering, inStock filtering, edge cases.
"""

import json
import os

import asyncpg
import pytest


async def get_test_pool():
    """Create a fresh async connection pool for tests."""
    DATABASE_URL = os.environ.get(
        "DATABASE_URL",
        "postgresql://supabase_admin:postgres@localhost:5433/postgres",
    )
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3, command_timeout=60)
    return pool


def tool_config(dept_id: str):
    return {
        "configurable": {
            "user_id": "admin@techtrend.com",
            "department_id": dept_id,
            "role": "ADMIN",
            "thread_id": "test-thread",
        }
    }


# ═══════════════════════════════════════════════════════════════
# Test 1: FTS returns matching items
# ═══════════════════════════════════════════════════════════════

async def test_search_catalog_fts_returns_matching_items():
    """Search for 'MacBook' returns the seeded MacBook Pro item."""
    from src.tools import search_catalog

    pool = await get_test_pool()
    try:
        from src import dependencies

        dependencies._db_pool = pool

        async with pool.acquire() as conn:
            dept = await conn.fetchrow('SELECT id FROM "Department" LIMIT 1')
            assert dept is not None, "No departments in DB"
            dept_id = dept["id"]

        config = tool_config(dept_id)
        result = await search_catalog.coroutine(query="MacBook", config=config)
        data = json.loads(result)

        assert "items" in data, "Response missing 'items' field"
        assert isinstance(data["items"], list), "'items' must be a list"
        assert len(data["items"]) > 0, "Should find at least one matching item"

        item = data["items"][0]
        assert "id" in item
        assert "name" in item
        assert "price" in item
        assert "MacBook" in item["name"]

        assert "__ui__" in data
        assert data["__ui__"]["name"] == "catalog-grid"
    finally:
        await pool.close()


# ═══════════════════════════════════════════════════════════════
# Test 2: Category filter
# ═══════════════════════════════════════════════════════════════

async def test_search_catalog_category_filter():
    """Filter by HARDWARE returns matching items; SOFTWARE returns empty."""
    from src.tools import search_catalog

    pool = await get_test_pool()
    try:
        from src import dependencies

        dependencies._db_pool = pool

        async with pool.acquire() as conn:
            dept = await conn.fetchrow('SELECT id FROM "Department" LIMIT 1')
            dept_id = dept["id"]

        config = tool_config(dept_id)

        hardware_result = await search_catalog.coroutine(
            query="test", category="HARDWARE", config=config
        )
        hardware_data = json.loads(hardware_result)

        assert "items" in hardware_data
        assert isinstance(hardware_data["items"], list)
        if len(hardware_data["items"]) > 0:
            for item in hardware_data["items"]:
                assert "id" in item
                assert "name" in item

        software_result = await search_catalog.coroutine(
            query="test", category="SOFTWARE", config=config
        )
        software_data = json.loads(software_result)
        assert software_data["items"] == []
        assert software_data["found"] == 0
    finally:
        await pool.close()


# ═══════════════════════════════════════════════════════════════
# Test 3: Out-of-stock items excluded
# ═══════════════════════════════════════════════════════════════

async def test_search_catalog_out_of_stock_excluded():
    """All returned items should have inStock=true (tool always filters by inStock)."""
    from src.tools import search_catalog

    pool = await get_test_pool()
    try:
        from src import dependencies

        dependencies._db_pool = pool

        async with pool.acquire() as conn:
            dept = await conn.fetchrow('SELECT id FROM "Department" LIMIT 1')
            dept_id = dept["id"]

        config = tool_config(dept_id)
        result = await search_catalog.coroutine(query="test", config=config)
        data = json.loads(result)

        for item in data.get("items", []):
            assert item.get("inStock") is True, (
                f"Out-of-stock item '{item.get('name')}' was returned"
            )

        async with pool.acquire() as conn:
            oos_count = await conn.fetchval(
                'SELECT COUNT(*) FROM "CatalogItem" WHERE "inStock" = false'
            )
        if oos_count > 0:
            all_ids = {item.get("id") for item in data.get("items", [])}
            async with pool.acquire() as conn:
                oos_ids = await conn.fetch(
                    'SELECT id FROM "CatalogItem" WHERE "inStock" = false'
                )
            for row in oos_ids:
                assert row["id"] not in all_ids
    finally:
        await pool.close()


# ═══════════════════════════════════════════════════════════════
# Test 4: Empty query returns results
# ═══════════════════════════════════════════════════════════════

async def test_search_catalog_empty_query():
    """Empty query returns all in-stock items (no crash)."""
    from src.tools import search_catalog

    pool = await get_test_pool()
    try:
        from src import dependencies

        dependencies._db_pool = pool

        async with pool.acquire() as conn:
            dept = await conn.fetchrow('SELECT id FROM "Department" LIMIT 1')
            dept_id = dept["id"]

        config = tool_config(dept_id)
        result = await search_catalog.coroutine(query="", config=config)
        data = json.loads(result)

        assert "items" in data
        assert isinstance(data["items"], list)
        assert "__ui__" in data
        assert data["__ui__"]["name"] == "catalog-grid"
    finally:
        await pool.close()


# ═══════════════════════════════════════════════════════════════
# Test 5: No-match query returns empty
# ═══════════════════════════════════════════════════════════════

async def test_search_catalog_no_match():
    """Query with no matching results returns empty list (not error)."""
    from src.tools import search_catalog

    pool = await get_test_pool()
    try:
        from src import dependencies

        dependencies._db_pool = pool

        async with pool.acquire() as conn:
            dept = await conn.fetchrow('SELECT id FROM "Department" LIMIT 1')
            dept_id = dept["id"]

        config = tool_config(dept_id)
        result = await search_catalog.coroutine(
            query="xyznonexistent9900", config=config
        )
        data = json.loads(result)

        assert "items" in data
        assert data["items"] == []
        assert data["found"] == 0
        assert "__ui__" in data
        assert data["__ui__"]["name"] == "catalog-grid"
        assert data["__ui__"]["props"]["items"] == []
    finally:
        await pool.close()
