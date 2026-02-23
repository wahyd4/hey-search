# Features

## Search

- **Web search** — aggregates results from Brave, DuckDuckGo, Google, and Bing concurrently
- **Image search** — Pinterest-style masonry layout respecting natural image aspect ratios, with lightbox viewer and keyboard navigation (←/→ to browse, Escape to close)
- **Image size filter** — filter images by size (Large, Medium, Small) — applied server-side across all engines
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

## Caching

- **Redis cache** — identical searches served from Redis cache to reduce upstream load and latency
- **Configurable TTL** — cache duration adjustable from 0 (disabled) to 168 hours (1 week); default 6 hours
- **UI controls** — preset buttons + slider in Settings → Cache tab, with flush button
- **Optional** — when `REDIS_URL` is not set or Redis is unreachable, caching is silently disabled
- **Deterministic keys** — cache key derived from query + category + page + image_size + engines

## UI / UX

- **Mobile-first** responsive design built with React, Tailwind CSS, and shadcn theming
- Clean search home page with branded gradient header
- Web results show favicons, engine badges, and content snippets
- Image results displayed in a masonry grid with hover previews and a full lightbox with arrow-key navigation
- **Visited link colors** — clicked links turn purple to distinguish from unvisited results
- Engine settings modal with toggle switches
- Excluded domains management modal with add/remove UI
- **Unified settings modal** — single Settings button opens a tabbed modal (Engines, Excluded Sites)
- Keyboard navigation for autocomplete suggestions (↑↓ arrows, Enter, Escape)
- Footer with link to interactive API documentation (Swagger UI)

## Accessibility

- **Skip to main content** link for keyboard users
- Image cards are real `<a>` links (Cmd/Ctrl-click, right-click, open-in-new-tab)
- `aria-label` on all icon-only buttons and interactive elements
- Search input with `<label>`, `name`, `type="search"`, and ARIA combobox pattern
- Visible `focus-visible` ring on all focusable elements
- `aria-live` regions for loading/results/error announcements
- Proper heading hierarchy (`h1`/`h2`) and landmark elements (`<nav>`, `<main>`, `<aside>`)
- Dialog semantics on modals and lightbox (`role="dialog"`, `aria-modal`)

## REST API

- Full REST API for search, autocomplete, and engine management
- Every result includes `result_id`, `rank`, `engine`, and `timestamp` for agent integration
- `has_next` and `total_results` fields for cursor-aware pagination
- Standardized error schema (`code`/`message`/`details`/`retry_hint`) on all error responses
- `X-Response-Time-Ms` and rate-limit headers on all responses
- Copy-paste `curl` examples in OpenAPI docs for every endpoint
- OpenAPI specification with interactive docs via [Swagger UI](https://swagger.io/tools/swagger-ui/) (`/docs`) and [Redoc](https://github.com/Redocly/redoc) (`/redoc`)

## Deployment

- **Docker** — multi-stage Dockerfile: Node.js frontend build → Python production image
- Backend uses [uv](https://docs.astral.sh/uv/) for fast, reproducible dependency management
