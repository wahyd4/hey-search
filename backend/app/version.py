"""Version detection — reads env vars injected at Docker build time, falls back to git for local dev."""

from __future__ import annotations

import os
import subprocess


def _git(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, stderr=subprocess.DEVNULL, cwd=os.path.dirname(__file__)).decode().strip()
    except Exception:
        return ""


def get_version_info() -> dict[str, str]:
    """Return {"version": ..., "commit": ..., "local": bool_as_str}."""
    version = os.environ.get("APP_VERSION", "")
    commit = os.environ.get("APP_COMMIT", "")

    if not version and not commit:
        # Local dev — derive from git
        version = _git(["git", "describe", "--tags", "--abbrev=0"]) or "local"
        commit = _git(["git", "rev-parse", "--short", "HEAD"]) or "unknown"
        return {"version": version, "commit": commit, "local": "true"}

    return {"version": version, "commit": commit[:7] if commit else "", "local": "false"}
