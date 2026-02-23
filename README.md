# Hey Search

A privacy-respecting [metasearch engine](https://en.wikipedia.org/wiki/Metasearch_engine) that aggregates results from multiple search engines.

Inspired by [SearXNG](https://github.com/searxng/searxng).

## Architecture

- **Backend**: Python / FastAPI — async metasearch orchestrator with retry logic
- **Frontend**: React + Vite + TypeScript + Tailwind CSS (shadcn theming) — mobile-first UI
- **Docker**: Multi-stage build (Node frontend build → Python runtime)

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Node.js](https://nodejs.org/) >= 18
- Python >= 3.12
- [Redis](https://redis.io/) (optional — enables search result caching)

## Running Locally

### 1. Backend

```bash
cd backend
uv sync                # install dependencies
uv run uvicorn app.main:app --reload --port 8000
```

To enable Redis caching:

```bash
REDIS_URL=redis://192.168.1.2:6399 uv run uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs:

- Swagger UI: http://localhost:8000/docs
- Redoc: http://localhost:8000/redoc

### 2. Frontend

```bash
cd frontend
npm install            # install dependencies
npm run dev            # start dev server with hot reload
```

The frontend dev server runs at `http://localhost:5173` and proxies `/api` requests to the backend.

### 3. Quick start (both)

```bash
# Without Redis (caching disabled)
just dev

# With Redis
REDIS_URL=redis://192.168.1.2:6399 just dev
```

### 4. Docker (production)

```bash
docker build -t hey-search .

# Without Redis
docker run -p 8000:8000 hey-search

# With Redis
docker run -p 8000:8000 -e REDIS_URL=redis://your-redis:6379 hey-search
```

Then open http://localhost:8000.

## API Endpoints

| Method | Path                        | Description                 |
| ------ | --------------------------- | --------------------------- |
| GET    | `/api/search?q=&category=`  | Search web or images        |
| GET    | `/api/autocomplete?q=`      | Autocomplete suggestions    |
| GET    | `/api/engines`              | List all search engines     |
| PUT    | `/api/engines/{name}`       | Enable/disable an engine    |
| GET    | `/api/settings`             | Get app settings (cache TTL)|
| PUT    | `/api/settings`             | Update settings             |
| DELETE | `/api/cache`                | Flush search cache          |

## Features

See [FEATURES.md](FEATURES.md) for the full feature list.
