# Features

## Search

- **Web search** — aggregates results from Brave, DuckDuckGo, Google, and Bing concurrently
- **Image search** — masonry grid respecting natural aspect ratios, with lightbox viewer and keyboard navigation (←/→ to browse, Escape to close)
- **Image size filter** — filter images by size (Large, Medium, Small) applied server-side across all engines
- **Sort order** — sort results by engine rank (default), newest first, or oldest first
- **Autocomplete** — live search suggestions as you type (200ms debounce, ↑↓/Enter/Escape keyboard support)
- **Pagination** — navigate through result pages; URL reflects current state (`?q=...&page=2`)
- **URL deduplication** — duplicate results from multiple engines are merged automatically
- **Domain exclusion** — exclude specific websites from all search results; settings persist in SQLite
- **Engine filter** — restrict a search to specific engines via the `engines` query parameter (e.g. `engines=google,bing`)
- **Per-engine stats** — result counts, status (ok / error / timeout), and error messages per engine shown in a collapsible bar

## Search Engines

- **Google** — direct scraping via SearXNG's async progressive response API (`asearch=arc`); CAPTCHA detection
- **Bing** — direct scraping with SearXNG-style cookies and base64 URL decoding; automatic Yahoo fallback on CAPTCHA
- **DuckDuckGo** — HTML Lite scraping for web, API for images
- **Brave** — Brave Search API for web and images

## Engine Management

- **4 built-in engines**: Brave, DuckDuckGo, Google, Bing
- Enable or disable engines via the UI or API at runtime; settings persist in SQLite
- **Drag-and-drop reordering** — set engine priority order; affects result ordering and display badges
- Each engine supports both web and image search categories
- Google and Bing include automatic fallback mechanisms for resilience

## Search History

- **Automatic recording** — every search query is saved with timestamp and category
- **History page** (`/history`) — paginated, date-grouped list of recent searches (Today, Yesterday, etc.)
- **Re-run any query** — click a history entry to instantly re-search it
- **Delete entries** — remove individual entries or clear all history at once

## Analytics Dashboard

- **Stats page** (`/stats`) — full analytics dashboard with configurable time range (7 / 30 / 90 days)
- **KPI cards** — total searches, total clicks, click-through rate, average clicked result position
- **Daily trend chart** — bar chart of search volume per day
- **Top queries** — ranked list of most-searched terms with counts
- **Clicks by engine** — bar chart showing which engines' results get clicked most
- **Click position distribution** — histogram of which result ranks users click on
- **Top clicked results** — ranked list of most-clicked URLs with title, engine, and count
- **Click tracking** — every result click is recorded server-side (fire-and-forget from the frontend)

## Caching

- **Redis cache** — identical searches served from Redis to reduce upstream load and latency
- **Configurable TTL** — cache duration adjustable from 0 (disabled) to 168 hours (1 week); default 6 hours
- **Cache status** — search response includes a `cached` flag; the stats bar indicates cache hits
- **UI controls** — TTL slider + preset buttons, Redis URL input, and flush button in Settings → Cache tab
- **Optional** — when `REDIS_URL` is not set or Redis is unreachable, caching is silently disabled
- **Deterministic keys** — cache key derived from query + category + page + image_size + engines

## Bookmarks

- **Bookmark any result** — click the bookmark icon on web or image results to save them
- **Bookmarks page** (`/bookmarks`) — dedicated page to browse all saved items
- **Filter by type** — tabs to filter All / Web / Images
- **Masonry image grid** — saved images displayed in a masonry layout with hover overlays
- **Remove bookmarks** — delete individual bookmarks from the bookmarks page
- **Persistent storage** — bookmarks stored in SQLite alongside other app data

## Background Images

- **Homepage backgrounds** — random background image displayed on the home page (sourced from Unsplash / Picsum)
- **Local caching** — images are downloaded and stored in `data/backgrounds/` to avoid re-fetching
- **Auto-refresh** — configurable refresh interval (1–1440 minutes, default 30) fetches new images automatically
- **Background gallery** (`/backgrounds`) — browse and manage all downloaded backgrounds; click to preview, view file size and source
- **Manual refresh** — refresh button in the gallery to fetch a new image immediately
- **Enable / disable** — toggle backgrounds on or off in Settings → Background tab
- **iOS color sampling** — samples edge pixels from the background to set the `theme-color` meta tag, preventing white/black bars in Safari

## Settings

- **Unified settings modal** — single ⚙ button opens a tabbed modal with four tabs:
  1. **Engines** — enable/disable and drag-to-reorder search engines
  2. **Excluded Sites** — add or remove domains from the search blocklist
  3. **Cache** — view Redis status, set TTL, update Redis URL, flush cache
  4. **Background** — enable/disable background images, set refresh interval

## REST API

- Full REST API for search, autocomplete, engine management, bookmarks, history, stats, and settings
- `/api/search` accepts both **GET and POST** requests with query string parameters
- **`format=llm`** — minimal LLM-optimised response: only `query`, `results` (title, url, snippet, date), and `total_results`; no engine noise
- **`max_results`** — hard limit on returned results (1–100); `numResults` is a supported alias
- Compatibility parameters: `pageNumber` (alias for `page`), `numResults`, `format`, `imageProxy`, `safesearch`
- Every result includes `result_id`, `rank`, `engine`, and `published_date`
- `has_next` and `total_results` fields for cursor-aware pagination
- `X-Response-Time-Ms` response header on all endpoints
- OpenAPI specification with interactive docs via [Swagger UI](https://swagger.io/tools/swagger-ui/) (`/docs`) and [Redoc](https://github.com/Redocly/redoc) (`/redoc`)

## MCP Tool Server

- **`/api/mcp`** — [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) endpoint; exposes HeySearch as a native tool for LLMs
- Compatible with Claude Desktop, Cursor, Continue, VS Code Copilot, and any MCP-capable client
- **Transport**: Streamable HTTP (JSON-RPC 2.0 POST)
- **Available tools**: `search` (web + image search) and `autocomplete`
- `search` tool supports `query`, `category`, `num_results` (1–20), `engines`, `sort`, and `date_filter` arguments
- Add to Claude Desktop by pointing `url` at `http://your-host/api/mcp` with `"transport": "http"`

## Reliability

- **Retry mechanism** — failed upstream requests are retried with exponential backoff (via [tenacity](https://github.com/jd/tenacity), 2 attempts)
- **Error reporting** — when an upstream engine fails or times out, the UI shows a toast notification identifying which engine had issues
- **Graceful degradation** — partial failures don't block results from other engines

## UI / UX

- **Mobile-first** responsive design built with React, Tailwind CSS, and shadcn theming
- Web results show favicons, engine badges, publish dates, and content snippets
- Image results in a masonry grid with hover previews and a full-screen lightbox
- **Visited link colours** — clicked links turn purple to distinguish from unvisited results
- **Dropdown navigation menu** — consistent ☰ menu across all pages (search, bookmarks, history, stats, gallery)
- Keyboard navigation for autocomplete suggestions (↑↓ arrows, Enter, Escape)
- URL-based routing with browser history support — shareable search URLs

## Accessibility

- **Skip to main content** link for keyboard users
- Image cards are real `<a>` links (Cmd/Ctrl-click, right-click, open-in-new-tab all work)
- `aria-label` on all icon-only buttons and interactive elements
- Search input with `<label>`, `name`, `type="search"`, and ARIA combobox pattern
- Visible `focus-visible` ring on all focusable elements
- `aria-live` regions for loading / results / error announcements
- Proper heading hierarchy (`h1`/`h2`) and landmark elements (`<nav>`, `<main>`, `<aside>`)
- Dialog semantics on modals and lightbox (`role="dialog"`, `aria-modal`)

## Deployment

- **Docker** — multi-stage Dockerfile: Node.js frontend build → Python production image
- **GHCR image** — pre-built image published to GitHub Container Registry on every release
- **Data volume** — `/app/data` stores SQLite databases and background images; mount for persistence
- **Environment variables** — `DATA_DIR` (data directory path), `REDIS_URL` (optional Redis connection string)
- Backend uses [uv](https://docs.astral.sh/uv/) for fast, reproducible Python dependency management

