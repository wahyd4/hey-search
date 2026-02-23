"""SQLite-backed application settings."""

from __future__ import annotations

import logging

from app.excluded import _get_conn

logger = logging.getLogger(__name__)

# Default values
DEFAULTS: dict[str, str] = {
    "cache_ttl_hours": "6",
}


def init_settings_table() -> None:
    """Create the settings table and populate defaults."""
    conn = _get_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )
    # Insert defaults for any missing keys
    for key, default in DEFAULTS.items():
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            (key, default),
        )
    conn.commit()
    conn.close()
    logger.info("Settings table initialized")


def get_setting(key: str) -> str:
    """Get a single setting value. Returns default if not set."""
    conn = _get_conn()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    if row:
        return row[0]
    return DEFAULTS.get(key, "")


def set_setting(key: str, value: str) -> None:
    """Set a single setting value."""
    conn = _get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (key, value),
    )
    conn.commit()
    conn.close()


def get_all_settings() -> dict[str, str]:
    """Get all settings as a dict."""
    conn = _get_conn()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    result = dict(DEFAULTS)  # start with defaults
    result.update({k: v for k, v in rows})
    return result


def get_cache_ttl_seconds() -> int:
    """Get cache TTL in seconds. Returns 0 if caching is disabled."""
    try:
        hours = float(get_setting("cache_ttl_hours"))
        return max(0, int(hours * 3600))
    except (ValueError, TypeError):
        return 6 * 3600  # fallback: 6 hours
