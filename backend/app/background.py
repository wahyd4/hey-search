"""Background image management — fetch from Unsplash, cache locally."""

from __future__ import annotations

import logging
import os
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.excluded import DATA_DIR
from app.settings import get_setting, set_setting

logger = logging.getLogger(__name__)

BACKGROUNDS_DIR = DATA_DIR / "backgrounds"

# Unsplash source URL — returns a random image redirect
UNSPLASH_URL = "https://source.unsplash.com/random/1920x1080?nature,landscape"
# Fallback: picsum
PICSUM_URL = "https://picsum.photos/1920/1080"

# In-memory state for the current background
_current: dict | None = None  # {"filename": ..., "fetched_at": ..., "source_url": ...}


def _page_url_from_response(resp: httpx.Response) -> str:
    """Derive a human-readable photo page URL from the HTTP response.

    Prefers an intermediate redirect URL pointing to a gallery/photo page
    (e.g. unsplash.com/photos/…) over the final CDN image file URL.
    Falls back to parsing known CDN patterns.
    """
    for r in resp.history:
        candidate = str(r.headers.get("location", "")) or str(r.url)
        if "unsplash.com/photos/" in candidate or "picsum.photos/id/" in candidate:
            return candidate.split("?")[0]

    return _cdn_to_page_url(str(resp.url))


def _ensure_dir() -> None:
    BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)


def _cdn_to_page_url(url: str) -> str:
    """Convert a known CDN image URL to its human-readable photo page URL.
    For Picsum, this returns the /info URL — callers should prefer
    _resolve_picsum_source_url() to get the real Unsplash page URL.
    """
    parsed = urlparse(url)

    if parsed.netloc == "images.unsplash.com":
        path = parsed.path  # e.g. "/photo-1506905925346-21bda4d32df4"
        if path.startswith("/photo-"):
            photo_id = path[len("/photo-"):]
            return f"https://unsplash.com/photos/{photo_id}"

    if "picsum.photos" in parsed.netloc:
        parts = [p for p in parsed.path.split("/") if p]
        # path: /id/{id}/width/height.jpg
        if len(parts) >= 2 and parts[0] == "id":
            return f"https://picsum.photos/id/{parts[1]}/info"

    return url


def _picsum_id_from_url(url: str) -> str | None:
    """Extract Picsum photo ID from a CDN or info URL, or None if not a Picsum URL."""
    parsed = urlparse(url)
    if "picsum.photos" not in parsed.netloc and "picsum.photos" not in url:
        return None
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) >= 2 and parts[0] == "id":
        return parts[1]
    return None


async def _resolve_picsum_source_url(photo_id: str) -> str:
    """Fetch https://picsum.photos/id/{id}/info and return the embedded Unsplash page URL."""
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(f"https://picsum.photos/id/{photo_id}/info")
            if resp.is_success:
                data = resp.json()
                if data.get("url"):
                    return data["url"]
    except Exception as e:
        logger.warning("Failed to fetch Picsum info for id %s: %s", photo_id, e)
    return f"https://picsum.photos/id/{photo_id}/info"


def _read_source_url(filename: str) -> str:
    """Read the source URL sidecar file for a background image."""
    url_file = BACKGROUNDS_DIR / (filename.rsplit(".", 1)[0] + ".url")
    if url_file.is_file():
        return _cdn_to_page_url(url_file.read_text().strip())
    return ""


def _write_source_url(filename: str, url: str) -> None:
    """Write the source URL sidecar file for a background image."""
    url_file = BACKGROUNDS_DIR / (filename.rsplit(".", 1)[0] + ".url")
    url_file.write_text(url)


def is_background_enabled() -> bool:
    return get_setting("bg_enabled") == "true"


def get_refresh_minutes() -> int:
    try:
        return max(1, min(1440, int(float(get_setting("bg_refresh_minutes")))))
    except (ValueError, TypeError):
        return 30


def _needs_refresh() -> bool:
    if _current is None:
        return True
    elapsed = time.time() - _current["fetched_at"]
    return elapsed >= get_refresh_minutes() * 60


def list_backgrounds() -> list[dict]:
    """List all saved background images, newest first."""
    _ensure_dir()
    files = sorted(BACKGROUNDS_DIR.glob("*.jpg"), key=lambda f: f.stat().st_mtime, reverse=True)
    result = []
    for f in files:
        st = f.stat()
        result.append({
            "filename": f.name,
            "size_bytes": st.st_size,
            "created_at": st.st_mtime,
            "source_url": _read_source_url(f.name),
        })
    return result


async def fetch_new_background() -> dict | None:
    """Download a new background image, save it, return {filename, source_url}."""
    global _current
    _ensure_dir()

    filename = f"{int(time.time())}_{uuid.uuid4().hex[:8]}.jpg"
    filepath = BACKGROUNDS_DIR / filename

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        # Try Unsplash first, fallback to Picsum
        for url in [UNSPLASH_URL, PICSUM_URL]:
            try:
                resp = await client.get(url)
                if resp.is_success and len(resp.content) > 1000:
                    source_url = _page_url_from_response(resp)
                    # For Picsum, fetch the info JSON to get the real Unsplash page URL
                    picsum_id = _picsum_id_from_url(str(resp.url))
                    if picsum_id:
                        source_url = await _resolve_picsum_source_url(picsum_id)
                    filepath.write_bytes(resp.content)
                    _write_source_url(filename, source_url)
                    _current = {"filename": filename, "fetched_at": time.time(), "source_url": source_url}
                    logger.info("Background image saved: %s (%d bytes) from %s", filename, len(resp.content), source_url)
                    return {"filename": filename, "source_url": source_url}
            except Exception as e:
                logger.warning("Failed to fetch background from %s: %s", url, e)

    return None


async def get_current_background() -> dict | None:
    """Get current background info, fetching a new one if needed. Returns {filename, source_url} or None."""
    global _current

    if not is_background_enabled():
        return None

    # On first call, try to use the most recent saved image
    if _current is None:
        _ensure_dir()
        files = sorted(BACKGROUNDS_DIR.glob("*.jpg"), key=lambda f: f.stat().st_mtime, reverse=True)
        if files:
            st = files[0].stat()
            age_minutes = (time.time() - st.st_mtime) / 60
            source_url = _read_source_url(files[0].name)
            # Upgrade legacy sidecar files that still store a Picsum CDN/info URL
            picsum_id = _picsum_id_from_url(source_url)
            if picsum_id:
                resolved = await _resolve_picsum_source_url(picsum_id)
                _write_source_url(files[0].name, resolved)
                source_url = resolved
            _current = {"filename": files[0].name, "fetched_at": st.st_mtime, "source_url": source_url}
            if age_minutes < get_refresh_minutes():
                return {"filename": _current["filename"], "source_url": source_url}

    if _needs_refresh():
        result = await fetch_new_background()
        if result:
            return result
        # If fetch failed but we have a previous image, use it
        if _current:
            return {"filename": _current["filename"], "source_url": _current.get("source_url", "")}
        return None

    if _current:
        return {"filename": _current["filename"], "source_url": _current.get("source_url", "")}
    return None


def get_background_path(filename: str) -> Path | None:
    """Get the full path to a background image file."""
    path = BACKGROUNDS_DIR / filename
    if path.is_file():
        return path
    return None
