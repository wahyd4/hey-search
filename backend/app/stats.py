# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Junwei Zhao
"""Search analytics – persisted in a local SQLite database."""

from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

_DB_PATH = Path(__file__).parent.parent / "data" / "stats.db"
_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    with _lock, _conn() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS search_events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                query       TEXT    NOT NULL,
                category    TEXT    NOT NULL DEFAULT 'web',
                origin_ip   TEXT    NOT NULL DEFAULT '',
                user_agent  TEXT    NOT NULL DEFAULT '',
                result_count INTEGER NOT NULL DEFAULT 0,
                cached      INTEGER NOT NULL DEFAULT 0,
                ts          TEXT    NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_se_ts    ON search_events(ts);
            CREATE INDEX IF NOT EXISTS idx_se_query ON search_events(query COLLATE NOCASE);

            CREATE TABLE IF NOT EXISTS click_events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                query       TEXT    NOT NULL,
                category    TEXT    NOT NULL DEFAULT 'web',
                position    INTEGER NOT NULL DEFAULT 0,
                url         TEXT    NOT NULL,
                title       TEXT    NOT NULL DEFAULT '',
                engine      TEXT    NOT NULL DEFAULT '',
                origin_ip   TEXT    NOT NULL DEFAULT '',
                ts          TEXT    NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_ce_ts     ON click_events(ts);
            CREATE INDEX IF NOT EXISTS idx_ce_query  ON click_events(query COLLATE NOCASE);
            CREATE INDEX IF NOT EXISTS idx_ce_url    ON click_events(url);
            CREATE INDEX IF NOT EXISTS idx_ce_engine ON click_events(engine);
        """)


# ---------------------------------------------------------------------------
# Write helpers
# ---------------------------------------------------------------------------

def record_search(
    query: str,
    category: str,
    origin_ip: str,
    user_agent: str,
    result_count: int,
    cached: bool,
) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    with _lock, _conn() as con:
        con.execute(
            "INSERT INTO search_events (query, category, origin_ip, user_agent, result_count, cached, ts) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (query, category, origin_ip, user_agent, result_count, int(cached), ts),
        )


def record_click(
    query: str,
    category: str,
    position: int,
    url: str,
    title: str,
    engine: str,
    origin_ip: str,
) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    with _lock, _conn() as con:
        con.execute(
            "INSERT INTO click_events (query, category, position, url, title, engine, origin_ip, ts) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (query, category, position, url, title, engine, origin_ip, ts),
        )


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------

def get_summary(days: int = 7) -> dict:
    """Return aggregated stats for the last *days* days."""
    cutoff = f"{datetime.now(timezone.utc).date().isoformat()}T00:00:00+00:00"
    # Rough: use string comparison on ISO dates (works because format is fixed)
    import datetime as dt
    cutoff_dt = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    cutoff = cutoff_dt.isoformat()

    with _lock, _conn() as con:
        total_searches = con.execute(
            "SELECT COUNT(*) FROM search_events WHERE ts >= ?", (cutoff,)
        ).fetchone()[0]

        total_clicks = con.execute(
            "SELECT COUNT(*) FROM click_events WHERE ts >= ?", (cutoff,)
        ).fetchone()[0]

        top_queries = [
            {"query": r["query"], "count": r["cnt"]}
            for r in con.execute(
                "SELECT query, COUNT(*) AS cnt FROM search_events WHERE ts >= ? "
                "GROUP BY query COLLATE NOCASE ORDER BY cnt DESC LIMIT 20",
                (cutoff,),
            ).fetchall()
        ]

        top_clicked_urls = [
            {"url": r["url"], "title": r["title"], "engine": r["engine"], "count": r["cnt"]}
            for r in con.execute(
                "SELECT url, title, engine, COUNT(*) AS cnt FROM click_events WHERE ts >= ? "
                "GROUP BY url ORDER BY cnt DESC LIMIT 20",
                (cutoff,),
            ).fetchall()
        ]

        top_positions = [
            {"position": r["position"], "count": r["cnt"]}
            for r in con.execute(
                "SELECT position, COUNT(*) AS cnt FROM click_events WHERE ts >= ? "
                "GROUP BY position ORDER BY position ASC LIMIT 20",
                (cutoff,),
            ).fetchall()
        ]

        engine_clicks = [
            {"engine": r["engine"], "count": r["cnt"]}
            for r in con.execute(
                "SELECT engine, COUNT(*) AS cnt FROM click_events WHERE ts >= ? "
                "GROUP BY engine ORDER BY cnt DESC",
                (cutoff,),
            ).fetchall()
        ]

        daily_searches = [
            {"date": r["day"], "searches": r["cnt"]}
            for r in con.execute(
                "SELECT substr(ts, 1, 10) AS day, COUNT(*) AS cnt "
                "FROM search_events WHERE ts >= ? GROUP BY day ORDER BY day DESC LIMIT 30",
                (cutoff,),
            ).fetchall()
        ]

    return {
        "period_days": days,
        "total_searches": total_searches,
        "total_clicks": total_clicks,
        "top_queries": top_queries,
        "top_clicked_urls": top_clicked_urls,
        "top_positions": top_positions,
        "engine_clicks": engine_clicks,
        "daily_searches": daily_searches,
    }
