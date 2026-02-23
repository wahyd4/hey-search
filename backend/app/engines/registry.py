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

    logger.info("Loaded %d engines: %s", len(_engines), list(_engines.keys()))


def get_engine(name: str) -> "SearchEngine | None":
    return _engines.get(name)


def get_enabled_engines() -> list["SearchEngine"]:
    return [e for e in _engines.values() if _enabled.get(e.name, True)]


def get_all_engine_info() -> list[EngineInfo]:
    return [
        EngineInfo(
            name=e.name,
            display_name=e.display_name,
            enabled=_enabled.get(e.name, True),
            supports_web=e.supports_web,
            supports_images=e.supports_images,
        )
        for e in _engines.values()
    ]


def set_engine_enabled(name: str, enabled: bool) -> bool:
    if name not in _engines:
        return False
    _enabled[name] = enabled
    return True


def is_engine_enabled(name: str) -> bool:
    return _enabled.get(name, False)
