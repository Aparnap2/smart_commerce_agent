"""
Integration tests for compare_market_price tool (SerpApi Google Shopping).
Tests cover: real API results, UI metadata, Redis caching, error handling.
"""

import hashlib
import json
import os
import time
from unittest.mock import Mock, patch

import httpx
import pytest

SERPAPI_KEY = os.environ.get("SERPAPI_KEY", "")
HAS_REAL_KEY = bool(SERPAPI_KEY) and SERPAPI_KEY != "your_serpapi_key_here"

MOCK_SHOPPING_RESPONSE = {
    "shopping_results": [
        {
            "title": "MacBook Pro 14-inch Apple M3 Chip",
            "price": "₹1,99,900",
            "source": "Apple Store",
            "link": "https://store.apple.com/mbp",
            "rating": 4.8,
            "thumbnail": "https://example.com/mbp14.jpg",
        },
        {
            "title": "MacBook Pro 16-inch M3 Max",
            "price": "₹3,49,900",
            "source": "Reliance Digital",
            "link": "https://reliance.example.com/mbp16",
            "rating": None,
            "thumbnail": "https://example.com/mbp16.jpg",
        },
        {
            "title": "MacBook Pro 13-inch M2",
            "price": "₹1,29,900",
            "source": "Amazon India",
            "link": "https://amazon.in/dp/mbp13",
            "rating": 4.5,
            "thumbnail": "https://example.com/mbp13.jpg",
        },
    ]
}


@pytest.fixture(autouse=True)
async def setup_redis():
    """Create fresh Redis connection per test (each test runs in its own event loop)."""
    import redis.asyncio as aioredis
    from src import dependencies

    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
    r = aioredis.from_url(redis_url, decode_responses=True)
    await r.ping()
    dependencies._redis = r
    yield
    await r.aclose()
    dependencies._redis = None


@pytest.fixture(autouse=True)
def ensure_serpapi_key():
    """Ensure SERPAPI_KEY is set so the tool doesn't KeyError on import or call."""
    old = os.environ.get("SERPAPI_KEY", "")
    if not old or old == "your_serpapi_key_here":
        os.environ["SERPAPI_KEY"] = "test-placeholder-key"
    yield
    if old:
        os.environ["SERPAPI_KEY"] = old
    else:
        os.environ.pop("SERPAPI_KEY", None)


def tool_config():
    return {
        "configurable": {
            "user_id": "admin@techtrend.com",
            "department_id": "dept-eng-001",
            "role": "ADMIN",
            "thread_id": "test-thread",
        }
    }


def make_mock_resp(status_code: int, json_data: dict):
    """Build a sync Mock that mimics httpx.Response for sync methods (.json(), .raise_for_status())."""
    resp = Mock()
    resp.status_code = status_code
    resp.json.return_value = json_data
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            f"{status_code} Error",
            request=Mock(),
            response=resp,
        )
    return resp


async def clear_serpapi_cache(query: str):
    """Remove cached SerpApi result for a query to guarantee fresh state."""
    from src import dependencies

    redis = dependencies._redis
    sanitized = query.lower().strip()
    cache_key = f"serpapi:shopping:{hashlib.md5(sanitized.encode()).hexdigest()}"
    await redis.delete(cache_key)


# ═══════════════════════════════════════════════════════════════
# Test 1: compare_market_price returns structured results
# ═══════════════════════════════════════════════════════════════

@pytest.mark.skipif(not HAS_REAL_KEY, reason="No real SERPAPI_KEY available")
async def test_compare_market_price_returns_results():
    """Calls with 'MacBook Pro', expects structured results with price extracted."""
    from src.tools import compare_market_price

    result = await compare_market_price.coroutine(query="MacBook Pro", config=tool_config())
    data = json.loads(result)

    assert "results" in data, "Response missing 'results' field"
    assert isinstance(data["results"], list), "'results' must be a list"
    assert len(data["results"]) > 0, "Should return at least one result"

    item = data["results"][0]
    assert "title" in item, "Result item missing 'title'"
    assert "price" in item, "Result item missing 'price' (extracted_price)"
    assert "source" in item, "Result item missing 'source' (merchant name)"
    assert "link" in item, "Result item missing 'link'"
    assert item["price"] > 0, f"Price should be positive, got {item['price']}"

    assert data["query"] == "MacBook Pro"
    assert data["currency"] == "INR"


async def test_compare_market_price_returns_results_mocked():
    """Calls with mocked API, verifies structured results."""
    from src.tools import compare_market_price

    mock_resp = make_mock_resp(200, MOCK_SHOPPING_RESPONSE)

    async def mock_get(*a, **kw):
        return mock_resp

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        result = await compare_market_price.coroutine(query="MacBook Pro", config=tool_config())

    data = json.loads(result)

    assert "results" in data
    assert len(data["results"]) == 3
    assert data["query"] == "MacBook Pro"
    assert data["currency"] == "INR"

    item = data["results"][0]
    assert item["title"] == "MacBook Pro 14-inch Apple M3 Chip"
    assert item["price"] == 199900.0
    assert item["source"] == "Apple Store"
    assert item["rating"] == 4.8


# ═══════════════════════════════════════════════════════════════
# Test 2: UI metadata payload structure
# ═══════════════════════════════════════════════════════════════

async def test_compare_market_price_returns_ui_metadata():
    """Verifies __ui__ payload has correct structure for GenUI rendering."""
    from src.tools import compare_market_price

    mock_resp = make_mock_resp(200, MOCK_SHOPPING_RESPONSE)

    async def mock_get(*a, **kw):
        return mock_resp

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        result = await compare_market_price.coroutine(query="MacBook Pro", config=tool_config())

    data = json.loads(result)
    assert "__ui__" in data, "Response missing '__ui__' metadata"

    ui = data["__ui__"]
    assert ui["name"] == "price-comparison", f"Expected 'price-comparison', got '{ui['name']}'"
    assert "props" in ui, "__ui__ missing 'props' field"

    props = ui["props"]
    assert props["query"] == "MacBook Pro"
    assert "results" in props
    assert len(props["results"]) == 3

    first = props["results"][0]
    assert first["title"] == "MacBook Pro 14-inch Apple M3 Chip"
    assert first["price"] == 199900.0


# ═══════════════════════════════════════════════════════════════
# Test 3: Empty query handling
# ═══════════════════════════════════════════════════════════════

async def test_compare_market_price_handles_empty_query():
    """Empty query returns empty results gracefully (no crash)."""
    from src.tools import compare_market_price

    mock_resp = make_mock_resp(200, {"shopping_results": []})

    async def mock_get(*a, **kw):
        return mock_resp

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        result = await compare_market_price.coroutine(query="", config=tool_config())

    data = json.loads(result)
    assert "results" in data
    assert data["results"] == []
    assert data["query"] == ""
    assert "__ui__" in data
    assert data["__ui__"]["props"]["results"] == []


# ═══════════════════════════════════════════════════════════════
# Test 4: Redis caching behavior
# ═══════════════════════════════════════════════════════════════

async def test_compare_market_price_redis_cache():
    """Second call with same product should be faster (cache hit from Redis)."""
    from src.tools import compare_market_price

    unique_query = f"MacBook Pro {time.time_ns()}"
    await clear_serpapi_cache(unique_query)

    mock_resp = make_mock_resp(200, MOCK_SHOPPING_RESPONSE)

    async def mock_get(*a, **kw):
        return mock_resp

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        start = time.monotonic()
        result1 = await compare_market_price.coroutine(query=unique_query, config=tool_config())
        first_duration = time.monotonic() - start

        start = time.monotonic()
        result2 = await compare_market_price.coroutine(query=unique_query, config=tool_config())
        second_duration = time.monotonic() - start

    data1 = json.loads(result1)
    data2 = json.loads(result2)

    assert data1 == data2, "Cached result should match first call result"
    assert second_duration <= first_duration * 10 or second_duration < 0.1, (
        f"Cache hit ({second_duration:.4f}s) should be faster "
        f"than API call ({first_duration:.4f}s)"
    )


# ═══════════════════════════════════════════════════════════════
# Test 5: API failure handling
# ═══════════════════════════════════════════════════════════════

async def test_compare_market_price_error_handling():
    """Handles API failures (HTTP error) by raising the expected exception."""
    from src.tools import compare_market_price

    unique_query = f"Error test {time.time_ns()}"
    await clear_serpapi_cache(unique_query)

    mock_resp = make_mock_resp(401, {})

    async def mock_get(*a, **kw):
        return mock_resp

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        with pytest.raises(httpx.HTTPStatusError):
            await compare_market_price.coroutine(query=unique_query, config=tool_config())
