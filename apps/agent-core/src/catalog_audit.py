"""
Catalog Pricing Audit — background job (spec F14).

Weekly audit:
1. For each in-stock catalog item: call SerpApi to get market prices
2. Compare unit_price vs median market price
3. If unit_price > market_median * 1.15: flag item (pricingFlag = true)
4. Flagged items appear in Finance dashboard
5. Flag cleared when vendor updates price or procurement manually resolves

Usage (standalone):
    python scripts/run_catalog_audit.py

Or import and call from the scheduler:
    from src.catalog_audit import run_pricing_audit
    summary = await run_pricing_audit()
"""
import asyncio
import hashlib
import json
import os
import re
import statistics
import time
from datetime import datetime, timezone
from typing import Optional

import asyncpg
import httpx
from loguru import logger

from .dependencies import get_pool, get_redis
from .tools import sanitize_external_content


# ── Threshold: 15% above market median ─────────────────────────────────
PRICE_PREMIUM_THRESHOLD = 1.15  # 15%


async def _fetch_item_pool() -> asyncpg.Pool:
    """Get the DB pool, trying the global singleton first, falling back to a new pool."""
    try:
        return get_pool()
    except RuntimeError:
        # Standalone mode — create our own pool
        database_url = os.environ.get(
            "DATABASE_URL",
            "postgresql://supabase_admin:postgres@localhost:5433/postgres",
        )
        pool = await asyncpg.create_pool(database_url, min_size=1, max_size=5, command_timeout=60)
        return pool


async def _fetch_catalog_items(pool: asyncpg.Pool) -> list[dict]:
    """Fetch all in-stock catalog items that need price audit."""
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, name, sku, "unitPrice", vendor, category
            FROM "CatalogItem"
            WHERE "inStock" = true
            ORDER BY name ASC
        """)
    return [dict(r) for r in rows]


async def _fetch_market_prices(item_name: str, sku: str) -> Optional[list[int]]:
    """Query SerpApi for market prices of an item.

    Returns a list of extracted prices in paise (same unit as CatalogItem.unitPrice),
    or None if the API call fails or returns no results.
    """
    sanitized_query = sanitize_external_content(f"{item_name} {sku}")

    # ── Redis cache (same key pattern as compare_market_price) ──────
    redis = get_redis()
    cache_key = f"serpapi:shopping:{hashlib.md5(sanitized_query.encode()).hexdigest()}"
    cached = await redis.get(cache_key)
    if cached is not None:
        cached_str = cached if isinstance(cached, str) else cached.decode()
        data = json.loads(cached_str)
        shopping_results = data.get("shopping_results", [])
    else:
        # ── Call SerpApi ────────────────────────────────────────────
        api_key = os.environ.get("SERPAPI_KEY", "")
        if not api_key:
            logger.warning("SERPAPI_KEY not set — skipping market price lookup")
            return None

        url = "https://serpapi.com/search"
        params = {
            "engine": "google_shopping",
            "q": sanitized_query,
            "gl": "in",
            "hl": "en",
            "num": 5,
            "api_key": api_key,
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, params=params, timeout=15)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"SerpApi HTTP error for '{item_name}': {e}")
            return None
        except httpx.RequestError as e:
            logger.error(f"SerpApi request failed for '{item_name}': {e}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"SerpApi bad JSON for '{item_name}': {e}")
            return None

        shopping_results = data.get("shopping_results", [])

        # Cache the raw SerpApi response for 15 minutes (same TTL as compare_market_price)
        # Non-critical — don't fail if cache write fails
        try:
            await redis.set(cache_key, json.dumps(data), ex=900)
        except Exception:
            pass

    if not shopping_results:
        return None

    # ── Extract prices (in paise) ──────────────────────────────────
    # Uses the same regex-based parsing as compare_market_price tool
    prices = []
    for result in shopping_results:
        price_str = result.get("price", "0")
        if price_str:
            # Strip all non-digit/non-dot characters (same pattern as tools.py)
            cleaned = re.sub(r"[^\d.]", "", price_str.replace(",", ""))
            try:
                price_float = float(cleaned)
                # SerpApi returns rupee values (e.g. 1200.0 for ₹1,200)
                # Convert to paise: multiply by 100
                price_paise = int(price_float * 100)
                prices.append(price_paise)
            except (ValueError, TypeError):
                continue

    return prices if prices else None


def _calculate_median(prices: list[int]) -> float:
    """Calculate median of a price list."""
    return float(statistics.median(prices))


def _calculate_premium_pct(unit_price: int, market_median: float) -> float:
    """Calculate percentage premium over market median."""
    if not market_median or market_median <= 0:
        return 0.0
    return round((unit_price - market_median) / market_median * 100, 1)


async def _update_item_flags(
    pool: asyncpg.Pool,
    item_id: str,
    flagged: bool,
    market_median: Optional[int],
) -> None:
    """Update pricing flag for a single catalog item."""
    async with pool.acquire() as conn:
        if flagged:
            await conn.execute(
                """
                UPDATE "CatalogItem"
                SET "pricingFlag" = true,
                    "marketMedianPrice" = $2,
                    "pricingFlaggedAt" = NOW()
                WHERE id = $1
                """,
                item_id,
                market_median,
            )
        else:
            await conn.execute(
                """
                UPDATE "CatalogItem"
                SET "pricingFlag" = false,
                    "marketMedianPrice" = $2,
                    "pricingFlaggedAt" = CASE WHEN $2 IS NOT NULL THEN NULL ELSE "pricingFlaggedAt" END
                WHERE id = $1
                """,
                item_id,
                market_median,
            )


async def run_pricing_audit(pool: Optional[asyncpg.Pool] = None) -> dict:
    """Run the full pricing audit and return a summary.

    Args:
        pool: Optional DB pool. If None, uses the global singleton.

    Returns:
        dict with: total_items, flagged_count, details (list of per-item results),
        duration_seconds, timestamp.
    """
    start_time = time.monotonic()
    timestamp = datetime.now(timezone.utc).isoformat()

    if pool is None:
        pool = await _fetch_item_pool()

    try:
        # ── Fetch all in-stock items ───────────────────────────────
        items = await _fetch_catalog_items(pool)
        total = len(items)
        logger.info(f"Pricing audit: starting — {total} items in stock")

        if total == 0:
            summary = {
                "total_items": 0,
                "flagged_count": 0,
                "details": [],
                "duration_seconds": round(time.monotonic() - start_time, 3),
                "timestamp": timestamp,
            }
            logger.info("Pricing audit: no items to audit")
            return summary

        # ── Audit each item ────────────────────────────────────────
        flagged_count = 0
        details = []

        for item in items:
            item_id = item["id"]
            item_name = item["name"]
            item_sku = item["sku"]
            unit_price = item["unitPrice"]

            item_result = {
                "id": item_id,
                "name": item_name,
                "unit_price": unit_price,
                "flagged": False,
                "market_median": None,
                "error": None,
            }

            try:
                prices = await _fetch_market_prices(item_name, item_sku)
            except Exception as e:
                logger.error(f"Pricing audit: SerpApi error for '{item_name}': {e}")
                item_result["error"] = str(e)
                details.append(item_result)
                continue

            if prices is None or len(prices) == 0:
                logger.info(f"Pricing audit: no market data for '{item_name}' — skipping")
                item_result["market_median"] = None
                details.append(item_result)
                # Still update DB: clear any previous flag
                await _update_item_flags(pool, item_id, flagged=False, market_median=None)
                continue

            market_median = _calculate_median(prices)
            market_median_int = int(round(market_median))
            premium_pct = _calculate_premium_pct(unit_price, market_median)
            threshold_price = int(market_median * PRICE_PREMIUM_THRESHOLD)

            flagged = unit_price > threshold_price

            item_result["flagged"] = flagged
            item_result["market_median"] = market_median_int
            item_result["premium_pct"] = premium_pct
            item_result["threshold_price"] = threshold_price

            if flagged:
                flagged_count += 1
                logger.warning(
                    f"Pricing audit: FLAGGED '{item_name}' — "
                    f"unitPrice={unit_price}, marketMedian={market_median_int}, "
                    f"premium={premium_pct}%"
                )
            else:
                logger.info(
                    f"Pricing audit: OK '{item_name}' — "
                    f"unitPrice={unit_price}, marketMedian={market_median_int}"
                )

            await _update_item_flags(pool, item_id, flagged=flagged, market_median=market_median_int)
            details.append(item_result)

        # ── Build summary ───────────────────────────────────────
        duration = round(time.monotonic() - start_time, 3)
        summary = {
            "total_items": total,
            "flagged_count": flagged_count,
            "details": details,
            "duration_seconds": duration,
            "timestamp": timestamp,
        }

        logger.info(
            f"Pricing audit: complete — {total} items, "
            f"{flagged_count} flagged, "
            f"{duration}s"
        )
        return summary

    finally:
        # Only close the pool if we created it ourselves
        if pool is not None:
            try:
                get_pool()
            except RuntimeError:
                # We created this pool in standalone mode — close it
                await pool.close()
