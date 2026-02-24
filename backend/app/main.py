"""Hey Search - A metasearch engine."""

import json
import os
import time
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.engines import registry
from app.excluded import init_db
from app.settings import init_settings_table
from app.cache import init_redis, close_redis
from app.bookmarks import init_bookmarks_table
from app.stats import init_db as init_stats_db
from app.models import APIError


@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    init_settings_table()
    init_bookmarks_table()
    init_stats_db()
    registry.load_default_engines()
    await init_redis()
    yield
    await close_redis()


app = FastAPI(
    title="Hey Search",
    description="A privacy-respecting metasearch engine. See endpoints below for usage with curl examples.",
    version="1.4.0",
    lifespan=lifespan,
    # Disable the default /openapi.json — we serve a dynamic one below
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Cache the base schema (without servers) so we only compute it once
_openapi_schema_cache: dict | None = None


def _get_base_openapi_schema() -> dict:
    """Generate the OpenAPI schema once and cache it."""
    global _openapi_schema_cache
    if _openapi_schema_cache is None:
        _openapi_schema_cache = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
    return _openapi_schema_cache


@app.get("/openapi.json", include_in_schema=False)
async def dynamic_openapi(request: Request):
    """Serve OpenAPI schema with servers[] matching the caller's origin."""
    base = _get_base_openapi_schema()

    # Derive the base URL from the request
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost")
    base_url = f"{proto}://{host}"

    # Deep-replace $BASE_URL in all description strings and set servers
    raw = json.dumps(base)
    raw = raw.replace("$BASE_URL", base_url)
    schema = json.loads(raw)

    schema["servers"] = [{"url": base_url, "description": "Current server"}]
    return schema


# Wire Swagger UI and Redoc to our dynamic endpoint
app.openapi_url = "/openapi.json"
app.setup()


@app.middleware("http")
async def add_rate_limit_headers(request: Request, call_next):
    """Add rate-limit placeholder and timing headers."""
    start = time.monotonic()
    response = await call_next(request)
    elapsed_ms = round((time.monotonic() - start) * 1000)
    response.headers["X-Response-Time-Ms"] = str(elapsed_ms)
    response.headers["X-RateLimit-Limit"] = "60"
    response.headers["X-RateLimit-Remaining"] = "59"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Return standardized JSON errors."""
    return JSONResponse(
        status_code=500,
        content=APIError(
            code="internal_error",
            message="An unexpected error occurred",
            details=str(exc),
            retry_hint="Try again later",
        ).model_dump(),
    )


app.include_router(router, prefix="/api")

# Alias /search → /api/search for compatibility with external clients
@app.api_route("/search", methods=["GET", "POST"], include_in_schema=False)
async def search_root_alias(request: Request):
    url = request.url.replace(path="/api/search")
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=str(url), status_code=307)

# Serve frontend static files if they exist (production / Docker)
static_dir = Path(__file__).resolve().parent.parent / "static"
if static_dir.is_dir():
    from fastapi.responses import FileResponse as _FileResponse

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # Serve the actual file if it exists (assets, favicon, etc.)
        candidate = (static_dir / full_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(static_dir):
            return _FileResponse(str(candidate))
        # Fall back to index.html for all SPA routes
        return _FileResponse(str(static_dir / "index.html"))
