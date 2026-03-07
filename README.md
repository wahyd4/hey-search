# HeySearch

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

A privacy-respecting [metasearch engine](https://en.wikipedia.org/wiki/Metasearch_engine) that aggregates results from multiple search engines.

> Inspired by [SearXNG](https://github.com/searxng/searxng), built for the modern web.

## Screenshots

| Home | Web Search | Image Search |
|------|-----------|--------------|
| [![Home page](screenshots/home-page.png)](screenshots/home-page.png) | [![Web search results](screenshots/text-search.png)](screenshots/text-search.png) | [![Image search with lightbox](screenshots/image-search.png)](screenshots/image-search.png) |

## Why HeySearch over SearXNG?

Both are open-source, self-hosted, privacy-respecting metasearch engines. Here's why HeySearch is the better choice for most people:

| | HeySearch | SearXNG |
|---|---|---|
| **Setup** | `docker run -p 8000:8000 ghcr.io/…/hey-search` — one command, zero config | Requires YAML config, engine tuning, often breaks out of the box |
| **UI** | Modern, clean React UI with dark mode, background images, image lightbox | Functional but dated — not optimised for mobile or daily use |
| **AI agent friendly** | Clean JSON REST API, OpenAPI docs at `/docs`, designed to be queried programmatically | API exists but less documented; HTML-heavy responses |
| **Bookmarks** | Built-in bookmark manager for results | ❌ |
| **Search history** | Full search history with timestamps, re-run any past query in one click | ❌ |
| **Usage stats** | Built-in analytics dashboard — top queries, click-through rates, engine usage | ❌ |
| **Background gallery** | Beautiful Unsplash/Picsum backgrounds on the home page | ❌ |

**TL;DR** — If you want something you can run in 30 seconds, looks great, works well on your phone, and exposes a clean API for your AI tools, HeySearch is for you. If you need 70+ search engines and deep customisation, SearXNG has the edge.

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

### 1. Quick start

```bash
# Without Redis (caching disabled)
just dev

# With Redis
REDIS_URL=redis://192.168.1.2:6399 just dev
```

### 2. Docker (production)

```bash
docker build -t hey-search .

# Basic — data stored in anonymous volume
docker run -p 8000:8000 hey-search

# Recommended — mount data directory for persistence
docker run -p 8000:8000 -v ./hey-search-data:/app/data hey-search

# With Redis
docker run -p 8000:8000 -v ./hey-search-data:/app/data \
  -e REDIS_URL=redis://your-redis:6379 hey-search
```

The `/app/data` volume stores the SQLite database (engine settings, excluded domains, cache config). Mount it to preserve your settings across container restarts.

## API Endpoints

| Method     | Path                        | Description                 |
| ---------- | --------------------------- | --------------------------- |
| GET, POST  | `/api/search`               | Search web or images        |
| GET        | `/api/autocomplete?q=`      | Autocomplete suggestions    |
| GET        | `/api/engines`              | List all search engines     |
| PUT        | `/api/engines/{name}`       | Enable/disable an engine    |
| GET        | `/api/settings`             | Get app settings (cache TTL)|
| PUT        | `/api/settings`             | Update settings             |
| DELETE     | `/api/cache`                | Flush search cache          |

### Search endpoint parameters

| Parameter    | Default  | Description                                          |
| ------------ | -------- | ---------------------------------------------------- |
| `q`          | required | Search query string                                  |
| `category`   | `web`    | `web` or `images`                                    |
| `page`       | `1`      | Page number (1–50)                                   |
| `pageNumber` | —        | Alias for `page` (takes precedence when provided)    |
| `numResults` | —        | Requested result count hint (informational)          |
| `format`     | —        | Response format hint (e.g. `json`)                   |
| `imageProxy` | —        | Client image-proxy preference flag (informational)   |
| `safesearch` | —        | Safe search level: `0` off, `1` moderate, `2` strict |
| `engines`    | —        | Comma-separated engine names to restrict (e.g. `google,bing`) |
| `image_size` | —        | `large`, `medium`, or `small` (images only)          |
| `sort`       | `default`| `default`, `date_asc`, or `date_desc`                |

## Features

See [FEATURES.md](FEATURES.md) for the full feature list.

## License

Hey Search is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-or-later).

This project was inspired by and incorporates techniques from
[SearXNG](https://github.com/searxng/searxng) (AGPL-3.0). See [NOTICE](NOTICE)
for details on third-party attributions.

> **AGPL-3.0 in plain English:** You can use, modify, and deploy this software
> freely. If you run a modified version as a public network service, you must
> make your modified source code available to your users.
