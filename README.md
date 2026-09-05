# fridayy

> **fridayy — Turn existing applications into AI-ready tools.**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/fridayy/fridayy)
[![MCP Compatible](https://img.shields.io/badge/MCP-Standards--Compliant-blue.svg)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 What is fridayy?

**fridayy** is a developer-focused, local-first platform that converts existing APIs and applications into **Model Context Protocol (MCP) servers and tools**.

Instead of rewriting backend code or exposing raw endpoints to AI agents without safeguards, fridayy discovers existing application interfaces, standardizes them into structured tool definitions, applies granular security and permission gates, and serves them over standard MCP transports (Stdio & SSE).

```
┌───────────────────────────────┐
│     Existing Application      │
│ (OpenAPI / REST / Node.js /   │
│          Laravel)             │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│            fridayy            │
│  • Capability Discovery       │
│  • Schema Normalization       │
│  • Permission & Risk Engine   │
│  • Developer Review Workflow  │
│  • Zero-Leak Secret Isolation │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│     Standard MCP Server       │
│      (Stdio / SSE / HTTP)     │
└───────────────┬───────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
 Claude      ChatGPT     Cursor / Gemini
```

---

## 💡 Why fridayy Exists

Connecting existing production software to LLMs presents three major challenges:

1. **Protocol Impedance**: Large language models expect clean semantic descriptions and JSON Schemas, while legacy APIs have complex query strings, URL parameters, authentication headers, and nested payloads.
2. **Security & Destructive Risk**: Directly giving an AI agent unrestricted access to write or delete endpoints (`DELETE /users/{id}`, `POST /orders/refund`) is dangerous.
3. **Developer Friction**: Manually writing MCP servers for dozens of microservices and hundreds of endpoints is tedious and prone to maintenance drift.

**fridayy solves this by introducing a human-in-the-loop, secure abstraction layer.**

---

## 🚀 Quick Start

**Requirements:** Node.js ≥ 18 (Windows, macOS, or Linux). fridayy uses no OS-specific shell commands and resolves per-project config with `path.resolve` and per-device credentials via an OS-appropriate config directory, so it behaves the same on any of the three.

### 1. Installation

Install globally via npm:

```bash
npm install -g fridayy
```

Or run directly in any project:

```bash
npx fridayy init
```

---

### 2. The 4-Step Developer Experience

```bash
# How-To & Architecture guide
fridayy use

# Step 1: Initialize Fridayy configuration in your project
fridayy init

# Step 2: Scan the workspace for APIs, OpenAPI specs, routes, and auth
fridayy scan

# Step 3: Generate candidate MCP tools
fridayy generate

# Step 4: Review and approve tools before exposing to AI
fridayy review

# Step 5: Start the standards-compliant MCP server
fridayy start
```

---

### 🔌 Supported Source Adapters

| Source | Detection | `--source` value | Notes |
|---|---|---|---|
| OpenAPI / Swagger | `openapi.yaml`, `swagger.json`, etc. found in the project | `openapi` | Works with any backend language that can export a spec |
| Node.js (Express / Fastify / Koa / NestJS / Next.js) | `package.json` + route scan | `nodejs` | Scans your JS/TS source directly, no spec needed |
| **Laravel** | `artisan` file or `laravel/framework` in `composer.json` | `laravel` | Scans `routes/*.php` directly, no spec needed — see below |
| Generic REST | Fallback when nothing else is detected | `rest` | Works with literally any HTTP backend, less granular |

#### Using fridayy with a Laravel project

Run these from your Laravel project root (where `artisan` lives):

```bash
fridayy init --source laravel --url http://localhost:8000
fridayy scan       # lists routes discovered in routes/web.php and routes/api.php
fridayy generate   # generates one tool per route
fridayy review --approve-read
fridayy start
```

The Laravel adapter reads `routes/*.php` directly — no OpenAPI spec required — and understands:
- Plain declarations: `Route::get('/users', [UserController::class, 'index'])`
- `Route::apiResource('users', UserController::class)` / `Route::resource(...)`, including `->only([...])` / `->except([...])`
- `Route::prefix('v1')->group(function () { ... })` and nested groups
- Laravel's convention that everything in `routes/api.php` is served under `/api`
- Route parameters (`{id}`, `{id?}`) mapped to tool input parameters

As with every other adapter, `DELETE` routes (and `apiResource`'s `destroy` action) are classified `DESTRUCTIVE` and `BLOCKED` until you explicitly approve them via `fridayy review`.

> This is a regex-based scanner, not a full PHP parser — it expects conventionally-formatted route files (one route or group-opener per line, as Laravel's own docs and starter kits write them). Routes built up dynamically in a loop, or registered from third-party service providers, won't be discovered; use an OpenAPI spec (e.g. via `l5-swagger`) for full coverage in those cases.

---

### 🤖 Pointing AI Assistants to Your Project

Simply point any LLM or AI agent (Cursor, Claude, ChatGPT, Gemini, Antigravity) to:
👉 **[`point/AI_INSTRUCTIONS.md`](point/AI_INSTRUCTIONS.md)**

The AI will automatically understand your architecture, discover endpoints, generate tools, configure safe permissions, and run the MCP server autonomously!

---

## 🏗️ Architecture

fridayy is built with a modular, extensible architecture designed for future pluggability:

```text
fridayy/
│
├── cli/                 # Command-line interface & interactive prompts
│   ├── commands/        # init, scan, generate, review, start, tools, config, doctor
│   └── ui/              # Rich tables, badges, ascii banners
│
├── core/                # Core domain logic
│   ├── discovery/       # Project scanner & capability detection
│   ├── tool-generator/  # Tool name sanitization & description building
│   ├── schema/          # Unified JSON Schema converter & types
│   ├── permissions/     # READ / WRITE / DESTRUCTIVE classifier & enforcer
│   ├── authentication/  # API key, Bearer, Basic auth & secret isolation
│   └── validation/      # Input validation & config schemas (Zod)
│
├── adapters/            # Pluggable source adapters
│   ├── openapi/         # OpenAPI 3.0, 3.1 & Swagger 2.0 parser & request builder
│   ├── rest/            # Generic HTTP / REST executor
│   ├── nodejs/          # Express / Fastify / Koa AST route scanner
│   ├── laravel/         # Laravel routes/*.php scanner (Route::, resource/apiResource, groups)
│   ├── manual/          # Custom user-defined tools
│   └── registry.ts      # Adapter Registry (extensible to GraphQL, SQL, etc.)
│
├── mcp/                 # Official Model Context Protocol integration
│   ├── server/          # Stdio & SSE MCP Server (@modelcontextprotocol/sdk)
│   ├── tools/           # Tool registry & execution handler
│   ├── resources/       # MCP resource providers (config, catalog, health)
│   └── prompts/         # Pre-configured guided prompt templates
│
├── config/              # Configuration & tools file manager
├── security/            # Rate limiting, audit logger, sanitizer, allowlists
└── examples/            # Working example e-commerce API & test suites
```

---

## 🛡️ Security Model

Security is a first-class citizen in fridayy. AI models are **never** granted unrestricted access by default.

### 1. Permission Classification & Risk Assessment

Every operation is automatically classified:

| Classification | Typical Operations | Default Status | Risk Level |
|---|---|---|---|
| `READ` | `GET /users`, `GET /products/{id}` | `APPROVED` | `low` |
| `WRITE` | `POST /orders`, `PUT /profile` | `PENDING` | `medium` |
| `DESTRUCTIVE` | `DELETE /users/{id}`, `POST /cache/purge` | `BLOCKED` | `high` |

> [!CAUTION]
> **Destructive operations default to `BLOCKED`.** They cannot be discovered or invoked by LLMs until the developer explicitly reviews and approves them via `fridayy review`.

### 2. Zero-Leak Secret Isolation
- Secrets and tokens are **never** embedded in tool schemas, descriptions, or LLM-visible payloads.
- Authentication tokens are resolved from, in priority order: an explicit `envKey`, standard `FRIDAYY_*` environment variables, and the global per-device credentials store:
  ```env
  FRIDAYY_API_KEY=your_api_key_here
  FRIDAYY_BEARER_TOKEN=your_bearer_token_here
  FRIDAYY_API_URL=http://localhost:4000
  ```
  Prefer environment variables (or `fridayy secrets set FRIDAYY_API_KEY <value>` to store it once per machine) over the `auth.<scheme>.value` config field — anything in `fridayy.config.json` is easy to accidentally commit to source control.
- Sensitive headers (`Authorization`, `x-api-key`, `Cookie`) and payload fields (`password`, `token`, `secret`), along with JWTs, common vendor API-key formats, and long hex tokens found anywhere in a value, are automatically redacted in audit logs and error messages — regardless of the field name they're stored under.

### 2b. Global Credentials Store (works the same on any device)
Instead of duplicating a secret in every project's `fridayy.config.json`, store it once per machine:
```bash
fridayy secrets set FRIDAYY_API_KEY sk_live_...
fridayy secrets list
fridayy secrets remove FRIDAYY_API_KEY
```
This writes to an OS-appropriate, user-scoped location (`%APPDATA%\fridayy` on Windows, `~/Library/Application Support/fridayy` on macOS, `$XDG_CONFIG_HOME/fridayy` or `~/.config/fridayy` on Linux) with owner-only file permissions. It's a convenience layer over plain JSON, not an OS keychain — for production deployments, prefer real environment variables or a secrets manager.

### 2c. Securing the SSE/HTTP Transport
`fridayy start --transport sse` has **no authentication by default**, since it's designed primarily for local, single-user use. Before exposing it beyond `localhost`, set an API key:
```bash
export FRIDAYY_SERVER_API_KEY=some-long-random-value
fridayy start --transport sse --host 0.0.0.0 --port 3000
```
Every request (except `/health`) must then present the key via `Authorization: Bearer <key>`, an `x-api-key` header, or an `?apiKey=` query parameter. Starting `sse` on a non-loopback host without a key refuses to start unless you pass `--allow-insecure` — which is not recommended.

### 3. Dynamic Schema Validation
All input arguments provided by AI agents are validated against the tool's JSON Schema (types, required fields, ranges, and enum constraints) prior to dispatching HTTP requests.

### 4. Rate Limiting & Audit Logging
- **Rate Limiting**: Sliding-window rate limiter prevents runaway agent loops from overwhelming backend services.
- **Audit Logging**: Every invocation is recorded with timestamps, tool name, sanitized inputs, duration, and HTTP status codes.

---

## 📋 CLI Reference

| Command | Description | Example |
|---|---|---|
| `fridayy init` | Initializes `fridayy.config.json` | `fridayy init --spec ./openapi.yaml` |
| `fridayy scan` | Analyzes workspace and detects endpoints/auth | `fridayy scan` |
| `fridayy generate` | Generates `fridayy.tools.json` from sources | `fridayy generate --force` |
| `fridayy review` | Review, approve, reject, or block candidate tools | `fridayy review --approve-read` |
| `fridayy start` | Boots standard MCP server (Stdio or SSE) | `fridayy start --transport sse --port 3000` |
| `fridayy tools` | Lists tool statuses and permission types | `fridayy tools --approved` |
| `fridayy config` | Displays or updates configuration | `fridayy config get source.baseUrl` |
| `fridayy secrets` | Manages the global per-device credentials store | `fridayy secrets set FRIDAYY_API_KEY <value>` |
| `fridayy doctor` | Runs diagnostics on config, secrets, and API | `fridayy doctor` |

---

## ⚙️ Configuration Files

### `fridayy.config.json`

```json
{
  "name": "my-ecommerce-app",
  "version": "1.0.0",
  "source": {
    "type": "openapi",
    "path": "./openapi.yaml",
    "baseUrl": "https://api.example.com"
  },
  "server": {
    "name": "ecommerce-mcp",
    "transport": "stdio"
  },
  "security": {
    "requireApprovalForDestructive": true,
    "autoApproveRead": true,
    "autoApproveWrite": false,
    "allowlist": ["*"]
  },
  "auth": {
    "ApiKeyAuth": {
      "type": "apiKey",
      "headerName": "x-api-key",
      "envKey": "FRIDAYY_API_KEY"
    }
  }
}
```

---

## 🤖 Connecting to MCP Clients

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fridayy-api": {
      "command": "npx",
      "args": ["fridayy", "start"],
      "env": {
        "FRIDAYY_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor IDE

In Cursor Settings → Features → MCP:
- **Type**: `command`
- **Command**: `npx fridayy start`

---

## 🧪 Testing

Run the comprehensive test suite (12 suites, 41 unit & integration tests):

```bash
npm test
```

Run the live E-Commerce end-to-end client demo:

```bash
npm run example:demo
```

---

## 🗺️ Roadmap

- [x] OpenAPI 3.0, 3.1 & Swagger 2.0 support
- [x] Node.js / Express / Fastify route discovery
- [x] Laravel PHP route discovery (`routes/*.php`, resource/apiResource, groups)
- [x] Stdio & SSE Transport support
- [x] Granular permission classifier & destructive blocking
- [x] Zero-leak secret isolation
- [x] Interactive CLI review workflow
- [ ] GraphQL Adapter
- [ ] PostgreSQL / MySQL / MongoDB direct query adapters
- [ ] Python / FastAPI / Django route scanner
- [ ] Webhook trigger tools

---

## 📄 License

MIT © fridayy
