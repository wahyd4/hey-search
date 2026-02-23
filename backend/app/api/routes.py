"""API routes for Hey Search."""

from __future__ import annotations

from typing import Literal
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.models import SearchResponse, EngineInfo
from app.search import search, get_autocomplete
from app.engines import registry

router = APIRouter()


# --- Search ---

@router.get(
    "/search",
    response_model=SearchResponse,
    summary="Search the web or images",
    description="Performs a metasearch across all enabled engines and returns aggregated results.",
    tags=["Search"],
)
async def api_search(
    q: str = Query(..., description="Search query string", min_length=1),
    category: Literal["web", "images"] = Query("web", description="Search category"),
    page: int = Query(1, ge=1, le=50, description="Page number"),
    engines: str | None = Query(None, description="Comma-separated engine names to use"),
):
    engine_list = [e.strip() for e in engines.split(",")] if engines else None
    return await search(q, category=category, page=page, engines=engine_list)


# --- Autocomplete ---

class AutocompleteResponse(BaseModel):
    query: str
    suggestions: list[str]


@router.get(
    "/autocomplete",
    response_model=AutocompleteResponse,
    summary="Get search suggestions",
    description="Returns autocomplete suggestions for the given query.",
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
    description="Returns all available search engines and their current enabled/disabled status.",
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
    description="Toggle an engine on or off. Disabled engines are skipped during search.",
    tags=["Engines"],
)
async def api_toggle_engine(engine_name: str, body: EngineToggleRequest):
    success = registry.set_engine_enabled(engine_name, body.enabled)
    if not success:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Engine '{engine_name}' not found")

    engines = registry.get_all_engine_info()
    return next(e for e in engines if e.name == engine_name)
