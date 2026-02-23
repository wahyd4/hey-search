"""Background image management — fetch from Unsplash, cache locally."""

from __future__ import annotations

import logging
import os
import time
import uuid
from pathlib import Path

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
_current: dict | None = None  # {"filename": ..., "fetched_at": ...}


def _ensure_dir() -> None:
    BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)


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
        })
    return result


async def fetch_new_background() -> str | None:
    """Download a new background image from Unsplash, save it, return filename."""
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
                    filepath.write_bytes(resp.content)
                    _current = {"filename": filename, "fetched_at": time.time()}
                    logger.info("Background image saved: %s (%d bytes)", filename, len(resp.content))
                    return filename
            except Exception as e:
                logger.warning("Failed to fetch background from %s: %s", url, e)

    return None


async def get_current_background() -> str | None:
    """Get current background filename, fetching a new one if needed."""
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
            _current = {"filename": files[0].name, "fetched_at": st.st_mtime}
            if age_minutes < get_refresh_minutes():
                return _current["filename"]

    if _needs_refresh():
        result = await fetch_new_background()
        if result:
            return result
        # If fetch failed but we have a previous image, use it
        if _current:
            return _current["filename"]
        return None

    return _current["filename"] if _current else None


def get_background_path(filename: str) -> Path | None:
    """Get the full path to a background image file."""
    path = BACKGROUNDS_DIR / filename
    if path.is_file():
        return path
    return None
