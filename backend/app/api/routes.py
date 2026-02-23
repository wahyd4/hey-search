"""API routes for Hey Search."""

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
from app.cache import is_cache_available, flush_cache

router = APIRouter()


# --- Search ---

@router.get(
    "/search",
    response_model=SearchResponse,
    summary="Search the web or images",
    description="""Performs a metasearch across all enabled engines and returns aggregated, deduplicated results.

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
    q: str = Query(..., description="Search query string", min_length=1),
    category: Literal["web", "images"] = Query("web", description="Search category"),
    page: int = Query(1, ge=1, le=50, description="Page number"),
    engines: str | None = Query(None, description="Comma-separated engine names to use (e.g. 'google,bing')"),
    image_size: Literal["", "large", "medium", "small"] = Query("", description="Filter images by size (images category only)"),
):
    engine_list = [e.strip() for e in engines.split(",")] if engines else None
    return await search(q, category=category, page=page, engines=engine_list, image_size=image_size)


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


# --- Engine Management ---

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


class UpdateSettingsRequest(BaseModel):
    cache_ttl_hours: float = Field(ge=0, le=168, description="Cache TTL in hours (0 = disabled, max 168 = 1 week)")


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
    set_setting("cache_ttl_hours", str(body.cache_ttl_hours))
    return SettingsResponse(
        cache_ttl_hours=body.cache_ttl_hours,
        cache_available=is_cache_available(),
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
