"""SQLite-backed storage for excluded domains."""

from __future__ import annotations

import sqlite3
import logging
from pathlib import Path
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "hey_search.db"


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    conn = _get_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS excluded_domains (
            domain TEXT PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()
    logger.info("Database initialized at %s", DB_PATH)


def get_excluded_domains() -> list[str]:
    conn = _get_conn()
    rows = conn.execute("SELECT domain FROM excluded_domains ORDER BY domain").fetchall()
    conn.close()
    return [r[0] for r in rows]


def add_excluded_domain(domain: str) -> bool:
    """Add a domain to the exclusion list. Returns True if added, False if already exists."""
    domain = _normalize_domain(domain)
    if not domain:
        return False
    conn = _get_conn()
    try:
        conn.execute("INSERT OR IGNORE INTO excluded_domains (domain) VALUES (?)", (domain,))
        conn.commit()
        return conn.total_changes > 0
    finally:
        conn.close()


def remove_excluded_domain(domain: str) -> bool:
    """Remove a domain from the exclusion list. Returns True if removed."""
    domain = _normalize_domain(domain)
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM excluded_domains WHERE domain = ?", (domain,))
        conn.commit()
        return conn.total_changes > 0
    finally:
        conn.close()


def is_url_excluded(url: str) -> bool:
    """Check if a URL's domain (or any parent domain) is excluded."""
    try:
        hostname = urlparse(url).hostname or ""
    except Exception:
        return False
    excluded = get_excluded_domains()
    for excl in excluded:
        if hostname == excl or hostname.endswith("." + excl):
            return True
    return False


def _normalize_domain(domain: str) -> str:
    """Normalize a domain input — strip protocol, path, whitespace."""
    domain = domain.strip().lower()
    if "://" in domain:
        domain = urlparse(domain).hostname or domain
    domain = domain.split("/")[0]  # remove path
    domain = domain.lstrip(".")
    return domain
