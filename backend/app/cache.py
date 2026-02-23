"""Optional Redis cache for search results.

When REDIS_URL is not set or Redis is unreachable, all operations
gracefully degrade to no-ops (cache miss / skip).
"""

from __future__ import annotations

import json
import hashlib
import logging
import os

import redis.asyncio as aioredis

from app.settings import get_cache_ttl_seconds

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None
_available: bool = False


async def init_redis() -> None:
    """Try to connect to Redis. If it fails, caching is silently disabled."""
    global _redis, _available
    url = os.environ.get("REDIS_URL", "")
    if not url:
        logger.info("REDIS_URL not set — caching disabled")
        return
    try:
        _redis = aioredis.from_url(url, decode_responses=True, socket_connect_timeout=3)
        await _redis.ping()
        _available = True
        logger.info("Redis connected at %s — caching enabled", url)
    except Exception as e:
        logger.warning("Redis unavailable (%s) — caching disabled", e)
        _redis = None
        _available = False


async def close_redis() -> None:
    global _redis, _available
    if _redis:
        await _redis.aclose()
    _redis = None
    _available = False


def is_cache_available() -> bool:
    return _available and _redis is not None


def _cache_key(query: str, category: str, page: int, image_size: str, engines: str) -> str:
    """Build a deterministic cache key."""
    raw = f"hs:{category}:{page}:{image_size}:{engines}:{query}"
    h = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"hs:search:{h}"


async def get_cached(query: str, category: str, page: int, image_size: str, engines: str) -> dict | None:
    """Return cached search response dict, or None on miss."""
    if not is_cache_available():
        return None
    ttl = get_cache_ttl_seconds()
    if ttl <= 0:
        return None
    key = _cache_key(query, category, page, image_size, engines)
    try:
        data = await _redis.get(key)  # type: ignore[union-attr]
        if data:
            logger.debug("Cache HIT for key %s", key)
            return json.loads(data)
    except Exception as e:
        logger.warning("Cache get error: %s", e)
    return None


async def set_cached(query: str, category: str, page: int, image_size: str, engines: str, response_dict: dict) -> None:
    """Store a search response in cache."""
    if not is_cache_available():
        return
    ttl = get_cache_ttl_seconds()
    if ttl <= 0:
        return
    key = _cache_key(query, category, page, image_size, engines)
    try:
        await _redis.set(key, json.dumps(response_dict, default=str), ex=ttl)  # type: ignore[union-attr]
        logger.debug("Cache SET for key %s (ttl=%ds)", key, ttl)
    except Exception as e:
        logger.warning("Cache set error: %s", e)


async def flush_cache() -> int:
    """Delete all hey-search cache keys. Returns count deleted."""
    if not is_cache_available():
        return 0
    try:
        keys = []
        async for key in _redis.scan_iter("hs:search:*"):  # type: ignore[union-attr]
            keys.append(key)
        if keys:
            await _redis.delete(*keys)  # type: ignore[union-attr]
        return len(keys)
    except Exception as e:
        logger.warning("Cache flush error: %s", e)
        return 0
