# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Junwei Zhao
"""Date extraction utilities for search engine result snippets."""

from __future__ import annotations

import re
from datetime import datetime, timezone, timedelta

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_date_from_text(text: str) -> str:
    """
    Try to extract a publication date from the start of a snippet text.

    Returns an ISO 8601 date string (YYYY-MM-DD) or empty string if not found.

    Handles:
      - Relative:  "3 hours ago", "2 days ago", "1 week ago", "5 months ago"
      - MDY:       "Jan 15, 2024" or "January 15, 2024"
      - DMY:       "15 Jan 2024" or "15 January 2024"
      - ISO:       "2024-01-15"
    """
    if not text:
        return ""

    text = text.strip()
    now = datetime.now(timezone.utc)

    # Relative: "X unit(s) ago"
    m = re.match(r"^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago", text, re.IGNORECASE)
    if m:
        n = int(m.group(1))
        unit = m.group(2).lower()
        deltas: dict[str, timedelta] = {
            "second": timedelta(seconds=n),
            "minute": timedelta(minutes=n),
            "hour": timedelta(hours=n),
            "day": timedelta(days=n),
            "week": timedelta(weeks=n),
            "month": timedelta(days=n * 30),
            "year": timedelta(days=n * 365),
        }
        return (now - deltas[unit]).date().isoformat()

    # MDY: "Jan 15, 2024" or "January 15, 2024"
    m = re.match(r"^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})", text)
    if m:
        mon = m.group(1).lower()[:3]
        if mon in _MONTHS:
            try:
                return datetime(int(m.group(3)), _MONTHS[mon], int(m.group(2)), tzinfo=timezone.utc).date().isoformat()
            except ValueError:
                pass

    # DMY: "15 Jan 2024" or "15 January 2024"
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})", text)
    if m:
        mon = m.group(2).lower()[:3]
        if mon in _MONTHS:
            try:
                return datetime(int(m.group(3)), _MONTHS[mon], int(m.group(1)), tzinfo=timezone.utc).date().isoformat()
            except ValueError:
                pass

    # ISO: "2024-01-15"
    m = re.match(r"^(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))", text)
    if m:
        return m.group(1)

    return ""
