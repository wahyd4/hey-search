"""Search history – reads from the stats search_events table."""

from __future__ import annotations

from app.stats import _DB_PATH, _lock, _conn


def get_history(page: int = 1, per_page: int = 50) -> tuple[list[dict], int]:
    offset = (page - 1) * per_page
    with _lock, _conn() as con:
        total = con.execute("SELECT COUNT(*) FROM search_events").fetchone()[0]
        rows = con.execute(
            "SELECT id, query, category, ts FROM search_events ORDER BY ts DESC LIMIT ? OFFSET ?",
            (per_page, offset),
        ).fetchall()
    return [dict(r) for r in rows], total


def delete_history_entry(entry_id: int) -> bool:
    with _lock, _conn() as con:
        cur = con.execute("DELETE FROM search_events WHERE id = ?", (entry_id,))
        return cur.rowcount > 0


def clear_history() -> int:
    with _lock, _conn() as con:
        cur = con.execute("DELETE FROM search_events")
        return cur.rowcount
