# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Junwei Zhao
"""Engine registry - manages available search engines."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.models import EngineInfo

if TYPE_CHECKING:
    from app.engines.base import SearchEngine

logger = logging.getLogger(__name__)

_engines: dict[str, "SearchEngine"] = {}
_enabled: dict[str, bool] = {}
_order: list[str] = []  # engine names in priority order


def load_default_engines() -> None:
    """Register all built-in engines."""
    from app.engines.brave import BraveEngine
    from app.engines.duckduckgo import DuckDuckGoEngine
    from app.engines.google import GoogleEngine
    from app.engines.bing import BingEngine

    for engine_cls in [BraveEngine, DuckDuckGoEngine, GoogleEngine, BingEngine]:
        engine = engine_cls()
        _engines[engine.name] = engine
        _enabled[engine.name] = True

    # Default priority: privacy-first (Brave → DuckDuckGo → Google → Bing)
    _order.extend(_engines.keys())

    logger.info("Loaded %d engines: %s", len(_engines), list(_engines.keys()))


def get_engine(name: str) -> "SearchEngine | None":
    return _engines.get(name)


def get_engine_order() -> list[str]:
    """Return engine names in current priority order."""
    return list(_order)


def set_engine_order(order: list[str]) -> None:
    """Set engine priority order. Unknown names are ignored; missing engines appended at end."""
    known = set(_engines.keys())
    new_order = [name for name in order if name in known]
    for name in _order:
        if name not in new_order:
            new_order.append(name)
    _order[:] = new_order


def get_enabled_engines() -> list["SearchEngine"]:
    """Return enabled engines in configured priority order."""
    return [_engines[name] for name in _order if name in _engines and _enabled.get(name, True)]


def get_all_engine_info() -> list[EngineInfo]:
    return [
        EngineInfo(
            name=e.name,
            display_name=e.display_name,
            enabled=_enabled.get(e.name, True),
            supports_web=e.supports_web,
            supports_images=e.supports_images,
            order=i,
        )
        for i, name in enumerate(_order)
        if (e := _engines.get(name))
    ]


def set_engine_enabled(name: str, enabled: bool) -> bool:
    if name not in _engines:
        return False
    _enabled[name] = enabled
    return True


def is_engine_enabled(name: str) -> bool:
    return _enabled.get(name, False)
