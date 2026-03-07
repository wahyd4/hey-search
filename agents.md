# Agents

This file describes the project structure and conventions for AI coding agents working on HeySearch.

## Project Overview

HeySearch is a privacy-respecting metasearch engine that aggregates results from multiple upstream search engines (Brave, DuckDuckGo, Google, Bing). It has a Python/FastAPI backend and a React/TypeScript frontend.

## Repository Structure

```
hey-search/
├── backend/                 # Python FastAPI backend
│   ├── pyproject.toml       # uv/Python dependencies
│   ├── uv.lock              # Lockfile
│   └── app/
│       ├── main.py          # FastAPI app entry point, lifespan, CORS, static mount
│       ├── models.py        # Pydantic models (WebResult, ImageResult, SearchResponse, EngineInfo, etc.)
│       ├── search.py        # Search orchestrator — concurrent engine queries, retry, dedup
│       ├── api/
│       │   └── routes.py    # REST endpoints: /search, /autocomplete, /engines
│       └── engines/
│           ├── base.py      # Abstract SearchEngine class, shared httpx AsyncClient
│           ├── registry.py  # Engine registry — load, enable/disable, list
│           ├── brave.py     # Brave Search (web + images)
│           ├── duckduckgo.py# DuckDuckGo (web + images)
│           ├── google.py    # Google (web + images)
│           └── bing.py      # Bing (web + images)
├── frontend/                # React + Vite + TypeScript frontend
│   ├── package.json
│   ├── vite.config.ts       # Vite config with Tailwind plugin and /api proxy
│   ├── index.html
│   └── src/
│       ├── main.tsx         # React entry point
│       ├── App.tsx          # Main app — home page, results page, routing between them
│       ├── index.css        # Tailwind CSS with shadcn theme variables
│       ├── lib/
│       │   ├── api.ts       # API client — search, autocomplete, engines CRUD
│       │   └── utils.ts     # cn() helper (clsx + tailwind-merge)
│       ├── hooks/
│       │   └── useAutocomplete.ts  # Debounced autocomplete hook
│       └── components/
│           ├── SearchBar.tsx       # Search input with autocomplete dropdown
│           ├── WebResults.tsx      # Web results list (favicons, badges, snippets)
│           ├── ImageResults.tsx    # Image grid + lightbox viewer
│           ├── EngineSettings.tsx  # Modal to toggle engines on/off
│           └── ErrorToast.tsx      # Toast notifications for engine failures
├── Dockerfile               # Multi-stage: Node frontend build → Python runtime
├── .dockerignore
├── .gitignore
├── README.md
├── FEATURES.md
└── CHANGELOG.md
```

## Tech Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Backend  | Python 3.12+, FastAPI, uvicorn, httpx, Pydantic |
| Retry    | tenacity (exponential backoff, 2 attempts)       |
| Parsing  | lxml, BeautifulSoup4                             |
| Frontend | React 19, TypeScript, Vite                       |
| Styling  | Tailwind CSS 4, shadcn theme, lucide-react icons |
| Packages | uv (backend), npm (frontend)                     |
| Docker   | Multi-stage (node:20-slim → python:3.12-slim)    |

## Key Conventions

### Backend

- **Dependency management**: Use `uv` (not pip). Run `uv sync` to install, `uv run` to execute.
- **Engine pattern**: Each engine extends `SearchEngine` (in `engines/base.py`) and implements `search_web()`, `search_images()`, and optionally `autocomplete()`.
- **Shared HTTP client**: All engines use `get_http_client()` from `base.py` — a single `httpx.AsyncClient` instance with sensible defaults.
- **Registry**: Engines are registered in `engines/registry.py`. Add new engines there in `load_default_engines()`.
- **Retry**: The search orchestrator in `search.py` wraps engine calls with tenacity retry (2 attempts, exponential backoff). Individual engines should raise on failure rather than swallowing errors.
- **Models**: All API request/response shapes are Pydantic models in `models.py`.
- **API docs**: FastAPI auto-generates OpenAPI spec. Swagger UI at `/docs`, Redoc at `/redoc`.

### Frontend

- **Mobile-first**: All components are designed mobile-first, then scale up with Tailwind responsive breakpoints.
- **Path aliases**: Use `@/` to import from `src/` (configured in vite.config.ts and tsconfig.app.json).
- **Styling**: Use Tailwind utility classes with `cn()` for conditional classes. Theme colors reference CSS variables from `index.css`.
- **API layer**: All backend calls go through `src/lib/api.ts`. Components never call `fetch()` directly.
- **State**: App state lives in `App.tsx` via `useState`. No external state management library.

### Adding a New Search Engine

1. Create `backend/app/engines/<name>.py` implementing `SearchEngine`
2. Register it in `backend/app/engines/registry.py` → `load_default_engines()`
3. No frontend changes needed — the engine appears automatically in the settings modal

## Running Locally

```bash
# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev

# Docker (production)
docker build -t hey-search . && docker run -p 8000:8000 hey-search
```

## API Endpoints

| Method    | Path                       | Description              |
| --------- | -------------------------- | ------------------------ |
| GET, POST | `/api/search`              | Metasearch (web/images)  |
| GET       | `/api/autocomplete`        | Search suggestions       |
| GET       | `/api/engines`             | List engines             |
| PUT       | `/api/engines/{name}`      | Toggle engine on/off     |
| GET       | `/docs`                    | Swagger UI               |
| GET       | `/redoc`                   | Redoc API docs           |

#### `/api/search` query parameters

| Parameter    | Default  | Description                                                    |
| ------------ | -------- | -------------------------------------------------------------- |
| `q`          | required | Search query string                                            |
| `category`   | `web`    | `web` or `images`                                             |
| `page`       | `1`      | Page number (1–50)                                             |
| `pageNumber` | —        | Alias for `page` (takes precedence when provided)              |
| `numResults` | —        | Requested result count hint (informational)                    |
| `format`     | —        | Response format hint (e.g. `json`)                             |
| `imageProxy` | —        | Client image-proxy preference flag (informational)             |
| `safesearch` | —        | Safe search level: `0` off, `1` moderate, `2` strict           |
| `engines`    | —        | Comma-separated engine names (e.g. `google,bing`)              |
| `image_size` | —        | `large`, `medium`, or `small` (images only)                    |
| `sort`       | `default`| `default`, `date_asc`, or `date_desc`                          |
