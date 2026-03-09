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
    published_date: str = ""  # ISO 8601 date (YYYY-MM-DD) or empty


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
    width: int = 0
    height: int = 0
    published_date: str = ""  # ISO 8601 date (YYYY-MM-DD) or empty


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
    cached: bool = False


class EngineInfo(BaseModel):
    """Engine metadata for management."""
    name: str
    display_name: str
    enabled: bool = True
    supports_web: bool = True
    supports_images: bool = True
    order: int = 0


class APIError(BaseModel):
    """Standard error response."""
    code: str
    message: str
    details: str = ""
    retry_hint: str = ""


# --- LLM-optimised response models ---

class LLMWebResult(BaseModel):
    """A single web result stripped to the fields LLMs need."""
    title: str
    url: str
    snippet: str = ""
    date: str = ""


class LLMImageResult(BaseModel):
    """A single image result stripped to the fields LLMs need."""
    title: str
    url: str
    img_src: str
    date: str = ""


class LLMSearchResponse(BaseModel):
    """Minimal search response for LLM / AI-agent consumption.

    Contains only the fields needed for RAG and tool-calling workflows.
    Omits engine metadata, error details, and other browser-UI noise.
    """
    query: str
    category: str = "web"
    results: list[LLMWebResult | LLMImageResult] = Field(default_factory=list)
    total_results: int = 0
