# Features

## Search

- **Web search** — aggregates results from Brave, DuckDuckGo, Google, and Bing concurrently
- **Image search** — image results with a responsive grid layout and lightbox viewer
- **Autocomplete** — live search suggestions as you type (cascades Google → DuckDuckGo → Brave)
- **Pagination** — navigate through result pages; URL reflects current state (`?q=...&page=2`)
- **URL deduplication** — duplicate results from multiple engines are merged automatically
- **Domain exclusion** — exclude specific websites from search results; settings persist in SQLite
- **Search stats** — per-engine result counts, status indicators (ok/error/timeout), collapsible sidebar

## Search Engines

- **Google** — direct scraping via SearXNG's async progressive response API (`asearch=arc`); CAPTCHA detection
- **Bing** — direct scraping with SearXNG-style cookies and base64 URL decoding; automatic Yahoo fallback on CAPTCHA
- **DuckDuckGo** — HTML Lite scraping for web, API for images
- **Brave** — Brave Search API for web and images

## REST API

- Full REST API for search, autocomplete, and engine management
- OpenAPI specification with interactive docs via [Swagger UI](https://swagger.io/tools/swagger-ui/) (`/docs`) and [Redoc](https://github.com/Redocly/redoc) (`/redoc`)

## Engine Management

- **4 built-in engines**: Brave, DuckDuckGo, Google, Bing
- Enable or disable engines via the UI or API at runtime
- Each engine supports both web and image search categories
- Google and Bing include automatic fallback mechanisms for resilience

## Reliability

- **Retry mechanism** — failed upstream requests are retried with exponential backoff (via [tenacity](https://github.com/jd/tenacity))
- **Error reporting** — when an upstream engine fails or times out, the UI shows a toast notification identifying which engine had issues
- **Graceful degradation** — partial failures don't block results from other engines

## UI / UX

- **Mobile-first** responsive design built with React, Tailwind CSS, and shadcn theming
- Clean search home page with branded gradient header
- Web results show favicons, engine badges, and content snippets
- Image results displayed in a responsive grid with hover previews and a full lightbox
- Engine settings modal with toggle switches
- Excluded domains management modal with add/remove UI
- **Unified settings modal** — single Settings button opens a tabbed modal (Engines, Excluded Sites)
- Keyboard navigation for autocomplete suggestions (↑↓ arrows, Enter, Escape)
- Footer with link to interactive API documentation (Swagger UI)

## Deployment

- **Docker** — multi-stage Dockerfile: Node.js frontend build → Python production image
- Backend uses [uv](https://docs.astral.sh/uv/) for fast, reproducible dependency management
