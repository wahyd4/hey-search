"""Hey Search - A metasearch engine."""

import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.engines import registry
from app.excluded import init_db


@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    registry.load_default_engines()
    yield


app = FastAPI(
    title="Hey Search",
    description="A privacy-respecting metasearch engine",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

# Serve frontend static files if they exist (production / Docker)
static_dir = Path(__file__).resolve().parent.parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
