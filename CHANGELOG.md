# Changelog

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
