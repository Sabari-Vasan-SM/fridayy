# Session Summary: fridayy — Security Audit, Laravel Adapter, v1.3.0

**Repo:** `Sabari-Vasan-SM/fridayy` — an npm CLI that turns existing APIs/apps into MCP (Model Context Protocol) tool servers.
**Starting point:** `v1.2.1` on `main`.
**Result:** Two PRs merged, version bumped to `v1.3.0` on `main`. **Not yet published to npm** (registry still shows `1.2.1` — blocked on missing publish credentials, see "Outstanding" below).

---

## PR #4 — Security & portability audit fixes (`fix/security-and-portability-audit`, merged)

Preceded by a full audit (bugs / security / missing features / cross-platform readiness). Fixes applied:

### Critical security
- **Destructive-op bypass**: `src/adapters/rest/adapter.ts`'s generic `call_api_endpoint` tool was statically classified `WRITE`/`APPROVED` at generation time but accepted an arbitrary runtime `method`/`path` (including `DELETE`) — skipping the "destructive ops are BLOCKED by default" guarantee. Fixed by adding `PermissionEnforcer.validateDynamicOperation()` (`src/core/permissions/enforcer.ts`) which re-classifies against the *actual* runtime method/path; wired into `src/mcp/tools/tool-handler.ts` for any tool flagged `metadata.dynamicExecution: true`.
- **Unauthenticated SSE/HTTP transport**: `fridayy start --transport sse` had zero auth. Added optional API-key middleware to `src/mcp/server/fridayy-server.ts` (`startSse(port, host, apiKey)`), checking `Authorization: Bearer`, `x-api-key`, or `?apiKey=`. `src/cli/commands/start.ts` now refuses to bind a non-loopback host without a key unless `--allow-insecure` is passed.

### Other security hardening
- Removed a plaintext secret committed in `examples/ecommerce/fridayy.config.json`.
- `src/security/sanitizer.ts`: broadened redaction beyond "Bearer "-prefixed strings and known key names — now catches JWTs, common vendor API-key formats (Stripe/GitHub/Slack/AWS/etc.), and long hex tokens anywhere in a value.
- `src/adapters/rest/executor.ts`: stopped returning raw `err.stack` to MCP clients on network errors.
- `src/security/audit-logger.ts`: write failures now log a warning instead of failing silently.
- `src/cli/commands/config.ts`: `fridayy config` / `config get` now mask `auth.*.value` secrets instead of printing them; `config set` warns when writing a plaintext secret.
- `src/core/permissions/classifier.ts`: fixed a bug where the destructive-block reason printed the literal string `"true"` instead of the matched keyword.
- `src/cli/commands/doctor.ts`: new checks flag an unauthenticated non-loopback SSE server and plaintext secrets in config.

### "Works on any device" / portability
- New `src/config/global-dir.ts` + `src/config/credentials-store.ts`: a cross-platform global credentials store (`%APPDATA%\fridayy` / `~/Library/Application Support/fridayy` / `~/.config/fridayy`, owner-only file perms) so a secret can be set once per machine instead of duplicated per-project. New CLI: `fridayy secrets set/list/remove` (`src/cli/commands/secrets.ts`). Wired into `src/core/authentication/secret-resolver.ts` as a fallback after env vars.
- `package.json`: added `engines.node >= 18.0.0`; removed unused `undici` dependency.
- `src/cli/index.ts`: fixed a direct-execution check that compared a raw `file://` URL string to `argv` and could never match on Windows — now uses `fileURLToPath` + resolved path comparison.

### Tests
49 → 70 (new: `tests/sanitizer.test.ts`, `tests/credentials-store.test.ts`, `tests/sse-transport-auth.test.ts`, plus additions to `tests/destructive-blocking.test.ts`).

### Known follow-up (flagged, not fixed)
The SSE transport's underlying MCP `Server` instance only supports one connected transport at a time — a second concurrent SSE client throws "Already connected to a transport." Filed as a separate task, out of scope for the security PR.

---

## PR #5 — Native Laravel PHP adapter (`feat/laravel-adapter`, merged)

fridayy previously had no native way to scan PHP/Laravel routes — only OpenAPI specs or the generic REST adapter. Added:

- **`src/adapters/laravel/route-scanner.ts`**: regex/line-based scanner (same philosophy as the existing `src/adapters/nodejs/ast-scanner.ts` — not a real PHP parser) for `routes/*.php`. Handles:
  - Plain `Route::{get,post,put,patch,delete,options}('/path', ...)`
  - `Route::apiResource()` / `Route::resource()` expansion into standard REST action sets, honoring `->only([...])` / `->except([...])`
  - `Route::prefix()->group()` / `Route::middleware()->group()`, including nested groups (tracked via a brace-depth stack)
  - Laravel's convention that everything in `routes/api.php` gets an implicit `/api` prefix
  - `{id}` / `{id?}` path params, `//` and `/** */` doc comments
- **`src/adapters/laravel/adapter.ts`**: wraps the scanner into a `BaseAdapter` (same shape as `NodeJsAdapter`), reuses the existing classifier/description-builder/REST executor (a Laravel app is just HTTP from fridayy's POV). Defaults base URL to `:8000` (`php artisan serve`'s default) instead of Node's `:3000`.
- **Wired in end-to-end**: registered in `src/adapters/registry.ts`; `'laravel'` added to the `source.type` unions in `src/core/schema/types.ts` and the Zod schema in `src/core/validation/config-schema.ts`; `fridayy init --source laravel`; auto-detection in `src/core/discovery/project-scanner.ts` via `artisan` file / `laravel/framework` in `composer.json` — **prioritized over Node.js detection** even when a `package.json` is also present (common in Laravel apps, for Vite/Mix frontend tooling); `fridayy doctor` validates Laravel projects the same way it does OpenAPI/Node.js.
- Same safety guarantee as every other adapter: `DELETE` routes and `apiResource`'s `destroy` action classify `DESTRUCTIVE`/`BLOCKED` by default.

### Tests
70 → 84 (new: `tests/laravel-route-scanner.test.ts` (9), `tests/laravel-adapter.test.ts` (3), plus 2 end-to-end cases added to `tests/non-openapi-fallback.test.ts`).

---

## Direct commit to `main` — v1.3.0 release bump

- `package.json` version `1.2.1` → `1.3.0` (minor bump: new adapter + new features, semver-compatible).
- Fixed the CLI's version string being hardcoded in two more places (`src/cli/index.ts`'s `.version(...)` call, `src/cli/ui/banner.ts`'s banner text) separately from `package.json` — both now read from a new shared helper, `src/config/package-info.ts`, which resolves `package.json` at runtime relative to the compiled module location. Prevents this drift from recurring on future releases.

## Status & Release

- **Published to npm**: `fridayy@1.3.0` is live on npm registry (`dist-tags.latest: 1.3.0`).
- **Automated CI/CD**: `NPM_TOKEN` has been configured in GitHub repository secrets (`Sabari-Vasan-SM/fridayy`). Future GitHub releases (`vX.Y.Z`) will automatically build, test, sign provenance with Sigstore, and publish to npm via `.github/workflows/publish.yml`.
- **GitHub Release**: `v1.3.0` is published on GitHub with release notes.

---

## Next Up
- **Multi-client SSE support**: Eliminate single-connection limitation so multiple AI clients/agents can connect concurrently.
- **Python adapter**: Support FastAPI, Flask, and Django route discovery.
- **CLI `fridayy call` command**: Direct terminal tool invocation.
