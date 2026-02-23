"""Hey Search - A metasearch engine."""

import os
import time
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.engines import registry
from app.excluded import init_db
from app.models import APIError


@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    registry.load_default_engines()
    yield


app = FastAPI(
    title="Hey Search",
    description="A privacy-respecting metasearch engine. See endpoints below for usage with curl examples.",
    version="1.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_rate_limit_headers(request: Request, call_next):
    """Add rate-limit placeholder and timing headers."""
    start = time.monotonic()
    response = await call_next(request)
    elapsed_ms = round((time.monotonic() - start) * 1000)
    response.headers["X-Response-Time-Ms"] = str(elapsed_ms)
    # Rate-limit headers (placeholder values — no enforced limiting yet)
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

# Serve frontend static files if they exist (production / Docker)
static_dir = Path(__file__).resolve().parent.parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
