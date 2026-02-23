"""Result models for search engines."""

from __future__ import annotations

from pydantic import BaseModel, Field


class WebResult(BaseModel):
    """A single web search result."""
    title: str
    url: str
    content: str = ""
    engine: str = ""


class ImageResult(BaseModel):
    """A single image search result."""
    title: str
    url: str
    img_src: str
    thumbnail_src: str = ""
    source: str = ""
    engine: str = ""


class EngineError(BaseModel):
    """An error from a search engine."""
    engine: str
    message: str
    is_timeout: bool = False


class SearchResponse(BaseModel):
    """Aggregated search response from all engines."""
    query: str
    category: str = "web"
    results: list[WebResult | ImageResult] = Field(default_factory=list)
    errors: list[EngineError] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class EngineInfo(BaseModel):
    """Engine metadata for management."""
    name: str
    display_name: str
    enabled: bool = True
    supports_web: bool = True
    supports_images: bool = True
