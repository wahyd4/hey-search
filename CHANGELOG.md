# Changelog

## 1.3.0

### Added

- **Pinterest-style masonry image layout** — images display at their natural aspect ratios using CSS columns, creating a dynamic waterfall grid instead of fixed-size squares
- **Image size filter** — filter image results by size (All, Large, Medium, Small); passed to search engines server-side (Google `tbs=isz`, Bing `qft=filterui:imagesize`, DuckDuckGo `size` param)
- Image size filter state is synced in the URL (`&image_size=large`)

## 1.2.0

### Changed

- **Google engine rewrite** — replaced Startpage proxy with direct Google scraping using SearXNG's async progressive response approach (`asearch=arc`). Parses `MjjYud` containers, extracts URLs from redirect wrappers, and handles base64 thumbnails for image search.
- **Bing engine rewrite** — added direct Bing scraping with SearXNG-style cookie handling, base64 redirect URL decoding, and CAPTCHA detection. Automatically falls back to Yahoo (Bing-powered) when Bing blocks the request.

## 1.1.0

### Added

- **Pagination** — page navigation for web and image results with URL-synced state (`?q=...&page=2`)
- **Search stats sidebar** — per-engine result counts and status indicators (green/amber/red), collapsible on mobile, sticky sidebar on desktop
- **Domain exclusion** — exclude specific websites from search results
  - SQLite-backed persistence (`backend/data/hey_search.db`)
  - REST API: `GET/POST /api/excluded-domains`, `DELETE /api/excluded-domains/{domain}`
  - Sub-domain matching (excluding `example.com` also excludes `sub.example.com`)

### Changed

- **Unified settings modal** — replaced separate Engines and Excluded Sites buttons with a single Settings button that opens a tabbed modal
- Added footer on both home and results pages with a link to the interactive API documentation (Swagger UI at `/docs`)
- URL now reflects search state (query, category, page) and supports browser back/forward

## 1.0.0 — 2026-02-23

### Added

- Initial release of Hey Search metasearch engine
- **Backend** (Python / FastAPI)
  - Async search orchestrator querying Brave, DuckDuckGo, Google, and Bing concurrently
  - Retry mechanism with exponential backoff for upstream engine failures
  - Autocomplete endpoint cascading through Google → DuckDuckGo → Brave
  - Engine management API (list, enable/disable)
  - OpenAPI spec served via Swagger UI (`/docs`) and Redoc (`/redoc`)
  - Dependency management with [uv](https://docs.astral.sh/uv/)
- **Frontend** (React + Vite + TypeScript + Tailwind CSS)
  - Mobile-first responsive search UI with shadcn theming
  - Web results page with favicons, engine badges, and content snippets
  - Image results grid with lightbox viewer
  - Live autocomplete with keyboard navigation
  - Engine settings modal with toggle switches
  - Toast notifications for upstream engine errors
- **Docker** — multi-stage Dockerfile (Node frontend build → Python runtime)
