# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Junwei Zhao
"""SQLite-backed bookmarks storage."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from app.excluded import _get_conn

logger = logging.getLogger(__name__)


def init_bookmarks_table() -> None:
    """Create the bookmarks table if it doesn't exist."""
    conn = _get_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS bookmarks (
            id          TEXT PRIMARY KEY,
            type        TEXT NOT NULL,          -- 'web' or 'image'
            title       TEXT NOT NULL,
            url         TEXT NOT NULL,
            content     TEXT DEFAULT '',         -- snippet for web results
            img_src     TEXT DEFAULT '',         -- image URL for image results
            thumbnail_src TEXT DEFAULT '',
            source      TEXT DEFAULT '',
            engine      TEXT DEFAULT '',
            width       INTEGER DEFAULT 0,
            height      INTEGER DEFAULT 0,
            created_at  TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()
    logger.info("Bookmarks table initialized")


def add_bookmark(data: dict) -> dict:
    """Add a bookmark. Returns the created bookmark."""
    conn = _get_conn()
    bookmark_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO bookmarks (id, type, title, url, content, img_src, thumbnail_src, source, engine, width, height, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            bookmark_id,
            data.get("type", "web"),
            data.get("title", ""),
            data.get("url", ""),
            data.get("content", ""),
            data.get("img_src", ""),
            data.get("thumbnail_src", ""),
            data.get("source", ""),
            data.get("engine", ""),
            data.get("width", 0),
            data.get("height", 0),
            now,
        ),
    )
    conn.commit()
    conn.close()
    return {
        "id": bookmark_id,
        "type": data.get("type", "web"),
        "title": data.get("title", ""),
        "url": data.get("url", ""),
        "content": data.get("content", ""),
        "img_src": data.get("img_src", ""),
        "thumbnail_src": data.get("thumbnail_src", ""),
        "source": data.get("source", ""),
        "engine": data.get("engine", ""),
        "width": data.get("width", 0),
        "height": data.get("height", 0),
        "created_at": now,
    }


def remove_bookmark(bookmark_id: str) -> bool:
    """Remove a bookmark by ID. Returns True if deleted."""
    conn = _get_conn()
    cursor = conn.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def remove_bookmark_by_url(url: str) -> bool:
    """Remove a bookmark by URL. Returns True if deleted."""
    conn = _get_conn()
    cursor = conn.execute("DELETE FROM bookmarks WHERE url = ?", (url,))
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def get_bookmarks(page: int = 1, per_page: int = 30, type_filter: str = "") -> list[dict]:
    """Get bookmarks, newest first. Optionally filter by type."""
    conn = _get_conn()
    offset = (page - 1) * per_page
    if type_filter:
        rows = conn.execute(
            "SELECT id, type, title, url, content, img_src, thumbnail_src, source, engine, width, height, created_at "
            "FROM bookmarks WHERE type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (type_filter, per_page, offset),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, type, title, url, content, img_src, thumbnail_src, source, engine, width, height, created_at "
            "FROM bookmarks ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (per_page, offset),
        ).fetchall()
    conn.close()
    cols = ["id", "type", "title", "url", "content", "img_src", "thumbnail_src", "source", "engine", "width", "height", "created_at"]
    return [dict(zip(cols, row)) for row in rows]


def get_bookmarked_urls() -> set[str]:
    """Get all bookmarked URLs as a set (for quick lookup)."""
    conn = _get_conn()
    rows = conn.execute("SELECT url FROM bookmarks").fetchall()
    conn.close()
    return {row[0] for row in rows}


def count_bookmarks(type_filter: str = "") -> int:
    """Count total bookmarks."""
    conn = _get_conn()
    if type_filter:
        row = conn.execute("SELECT COUNT(*) FROM bookmarks WHERE type = ?", (type_filter,)).fetchone()
    else:
        row = conn.execute("SELECT COUNT(*) FROM bookmarks").fetchone()
    conn.close()
    return row[0] if row else 0
