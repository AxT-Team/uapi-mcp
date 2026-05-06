# AGENTS.md — uapi-mcp

This file tells AI coding agents (Codex, Claude Code, Cursor, OpenCode, Gemini,
etc.) what this repository is and how to wire up the **UAPI MCP server**.

## What this repo is

The official MCP (Model Context Protocol) server for the public API platform
[uapis.cn](https://uapis.cn). It exposes **100+ UAPI endpoints** — network
lookups, text utilities, image processing, social-platform queries,
translation, search, weather, time, OCR — as MCP tools that any MCP-aware
AI agent can call directly.

## Hosted server (recommended)

A managed Streamable-HTTP MCP server is already running. Most agents only
need this one URL:

```
https://uapis.cn/mcp
```

Discovery shortcuts:

- Server card: <https://uapis.cn/.well-known/mcp/server-card.json>
- WebMCP descriptor: <https://uapis.cn/.well-known/webmcp>
- Agent card: <https://uapis.cn/.well-known/agent-card.json>

Wiring it into common agents:

```jsonc
// Claude Desktop / Claude Code (claude_desktop_config.json)
{
  "mcpServers": {
    "uapi": {
      "transport": "streamable-http",
      "url": "https://uapis.cn/mcp"
    }
  }
}
```

```jsonc
// Cursor (.cursor/mcp.json)
{
  "mcpServers": {
    "uapi": {
      "url": "https://uapis.cn/mcp"
    }
  }
}
```

For paid endpoints, set the UAPI key once via the `X-API-Key` header
(MCP servers may forward `mcpAuth.bearer` to this header — see the
server card for details).

## Local install (npm)

The same server is published on npm and runs over stdio for local agents:

```bash
# Run directly (no install)
npx -y uapi-mcp start --mode dynamic

# Or install globally
npm i -g uapi-mcp
uapi-mcp start --mode dynamic
```

Stdio config example:

```jsonc
{
  "mcpServers": {
    "uapi": {
      "command": "npx",
      "args": ["-y", "uapi-mcp", "start", "--mode", "dynamic"]
    }
  }
}
```

## Build from source

```bash
git clone https://github.com/AxT-Team/uapi-mcp
cd uapi-mcp
npm install
npm run build
node ./bin/mcp-server.js start --mode dynamic
```

## Available tools

The server exposes one MCP tool per UAPI operation. Operation IDs and
schemas come straight from the OpenAPI document at
<https://uapis.cn/openapi.json>, so the tool list mirrors the REST API
1-to-1. Examples:

- `get_misc_weather` — current weather + forecast for a city
- `get_network_whois` — WHOIS lookup
- `get_text_md5` / `post_text_md5_verify` — MD5 hashing & verification
- `post_image_compress` — image compression
- `post_translate_text` — text translation

Run `npx uapi-mcp tools list` (or the equivalent MCP `tools/list` call)
to see the full list at runtime.

## Authentication

- Free-tier endpoints work with no auth.
- Paid endpoints need an `X-API-Key`. Get one at
  <https://uapis.cn/console>.
- For OAuth-style flows, see
  <https://uapis.cn/.well-known/oauth-authorization-server>.

## Rate limits

UAPI returns standard rate-limit headers
(`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`). The MCP
server forwards them on tool errors so the agent can back off properly.

## Related repos

- Skills bundle: <https://github.com/AxT-Team/uapi-agent-skills>
- Browser SDK: <https://github.com/AxT-Team/uapi-browser-sdk>
- TypeScript SDK: <https://github.com/AxT-Team/uapi-sdk-typescript>
- Python SDK: <https://github.com/AxT-Team/uapi-sdk-python>
- CLI: <https://github.com/AxT-Team/uapi-cli>
