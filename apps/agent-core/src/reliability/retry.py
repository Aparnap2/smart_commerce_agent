"""Exponential backoff retry with hard cap."""
import asyncio
import random
from loguru import logger

MAX_RETRIES = 3
BASE_DELAY = 1.0
MAX_DELAY = 10.0

async def retry_with_backoff(func, *args, max_retries=MAX_RETRIES, **kwargs):
    """Retry with exponential backoff. Hard cap at max_retries."""
    last_exception = None
    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            if attempt < max_retries:
                delay = min(BASE_DELAY * (2 ** attempt) + random.uniform(0, 1), MAX_DELAY)
                logger.warning(f"Retry {attempt + 1}/{max_retries} after {delay:.1f}s: {e}")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Max retries ({max_retries}) exhausted: {e}")
    raise last_exception
