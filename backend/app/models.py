"""Result models for search engines."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field


class WebResult(BaseModel):
    """A single web search result."""
    result_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    title: str
    url: str
    content: str = ""
    engine: str = ""
    rank: int = 0


class ImageResult(BaseModel):
    """A single image search result."""
    result_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    title: str
    url: str
    img_src: str
    thumbnail_src: str = ""
    source: str = ""
    engine: str = ""
    rank: int = 0


class EngineError(BaseModel):
    """An error from a search engine."""
    engine: str
    message: str
    is_timeout: bool = False
    code: str = "engine_error"
    details: str = ""
    retry_hint: str = ""


class EngineStat(BaseModel):
    """Per-engine statistics for a single search."""
    engine: str
    display_name: str
    result_count: int
    status: str = "ok"           # "ok" | "error" | "timeout"
    error_message: str = ""


class SearchResponse(BaseModel):
    """Aggregated search response from all engines."""
    query: str
    category: str = "web"
    page: int = 1
    results: list[WebResult | ImageResult] = Field(default_factory=list)
    errors: list[EngineError] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    engine_stats: list[EngineStat] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    total_results: int = 0
    has_next: bool = True


class EngineInfo(BaseModel):
    """Engine metadata for management."""
    name: str
    display_name: str
    enabled: bool = True
    supports_web: bool = True
    supports_images: bool = True


class APIError(BaseModel):
    """Standard error response."""
    code: str
    message: str
    details: str = ""
    retry_hint: str = ""
