"""Abstract base class for search engines."""

from __future__ import annotations

import abc
import logging
from typing import Literal

import httpx

from app.models import WebResult, ImageResult

logger = logging.getLogger(__name__)

SearchCategory = Literal["web", "images"]

# Shared async HTTP client
_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
    return _client


_IMAGE_EXTENSIONS = frozenset({
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg",
    ".tiff", ".tif", ".avif", ".heic", ".ico",
})


def is_image_file_url(url: str) -> bool:
    """Return True if the URL points directly to an image file (not a web page)."""
    path = url.split("?")[0].split("#")[0].lower()
    return any(path.endswith(ext) for ext in _IMAGE_EXTENSIONS)


class SearchEngine(abc.ABC):
    """Abstract search engine interface."""

    name: str
    display_name: str
    supports_web: bool = True
    supports_images: bool = True

    @abc.abstractmethod
    async def search_web(self, query: str, page: int = 1) -> list[WebResult]:
        """Perform a web search and return results."""

    @abc.abstractmethod
    async def search_images(self, query: str, page: int = 1, image_size: str = "") -> list[ImageResult]:
        """Perform an image search and return results.
        
        image_size: "" (all), "large", "medium", "small"
        """

    async def autocomplete(self, query: str) -> list[str]:
        """Return autocomplete suggestions. Override if supported."""
        return []
