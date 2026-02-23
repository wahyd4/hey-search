# Changelog

## 1.4.0

### Added

- **Accessibility overhaul (P0)**
  - Image result cards are now real `<a>` links — supports open-in-new-tab, Cmd/Ctrl-click, and copy-link
  - `aria-label` on all icon-only buttons (settings, clear, close, lightbox nav, engine toggles, domain remove, pagination arrows, error dismiss)
  - Search input has proper semantics: `<label>`, `name="q"`, `type="search"`, `role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-activedescendant`
  - Autocomplete list uses `role="listbox"` and `role="option"` with `aria-selected`
  - Visible keyboard focus (`focus-visible:ring-2`) on all interactive elements; removed bare `outline-none`
- **Page structure (P1)**
  - "Skip to main content" link for keyboard users
  - Proper heading hierarchy (`h1` on home, `h2` for results/no-results, `sr-only` screen-reader headings)
  - `<nav>` landmarks for category tabs and pagination, `<aside>` for stats sidebar
- **Live announcements (P1)**
  - `aria-live="polite"` region announces loading state and result counts to screen readers
  - `aria-live="assertive"` on error toast for immediate announcement
  - Loading spinner has `role="status"` with `sr-only` text
- **Custom favicon** — search magnifying glass SVG replaces default Vite favicon (eliminates 404 console errors)
- **Agent-friendly API response (P2)**
  - Every result now includes `result_id` (stable unique ID), `rank` (position in result list), and `engine`
  - `SearchResponse` includes `timestamp` (ISO 8601), `total_results`, and `has_next` for cursor-based pagination
  - `EngineError` includes `code`, `details`, and `retry_hint` fields
  - New `APIError` standard error model (`code`/`message`/`details`/`retry_hint`) used on all error responses
  - Standardized 404 errors on engine and domain endpoints with consistent JSON schema
- **API documentation (P2)**
  - All API endpoints include copy-paste `curl` examples and sample JSON responses in OpenAPI descriptions
  - API version bumped to 1.4.0 with descriptive title
- **Rate-limit headers (P2)**
  - `X-Response-Time-Ms` and `X-RateLimit-Limit`/`X-RateLimit-Remaining` headers on all responses
  - Global exception handler returns standardized `APIError` JSON for unhandled errors
- **URL state (P2)**
  - `engines` parameter supported in URL for reproducible sessions (`?q=hello&engines=google,bing`)
- Settings modal, lightbox, and category tabs all have `role="dialog"`, `aria-modal`, `aria-expanded`, `aria-pressed`, and `aria-current` where appropriate

## 1.3.0

### Added

- **Pinterest-style masonry image layout** — images display at their natural aspect ratios using CSS columns, creating a dynamic waterfall grid instead of fixed-size squares
- **Image size filter** — filter image results by size (All, Large, Medium, Small); passed to search engines server-side (Google `tbs=isz`, Bing `qft=filterui:imagesize`, DuckDuckGo `size` param)
- Image size filter state is synced in the URL (`&image_size=large`)
- **Lightbox navigation** — left/right arrow buttons and keyboard arrow keys to browse images; Escape to close; position counter (e.g. "3 / 70")
- **Visited link styling** — clicked web result links turn purple to distinguish from unvisited links

### Fixed

- Settings modal now properly constrained to viewport on mobile (`max-h-[90vh]`) with scrollable content area and pinned footer
- Search stats section defaults to collapsed on mobile to save screen space

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
