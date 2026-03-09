"""MCP (Model Context Protocol) server for HeySearch.

Exposes HeySearch as an MCP tool server so LLMs (Claude, Cursor, Continue,
VS Code Copilot, etc.) can invoke search directly via the standard MCP
JSON-RPC 2.0 protocol.

Transport: Streamable HTTP — clients POST JSON-RPC messages to /mcp.

Supported methods:
  initialize       — capability negotiation
  tools/list       — enumerate available tools
  tools/call       — invoke a tool (search, autocomplete)
  ping             — liveness check
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["MCP"])

MCP_PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "HeySearch", "version": "1.4.0"}

# ---------------------------------------------------------------------------
# Tool definitions (JSON Schema)
# ---------------------------------------------------------------------------

_SEARCH_TOOL: dict[str, Any] = {
    "name": "search",
    "description": (
        "Search the web or images using the HeySearch privacy-respecting "
        "metasearch engine. Results are aggregated from Brave, DuckDuckGo, "
        "Google, and Bing and deduplicated. Returns titles, URLs, snippets, "
        "and publication dates."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query string.",
            },
            "category": {
                "type": "string",
                "enum": ["web", "images"],
                "default": "web",
                "description": "Search category: 'web' for text results, 'images' for image results.",
            },
            "num_results": {
                "type": "integer",
                "minimum": 1,
                "maximum": 20,
                "default": 5,
                "description": "Maximum number of results to return (1–20).",
            },
            "engines": {
                "type": "string",
                "description": (
                    "Comma-separated engine names to restrict the search "
                    "(e.g. 'google,bing'). Omit to use all enabled engines."
                ),
            },
            "sort": {
                "type": "string",
                "enum": ["default", "date_asc", "date_desc"],
                "default": "default",
                "description": "Sort order: default (relevance), date_asc, or date_desc.",
            },
            "date_filter": {
                "type": "string",
                "enum": ["", "day", "week", "month", "year"],
                "default": "",
                "description": "Filter results by recency: day (24 h), week, month, or year.",
            },
        },
        "required": ["query"],
    },
}

_AUTOCOMPLETE_TOOL: dict[str, Any] = {
    "name": "autocomplete",
    "description": (
        "Get search query autocomplete suggestions from HeySearch. "
        "Useful for expanding or refining a partial query."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Partial search query to get suggestions for.",
            },
        },
        "required": ["query"],
    },
}

_ALL_TOOLS = [_SEARCH_TOOL, _AUTOCOMPLETE_TOOL]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ok(req_id: Any, result: Any) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _err(req_id: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def _tool_result(text: str, is_error: bool = False) -> dict:
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------


async def _handle_search(arguments: dict) -> str:
    from app.search import search  # local import to avoid circular deps

    query: str = arguments.get("query", "").strip()
    if not query:
        return "Error: 'query' argument is required."

    category: str = arguments.get("category", "web")
    num_results: int = min(int(arguments.get("num_results", 5)), 20)
    engines_str: str | None = arguments.get("engines")
    sort: str = arguments.get("sort", "default")
    date_filter: str = arguments.get("date_filter", "")

    engine_list = [e.strip() for e in engines_str.split(",")] if engines_str else None

    result = await search(
        query,
        category=category,
        page=1,
        engines=engine_list,
        sort=sort,
        date_filter=date_filter,
        max_results=num_results,
    )

    if not result.results:
        return f"No results found for: {query}"

    lines: list[str] = [f"Search results for: {query}\n"]
    for i, r in enumerate(result.results, 1):
        lines.append(f"{i}. {r.title}")
        lines.append(f"   URL: {r.url}")
        snippet = getattr(r, "content", "") or getattr(r, "img_src", "")
        if snippet:
            lines.append(f"   {snippet}")
        if r.published_date:
            lines.append(f"   Date: {r.published_date}")
        lines.append("")

    return "\n".join(lines)


async def _handle_autocomplete(arguments: dict) -> str:
    from app.search import get_autocomplete  # local import

    query: str = arguments.get("query", "").strip()
    if not query:
        return "Error: 'query' argument is required."

    suggestions = await get_autocomplete(query)
    if not suggestions:
        return f"No suggestions found for: {query}"

    return "Suggestions:\n" + "\n".join(f"- {s}" for s in suggestions)


# ---------------------------------------------------------------------------
# Request dispatcher
# ---------------------------------------------------------------------------


async def _dispatch(req: dict) -> dict | None:
    """Handle one JSON-RPC request object. Returns None for notifications."""
    method: str = req.get("method", "")
    req_id = req.get("id")
    params: dict = req.get("params") or {}

    # Notifications (no id) — acknowledge silently
    if req_id is None:
        return None

    if method == "initialize":
        return _ok(req_id, {
            "protocolVersion": MCP_PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": SERVER_INFO,
        })

    if method == "ping":
        return _ok(req_id, {})

    if method == "tools/list":
        cursor = params.get("cursor")  # pagination cursor (unused — all tools fit in one page)
        return _ok(req_id, {"tools": _ALL_TOOLS})

    if method == "tools/call":
        tool_name: str = params.get("name", "")
        arguments: dict = params.get("arguments") or {}

        if tool_name == "search":
            try:
                text = await _handle_search(arguments)
                return _ok(req_id, _tool_result(text))
            except Exception as exc:
                logger.exception("MCP search tool error")
                return _ok(req_id, _tool_result(f"Search failed: {exc}", is_error=True))

        if tool_name == "autocomplete":
            try:
                text = await _handle_autocomplete(arguments)
                return _ok(req_id, _tool_result(text))
            except Exception as exc:
                logger.exception("MCP autocomplete tool error")
                return _ok(req_id, _tool_result(f"Autocomplete failed: {exc}", is_error=True))

        return _err(req_id, -32601, f"Unknown tool: {tool_name}")

    return _err(req_id, -32601, f"Method not found: {method}")


# ---------------------------------------------------------------------------
# FastAPI endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/mcp",
    summary="MCP tool server",
    description="""[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) endpoint.

Exposes HeySearch as an MCP tool server. LLMs and AI coding assistants
(Claude Desktop, Cursor, Continue, VS Code Copilot, etc.) can add this
server to their MCP configuration to invoke search directly.

**Transport:** Streamable HTTP — POST JSON-RPC 2.0 messages to this endpoint.

**Available tools:** `search`, `autocomplete`

**Quick config example (Claude Desktop / `claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "heysearch": {
      "url": "$BASE_URL/api/mcp",
      "transport": "http"
    }
  }
}
```

**Manual test:**
```bash
# List available tools
curl -X POST $BASE_URL/api/mcp \\
  -H 'Content-Type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Invoke the search tool
curl -X POST $BASE_URL/api/mcp \\
  -H 'Content-Type: application/json' \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search","arguments":{"query":"python async","num_results":3}}}'
```
""",
    include_in_schema=True,
)
async def mcp_endpoint(request: Request):
    """Handle MCP JSON-RPC 2.0 requests (single or batch)."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content=_err(None, -32700, "Parse error: request body must be valid JSON"),
        )

    # Batch request
    if isinstance(body, list):
        responses = [await _dispatch(req) for req in body if isinstance(req, dict)]
        responses = [r for r in responses if r is not None]
        if not responses:
            return Response(status_code=204)
        return JSONResponse(content=responses)

    # Single request
    if not isinstance(body, dict):
        return JSONResponse(
            status_code=400,
            content=_err(None, -32600, "Invalid request: expected a JSON object or array"),
        )

    result = await _dispatch(body)
    if result is None:
        # Notification — no response body
        return Response(status_code=204)
    return JSONResponse(content=result)
