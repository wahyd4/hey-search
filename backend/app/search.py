"""Search orchestrator - coordinates searches across multiple engines concurrently."""

from __future__ import annotations

import asyncio
import logging

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import httpx

from app.models import WebResult, ImageResult, EngineError, SearchResponse
from app.engines.base import SearchEngine, SearchCategory
from app.engines import registry
from app.excluded import is_url_excluded

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
) -> tuple[list[WebResult] | list[ImageResult], EngineError | None]:
    """Search a single engine with retry logic."""

    @RETRY_DECORATOR
    async def _do_search():
        if category == "images":
            return await engine.search_images(query, page)
        return await engine.search_web(query, page)

    try:
        results = await _do_search()
        return results, None
    except asyncio.TimeoutError:
        logger.warning("Engine %s timed out for query '%s'", engine.name, query)
        return [], EngineError(engine=engine.name, message="Search timed out", is_timeout=True)
    except httpx.HTTPStatusError as e:
        logger.warning("Engine %s HTTP error: %s", engine.name, e)
        return [], EngineError(engine=engine.name, message=f"HTTP {e.response.status_code}")
    except Exception as e:
        logger.warning("Engine %s error: %s", engine.name, e)
        return [], EngineError(engine=engine.name, message=str(e))


async def search(
    query: str,
    category: SearchCategory = "web",
    page: int = 1,
    engines: list[str] | None = None,
) -> SearchResponse:
    """Search across all enabled engines concurrently."""
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
        _search_single_engine(engine, query, category, page)
        for engine in enabled_engines
    ]
    results_list = await asyncio.gather(*tasks)

    # Aggregate results
    all_results: list[WebResult | ImageResult] = []
    all_errors: list[EngineError] = []

    for engine_results, error in results_list:
        all_results.extend(engine_results)
        if error:
            all_errors.append(error)

    # Deduplicate by URL and filter excluded domains
    seen_urls: set[str] = set()
    unique_results: list[WebResult | ImageResult] = []
    for r in all_results:
        if r.url not in seen_urls and not is_url_excluded(r.url):
            seen_urls.add(r.url)
            unique_results.append(r)

    return SearchResponse(
        query=query,
        category=category,
        results=unique_results,
        errors=all_errors,
    )


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
