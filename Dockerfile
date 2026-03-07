# Stage 1: Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim AS production
WORKDIR /app

# Install uv and system deps for lxml
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2 libxslt1.1 && \
    rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/ .

# Copy frontend build output to static dir
COPY --from=frontend-build /app/frontend/dist /app/static

# Persistent data directory for SQLite DB and configuration
ENV DATA_DIR=/app/data
ENV REDIS_URL=""

# Version injected at build time via --build-arg
ARG APP_VERSION=dev
ARG APP_COMMIT=unknown
ENV APP_VERSION=${APP_VERSION}
ENV APP_COMMIT=${APP_COMMIT}
VOLUME ["/app/data"]

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
