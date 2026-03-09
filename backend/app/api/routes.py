"""API routes for HeySearch."""

from __future__ import annotations

from typing import Literal
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.models import SearchResponse, EngineInfo, APIError
from app.search import search, get_autocomplete
from app.engines import registry
from app.excluded import get_excluded_domains, add_excluded_domain, remove_excluded_domain
from app.settings import get_all_settings, get_setting, set_setting
from app.cache import is_cache_available, flush_cache, reconnect_redis
from app.history import get_history, delete_history_entry, clear_history
from app import stats as _stats
from app.version import get_version_info

router = APIRouter()


# --- Search ---

@router.api_route(
    "/search",
    methods=["GET", "POST"],
    response_model=SearchResponse,
    summary="Search the web or images",
    description="""Performs a metasearch across all enabled engines and returns aggregated, deduplicated results.
Supports both GET and POST methods with query parameters.

**Example (curl):**
```bash
curl '$BASE_URL/api/search?q=hello+world&category=web&page=1'
```

**Example response (truncated):**
```json
{
  "query": "hello world",
  "category": "web",
  "page": 1,
  "results": [
    {
      "result_id": "a1b2c3d4e5f6",
      "title": "Hello, World! program - Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Hello,_World!",
      "content": "A \\"Hello, World!\\" program is ...",
      "engine": "google",
      "rank": 1
    }
  ],
  "engine_stats": [...],
  "timestamp": "2025-01-01T00:00:00+00:00",
  "total_results": 25,
  "has_next": true
}
```

**Image search with size filter:**
```bash
curl '$BASE_URL/api/search?q=cats&category=images&image_size=large'
```
""",
    tags=["Search"],
    responses={
        400: {"model": APIError, "description": "Invalid request parameters"},
        500: {"model": APIError, "description": "Internal server error"},
    },
)
async def api_search(
    request: Request,
    q: str = Query(..., description="Search query string", min_length=1),
    category: Literal["web", "images"] = Query("web", description="Search category"),
    page: int = Query(1, ge=1, le=50, description="Page number"),
    pageNumber: int | None = Query(None, ge=1, le=50, description="Alias for page (1-based page number)"),
    numResults: int | None = Query(None, ge=1, le=100, description="Number of results requested (informational)"),
    format: str | None = Query(None, description="Response format hint (e.g. 'json')"),
    imageProxy: bool | None = Query(None, description="Whether the client wants image proxying"),
    safesearch: str | None = Query(None, description="Safe search level (0=off, 1=moderate, 2=strict)"),
    engines: str | None = Query(None, description="Comma-separated engine names to use (e.g. 'google,bing')"),
    image_size: Literal["", "large", "medium", "small"] = Query("", description="Filter images by size (images category only)"),
    sort: Literal["default", "date_asc", "date_desc"] = Query("default", description="Sort results by publish date"),
    date_filter: Literal["", "day", "week", "month", "year"] = Query("", description="Filter results by publish date recency (day=24h, week=7d, month=30d, year=365d)"),
):
    effective_page = pageNumber if pageNumber is not None else page
    engine_list = [e.strip() for e in engines.split(",")] if engines else None
    result = await search(q, category=category, page=effective_page, engines=engine_list, image_size=image_size, sort=sort, date_filter=date_filter)
    origin_ip = request.client.host if request.client else ""
    user_agent = request.headers.get("user-agent", "")
    _stats.record_search(
        query=q,
        category=category,
        origin_ip=origin_ip,
        user_agent=user_agent,
        result_count=result.total_results,
        cached=result.cached,
    )
    return result


# --- Autocomplete ---

class AutocompleteResponse(BaseModel):
    query: str
    suggestions: list[str]


@router.get(
    "/autocomplete",
    response_model=AutocompleteResponse,
    summary="Get search suggestions",
    description="""Returns autocomplete suggestions for the given query.

**Example:**
```bash
curl '$BASE_URL/api/autocomplete?q=pyth'
```

**Response:**
```json
{
  "query": "pyth",
  "suggestions": ["python", "python tutorial", "python download", ...]
}
```
""",
    tags=["Search"],
)
async def api_autocomplete(
    q: str = Query(..., description="Partial search query", min_length=1),
):
    suggestions = await get_autocomplete(q)
    return AutocompleteResponse(query=q, suggestions=suggestions)


# --- History ---

class HistoryEntry(BaseModel):
    id: int
    query: str
    category: str
    ts: str


class HistoryResponse(BaseModel):
    entries: list[HistoryEntry]
    total: int
    page: int
    per_page: int


@router.get(
    "/history",
    response_model=HistoryResponse,
    summary="Get search history",
    description="Returns paginated search history ordered by most recent first.",
    tags=["Search"],
)
async def api_get_history(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=200, description="Results per page"),
):
    entries, total = get_history(page, per_page)
    return HistoryResponse(
        entries=[HistoryEntry(**e) for e in entries],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.delete(
    "/history",
    summary="Clear all search history",
    tags=["Search"],
)
async def api_clear_history():
    count = clear_history()
    return {"deleted": count}


@router.delete(
    "/history/{entry_id}",
    summary="Delete a single history entry",
    tags=["Search"],
    responses={404: {"model": APIError, "description": "Entry not found"}},
)
async def api_delete_history_entry(entry_id: int):
    if not delete_history_entry(entry_id):
        return JSONResponse(
            status_code=404,
            content=APIError(code="not_found", message=f"History entry {entry_id} not found").model_dump(),
        )
    return {"ok": True}



@router.get(
    "/engines",
    response_model=list[EngineInfo],
    summary="List all search engines",
    description="""Returns all available search engines and their current enabled/disabled status.

**Example:**
```bash
curl '$BASE_URL/api/engines'
```
""",
    tags=["Engines"],
)
async def api_list_engines():
    return registry.get_all_engine_info()


class EngineOrderRequest(BaseModel):
    order: list[str]


@router.put(
    "/engines/order",
    response_model=list[EngineInfo],
    summary="Reorder search engines",
    description="Set the global engine priority order. Pass a list of engine names; results will be grouped by engine in this order.",
    tags=["Engines"],
)
async def api_reorder_engines(body: EngineOrderRequest):
    registry.set_engine_order(body.order)
    return registry.get_all_engine_info()


class EngineToggleRequest(BaseModel):
    enabled: bool


@router.put(
    "/engines/{engine_name}",
    response_model=EngineInfo,
    summary="Enable or disable a search engine",
    description="""Toggle an engine on or off. Disabled engines are skipped during search.

**Example:**
```bash
curl -X PUT '$BASE_URL/api/engines/google' \\
  -H 'Content-Type: application/json' \\
  -d '{"enabled": false}'
```
""",
    tags=["Engines"],
    responses={404: {"model": APIError, "description": "Engine not found"}},
)
async def api_toggle_engine(engine_name: str, body: EngineToggleRequest):
    success = registry.set_engine_enabled(engine_name, body.enabled)
    if not success:
        return JSONResponse(
            status_code=404,
            content=APIError(code="not_found", message=f"Engine '{engine_name}' not found").model_dump(),
        )

    engines = registry.get_all_engine_info()
    return next(e for e in engines if e.name == engine_name)


# --- Excluded Domains ---

class ExcludedDomainsResponse(BaseModel):
    domains: list[str]


class AddDomainRequest(BaseModel):
    domain: str


@router.get(
    "/excluded-domains",
    response_model=ExcludedDomainsResponse,
    summary="List excluded domains",
    description="""Returns all domains whose results are filtered out of search results.

**Example:**
```bash
curl '$BASE_URL/api/excluded-domains'
```
""",
    tags=["Exclusions"],
)
async def api_list_excluded_domains():
    return ExcludedDomainsResponse(domains=get_excluded_domains())


@router.post(
    "/excluded-domains",
    response_model=ExcludedDomainsResponse,
    summary="Add an excluded domain",
    description="""Add a domain to the exclusion list. Results from this domain will be hidden.

**Example:**
```bash
curl -X POST '$BASE_URL/api/excluded-domains' \\
  -H 'Content-Type: application/json' \\
  -d '{"domain": "example.com"}'
```
""",
    tags=["Exclusions"],
)
async def api_add_excluded_domain(body: AddDomainRequest):
    add_excluded_domain(body.domain)
    return ExcludedDomainsResponse(domains=get_excluded_domains())


@router.delete(
    "/excluded-domains/{domain:path}",
    response_model=ExcludedDomainsResponse,
    summary="Remove an excluded domain",
    description="""Remove a domain from the exclusion list so its results appear again.

**Example:**
```bash
curl -X DELETE '$BASE_URL/api/excluded-domains/example.com'
```
""",
    tags=["Exclusions"],
    responses={404: {"model": APIError, "description": "Domain not found"}},
)
async def api_remove_excluded_domain(domain: str):
    if not remove_excluded_domain(domain):
        return JSONResponse(
            status_code=404,
            content=APIError(code="not_found", message=f"Domain '{domain}' not in exclusion list").model_dump(),
        )
    return ExcludedDomainsResponse(domains=get_excluded_domains())


# --- Settings ---

class SettingsResponse(BaseModel):
    cache_ttl_hours: float = Field(description="Cache TTL in hours (0 = disabled, max 168 = 1 week)")
    cache_available: bool = Field(description="Whether Redis is connected and available")
    redis_url: str = Field(default="", description="Redis connection URL (e.g. redis://localhost:6379)")
    bg_enabled: bool = Field(default=True, description="Whether homepage background image is enabled")
    bg_refresh_minutes: int = Field(default=30, description="Background image refresh interval in minutes (1-1440)")


class UpdateSettingsRequest(BaseModel):
    cache_ttl_hours: float | None = Field(default=None, ge=0, le=168, description="Cache TTL in hours (0 = disabled, max 168 = 1 week)")
    redis_url: str | None = Field(default=None, description="Redis connection URL (empty string to disconnect)")
    bg_enabled: bool | None = Field(default=None, description="Enable/disable homepage background image")
    bg_refresh_minutes: int | None = Field(default=None, ge=1, le=1440, description="Background refresh interval in minutes")


@router.get(
    "/settings",
    response_model=SettingsResponse,
    summary="Get application settings",
    description="""Returns current application settings including cache TTL.

**Example:**
```bash
curl '$BASE_URL/api/settings'
```
""",
    tags=["Settings"],
)
async def api_get_settings():
    settings = get_all_settings()
    return SettingsResponse(
        cache_ttl_hours=float(settings.get("cache_ttl_hours", "6")),
        cache_available=is_cache_available(),
        redis_url=settings.get("redis_url", ""),
        bg_enabled=settings.get("bg_enabled", "true") == "true",
        bg_refresh_minutes=int(float(settings.get("bg_refresh_minutes", "30"))),
    )


@router.put(
    "/settings",
    response_model=SettingsResponse,
    summary="Update application settings",
    description="""Update settings such as cache TTL. Set `cache_ttl_hours` to 0 to disable caching.

**Example:**
```bash
curl -X PUT '$BASE_URL/api/settings' \\
  -H 'Content-Type: application/json' \\
  -d '{"cache_ttl_hours": 12}'
```
""",
    tags=["Settings"],
)
async def api_update_settings(body: UpdateSettingsRequest):
    if body.cache_ttl_hours is not None:
        set_setting("cache_ttl_hours", str(body.cache_ttl_hours))
    if body.redis_url is not None:
        set_setting("redis_url", body.redis_url)
        await reconnect_redis(body.redis_url)
    if body.bg_enabled is not None:
        set_setting("bg_enabled", "true" if body.bg_enabled else "false")
    if body.bg_refresh_minutes is not None:
        set_setting("bg_refresh_minutes", str(body.bg_refresh_minutes))
    settings = get_all_settings()
    return SettingsResponse(
        cache_ttl_hours=float(settings.get("cache_ttl_hours", "6")),
        cache_available=is_cache_available(),
        redis_url=settings.get("redis_url", ""),
        bg_enabled=settings.get("bg_enabled", "true") == "true",
        bg_refresh_minutes=int(float(settings.get("bg_refresh_minutes", "30"))),
    )


# --- Cache Management ---

class CacheFlushResponse(BaseModel):
    keys_deleted: int
    message: str


@router.delete(
    "/cache",
    response_model=CacheFlushResponse,
    summary="Flush the search cache",
    description="""Delete all cached search results from Redis.

**Example:**
```bash
curl -X DELETE '$BASE_URL/api/cache'
```
""",
    tags=["Settings"],
)
async def api_flush_cache():
    count = await flush_cache()
    return CacheFlushResponse(keys_deleted=count, message=f"Deleted {count} cached entries")


# --- Background Images ---

from fastapi.responses import FileResponse
from app.background import get_current_background, fetch_new_background, list_backgrounds, get_background_path


class BackgroundResponse(BaseModel):
    filename: str | None = None
    url: str | None = None
    source_url: str | None = None
    enabled: bool = True


class BackgroundListItem(BaseModel):
    filename: str
    url: str
    source_url: str = ""
    size_bytes: int
    created_at: float


@router.get(
    "/background",
    response_model=BackgroundResponse,
    summary="Get current homepage background image info",
    tags=["Background"],
)
async def api_get_background():
    from app.background import is_background_enabled
    enabled = is_background_enabled()
    if not enabled:
        return BackgroundResponse(enabled=False)
    info = await get_current_background()
    if info:
        return BackgroundResponse(
            filename=info["filename"],
            url=f"/api/backgrounds/{info['filename']}",
            source_url=info.get("source_url", ""),
            enabled=True,
        )
    return BackgroundResponse(enabled=True)


@router.post(
    "/background/refresh",
    response_model=BackgroundResponse,
    summary="Fetch a new background image immediately",
    tags=["Background"],
)
async def api_refresh_background():
    info = await fetch_new_background()
    if info:
        return BackgroundResponse(
            filename=info["filename"],
            url=f"/api/backgrounds/{info['filename']}",
            source_url=info.get("source_url", ""),
            enabled=True,
        )
    return JSONResponse(status_code=502, content={"code": "fetch_failed", "message": "Could not fetch background image"})


@router.get(
    "/backgrounds",
    response_model=list[BackgroundListItem],
    summary="List all saved background images",
    tags=["Background"],
)
async def api_list_backgrounds(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    all_bgs = list_backgrounds()
    start = (page - 1) * per_page
    items = all_bgs[start:start + per_page]
    return [
        BackgroundListItem(
            filename=b["filename"],
            url=f"/api/backgrounds/{b['filename']}",
            source_url=b.get("source_url", ""),
            size_bytes=b["size_bytes"],
            created_at=b["created_at"],
        )
        for b in items
    ]


@router.get(
    "/backgrounds/{filename}",
    summary="Serve a background image file",
    tags=["Background"],
)
async def api_serve_background(filename: str):
    path = get_background_path(filename)
    if path is None:
        return JSONResponse(status_code=404, content={"code": "not_found", "message": "Image not found"})
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


# --- Bookmarks ---

from app.bookmarks import add_bookmark, remove_bookmark, remove_bookmark_by_url, get_bookmarks, get_bookmarked_urls, count_bookmarks


class BookmarkCreate(BaseModel):
    type: Literal["web", "image"] = "web"
    title: str
    url: str
    content: str = ""
    img_src: str = ""
    thumbnail_src: str = ""
    source: str = ""
    engine: str = ""
    width: int = 0
    height: int = 0


class BookmarkItem(BaseModel):
    id: str
    type: str
    title: str
    url: str
    content: str = ""
    img_src: str = ""
    thumbnail_src: str = ""
    source: str = ""
    engine: str = ""
    width: int = 0
    height: int = 0
    created_at: str


class BookmarkListResponse(BaseModel):
    bookmarks: list[BookmarkItem]
    total: int
    page: int
    per_page: int


class BookmarkedUrlsResponse(BaseModel):
    urls: list[str]


@router.get(
    "/bookmarks",
    response_model=BookmarkListResponse,
    summary="List bookmarks",
    tags=["Bookmarks"],
)
async def api_list_bookmarks(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    type: str = Query("", description="Filter by type: 'web' or 'image'"),
):
    items = get_bookmarks(page, per_page, type)
    total = count_bookmarks(type)
    return BookmarkListResponse(
        bookmarks=[BookmarkItem(**b) for b in items],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/bookmarks/urls",
    response_model=BookmarkedUrlsResponse,
    summary="Get all bookmarked URLs for quick lookup",
    tags=["Bookmarks"],
)
async def api_bookmarked_urls():
    return BookmarkedUrlsResponse(urls=list(get_bookmarked_urls()))


@router.post(
    "/bookmarks",
    response_model=BookmarkItem,
    summary="Add a bookmark",
    tags=["Bookmarks"],
)
async def api_add_bookmark(body: BookmarkCreate):
    result = add_bookmark(body.model_dump())
    return BookmarkItem(**result)


@router.delete(
    "/bookmarks/{bookmark_id}",
    summary="Remove a bookmark by ID",
    tags=["Bookmarks"],
)
async def api_remove_bookmark(bookmark_id: str):
    removed = remove_bookmark(bookmark_id)
    if not removed:
        return JSONResponse(status_code=404, content={"code": "not_found", "message": "Bookmark not found"})
    return {"message": "Bookmark removed"}


@router.delete(
    "/bookmarks/by-url/{url:path}",
    summary="Remove a bookmark by URL",
    tags=["Bookmarks"],
)
async def api_remove_bookmark_by_url(url: str):
    removed = remove_bookmark_by_url(url)
    if not removed:
        return JSONResponse(status_code=404, content={"code": "not_found", "message": "Bookmark not found"})
    return {"message": "Bookmark removed"}


# --- Analytics / Stats ---

class ClickEventRequest(BaseModel):
    query: str
    category: str = "web"
    position: int = 0
    url: str
    title: str = ""
    engine: str = ""


class StatsResponse(BaseModel):
    period_days: int
    total_searches: int
    total_clicks: int
    top_queries: list[dict]
    top_clicked_urls: list[dict]
    top_positions: list[dict]
    engine_clicks: list[dict]
    daily_searches: list[dict]


@router.post(
    "/stats/click",
    summary="Record a result click",
    description="Called by the frontend when a user clicks a search result.",
    tags=["Stats"],
)
async def api_record_click(body: ClickEventRequest, request: Request):
    origin_ip = request.client.host if request.client else ""
    _stats.record_click(
        query=body.query,
        category=body.category,
        position=body.position,
        url=body.url,
        title=body.title,
        engine=body.engine,
        origin_ip=origin_ip,
    )
    return {"ok": True}


@router.get(
    "/stats",
    response_model=StatsResponse,
    summary="Get search analytics summary",
    description="Returns aggregated search and click statistics for the last N days.",
    tags=["Stats"],
)
async def api_get_stats(days: int = Query(7, ge=1, le=365)):
    return _stats.get_summary(days)


# --- Version ---

@router.get("/version", summary="App version", tags=["System"])
async def api_version():
    return get_version_info()
