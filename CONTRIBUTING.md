# Contributing to Hey Search

Contributions are welcome! Keep it simple — open an issue or a PR.

By contributing, you agree your changes will be licensed under [AGPL-3.0](LICENSE).

## Running Locally

```bash
# Backend
cd backend && uv sync
uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

## Adding a Search Engine

1. Create `backend/app/engines/<name>.py` implementing `SearchEngine`
2. Register it in `backend/app/engines/registry.py` → `load_default_engines()`

## Notes

- If you borrow scraping techniques from another open-source project, add an inline comment and an entry to `NOTICE`
- Update `CHANGELOG.md` if your change is user-facing
