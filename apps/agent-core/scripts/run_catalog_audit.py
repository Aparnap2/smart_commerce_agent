#!/usr/bin/env python3
"""
Run the catalog pricing audit job.

This script performs a one-shot pricing audit on all in-stock catalog items:
1. Fetches current market prices via SerpApi for each item
2. Compares unit_price to market median
3. Flags items priced > 15% above market median

Usage:
    # From the apps/agent-core directory:
    python scripts/run_catalog_audit.py

    # With custom DB URL:
    DATABASE_URL="postgresql://user:pass@host:5432/db" python scripts/run_catalog_audit.py

    # With custom SerpApi key:
    SERPAPI_KEY="your_key" python scripts/run_catalog_audit.py

Requires:
    - DATABASE_URL (env or .env file)
    - SERPAPI_KEY (env or .env file)
    - REDIS_URL (env or .env file, optional — caching only)
"""
import asyncio
import json
import os
import sys

# Allow importing from src/ when running as a script
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))


async def main():
    """Entry point: run pricing audit and print JSON summary."""
    # Load .env if available
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass

    # Ensure required env vars
    if not os.environ.get("DATABASE_URL"):
        print('ERROR: DATABASE_URL not set. Use .env or export it.')
        sys.exit(1)

    if not os.environ.get("SERPAPI_KEY"):
        print('WARNING: SERPAPI_KEY not set. Market price lookup will be skipped.', file=sys.stderr)

    # Set up Redis if REDIS_URL is provided
    if not os.environ.get("REDIS_URL"):
        os.environ.setdefault("REDIS_URL", "redis://localhost:6379")

    # ── Import and run ──────────────────────────────────────────
    import asyncpg

    database_url = os.environ["DATABASE_URL"]
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=5, command_timeout=60)

    try:
        # Register pool with dependencies so Redis also works
        from src import dependencies
        import redis.asyncio as aioredis

        dependencies._db_pool = pool

        redis_url = os.environ.get("REDIS_URL")
        if redis_url:
            dependencies._redis = await aioredis.from_url(redis_url, decode_responses=True)
            await dependencies._redis.ping()

        # Run audit
        from src.catalog_audit import run_pricing_audit

        result = await run_pricing_audit(pool=pool)
        print(json.dumps(result, indent=2, default=str))

        # Exit with code 1 if any items were flagged
        if result["flagged_count"] > 0:
            print(
                f"\n⚠️  {result['flagged_count']} of {result['total_items']} items flagged "
                f"(completed in {result['duration_seconds']}s)",
                file=sys.stderr,
            )
            sys.exit(0)  # Success — flagging is expected behavior
    finally:
        if dependencies._redis:
            await dependencies._redis.aclose()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
