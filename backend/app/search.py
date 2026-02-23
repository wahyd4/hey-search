"""Search orchestrator - coordinates searches across multiple engines concurrently."""

from __future__ import annotations

import asyncio
import logging

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import httpx

from app.models import WebResult, ImageResult, EngineError, EngineStat, SearchResponse
from app.engines.base import SearchEngine, SearchCategory
from app.engines import registry
from app.excluded import is_url_excluded
from app import cache

logger = logging.getLogger(__name__)

# Retry config: 2 retries with exponential backoff (0.5s, 1s)
RETRY_DECORATOR = retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=2),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout)),
    reraise=True,
)


async def _search_single_engine(
    engine: SearchEngine,
    query: str,
    category: SearchCategory,
    page: int,
    image_size: str = "",
) -> tuple[list[WebResult] | list[ImageResult], EngineError | None]:
    """Search a single engine with retry logic."""

    @RETRY_DECORATOR
    async def _do_search():
        if category == "images":
            return await engine.search_images(query, page, image_size=image_size)
        return await engine.search_web(query, page)

    try:
        results = await _do_search()
        return results, None
    except asyncio.TimeoutError:
        logger.warning("Engine %s timed out for query '%s'", engine.name, query)
        return [], EngineError(engine=engine.name, message="Search timed out", is_timeout=True, code="timeout", retry_hint="Try again or increase timeout")
    except httpx.HTTPStatusError as e:
        logger.warning("Engine %s HTTP error: %s", engine.name, e)
        return [], EngineError(engine=engine.name, message=f"HTTP {e.response.status_code}", code="http_error", details=str(e))
    except Exception as e:
        logger.warning("Engine %s error: %s", engine.name, e)
        return [], EngineError(engine=engine.name, message=str(e), code="engine_error", retry_hint="Try again later")


async def search(
    query: str,
    category: SearchCategory = "web",
    page: int = 1,
    engines: list[str] | None = None,
    image_size: str = "",
) -> SearchResponse:
    """Search across all enabled engines concurrently, with optional Redis caching."""
    engines_key = ",".join(sorted(engines)) if engines else ""

    # Check cache first
    cached_data = await cache.get_cached(query, category, page, image_size, engines_key)
    if cached_data is not None:
        resp = SearchResponse(**cached_data)
        resp.cached = True
        return resp

    enabled_engines = registry.get_enabled_engines()

    if engines:
        enabled_engines = [e for e in enabled_engines if e.name in engines]

    # Filter engines by category support
    if category == "images":
        enabled_engines = [e for e in enabled_engines if e.supports_images]
    else:
        enabled_engines = [e for e in enabled_engines if e.supports_web]

    if not enabled_engines:
        return SearchResponse(query=query, category=category)

    # Run all engine searches concurrently
    tasks = [
        _search_single_engine(engine, query, category, page, image_size=image_size)
        for engine in enabled_engines
    ]
    results_list = await asyncio.gather(*tasks)

    # Aggregate results and build per-engine stats
    all_results: list[WebResult | ImageResult] = []
    all_errors: list[EngineError] = []
    all_stats: list[EngineStat] = []

    for engine, (engine_results, error) in zip(enabled_engines, results_list):
        all_results.extend(engine_results)
        if error:
            all_errors.append(error)
            all_stats.append(EngineStat(
                engine=engine.name,
                display_name=engine.display_name,
                result_count=0,
                status="timeout" if error.is_timeout else "error",
                error_message=error.message,
            ))
        else:
            all_stats.append(EngineStat(
                engine=engine.name,
                display_name=engine.display_name,
                result_count=len(engine_results),
                status="ok",
            ))

    # Deduplicate by URL and filter excluded domains
    seen_urls: set[str] = set()
    unique_results: list[WebResult | ImageResult] = []
    for r in all_results:
        if r.url not in seen_urls and not is_url_excluded(r.url):
            seen_urls.add(r.url)
            unique_results.append(r)

    # Assign final ranks
    for i, r in enumerate(unique_results):
        r.rank = i + 1

    response = SearchResponse(
        query=query,
        category=category,
        page=page,
        results=unique_results,
        errors=all_errors,
        engine_stats=all_stats,
        total_results=len(unique_results),
        has_next=any(s.result_count > 0 for s in all_stats if s.status == "ok"),
    )

    # Store in cache (only if we got results)
    if unique_results:
        await cache.set_cached(query, category, page, image_size, engines_key, response.model_dump())

    return response


async def get_autocomplete(query: str) -> list[str]:
    """Get autocomplete suggestions from enabled engines."""
    enabled = registry.get_enabled_engines()
    # Try Google first, then DuckDuckGo, then Brave
    priority = ["google", "duckduckgo", "brave"]
    for name in priority:
        engine = registry.get_engine(name)
        if engine and registry.is_engine_enabled(name):
            try:
                suggestions = await engine.autocomplete(query)
                if suggestions:
                    return suggestions
            except Exception as e:
                logger.warning("Autocomplete from %s failed: %s", name, e)
                continue
    return []
