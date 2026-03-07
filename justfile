# HeySearch — development commands

set dotenv-load := false

# List available commands
default:
    @just --list

# Install all dependencies
install:
    cd backend && uv sync
    cd frontend && npm install

# Start backend only
backend:
    cd backend && uv run uvicorn app.main:app --reload --port 8000

# Start frontend only
frontend:
    cd frontend && npm run dev

# Start both backend and frontend (Ctrl+C stops everything)
dev:
    #!/usr/bin/env bash
    set -e
    trap 'echo "Shutting down..."; kill 0; wait' INT TERM
    export REDIS_URL="${REDIS_URL:-}"
    cd backend && uv run uvicorn app.main:app --reload --port 8000 &
    cd frontend && npm run dev &
    wait

# Build frontend for production
build-frontend:
    cd frontend && npm run build

# Type-check frontend
check-frontend:
    cd frontend && npx tsc --noEmit

# Build Docker image
docker-build:
    docker build -t hey-search .

# Run Docker image
docker-run:
    docker run -p 8000:8000 hey-search

# Build and run via Docker
docker: docker-build docker-run
