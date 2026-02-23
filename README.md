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

## Running Locally

### 1. Backend

```bash
cd backend
uv sync                # install dependencies
uv run uvicorn app.main:app --reload --port 8000
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

### 3. Docker (production)

```bash
docker build -t hey-search .
docker run -p 8000:8000 hey-search
```

Then open http://localhost:8000.

## API Endpoints

| Method | Path                        | Description                 |
| ------ | --------------------------- | --------------------------- |
| GET    | `/api/search?q=&category=`  | Search web or images        |
| GET    | `/api/autocomplete?q=`      | Autocomplete suggestions    |
| GET    | `/api/engines`              | List all search engines     |
| PUT    | `/api/engines/{name}`       | Enable/disable an engine    |

## Features

See [FEATURES.md](FEATURES.md) for the full feature list.
