# Fridayy Landing Page & Website Master Content Spec

> **Instructions for Lovable / v0 / Web Builders**:
> Use this comprehensive specification to generate a modern, high-converting, cyberpunk-styled developer landing page and web platform for **Fridayy**.
> Include interactive elements: interactive terminal simulator, "With vs. Without Fridayy" toggle comparison, Bento grid feature layout, client config generators, interactive CLI workflow stepper, creator profile, sponsorship/donation modal, and FAQ accordion.

---

## 🎨 1. Design System & Visual Identity

* **Theme**: Dark Mode First, Cyberpunk & Obsidian Aesthetic.
* **Color Palette**:
  * **Background Deep**: `#08090d` (Obsidian Jet)
  * **Card / Surface Background**: `#10131c` with subtle glassmorphism (`backdrop-blur-md`, border `rgba(255,255,255,0.08)`)
  * **Primary Accent (Cyan)**: `#00d2ff` / `#00b4d8`
  * **Secondary Accent (Purple/Magenta)**: `#7209b7` / `#b5179e`
  * **Success / Safe Accent (Emerald)**: `#00f5d4` / `#52b788`
  * **Warning Accent (Amber)**: `#ffb703`
  * **Destructive / Danger Accent (Neon Coral)**: `#ff0054`
  * **Typography**:
    * **Headings**: `Outfit` or `Plus Jakarta Sans` (Bold, Modern)
    * **Body**: `Inter` (Crisp, High Legibility)
    * **Code & Terminal**: `JetBrains Mono` or `Fira Code`

---

## 🌐 2. Navigation Bar (Header)

* **Logo**: `⚡ FRIDAYY` (Cyan-Purple gradient text with glowing dot indicator)
* **Status Badge**: `[ v1.2.0 ] • [ MCP 1.6+ Standard ]`
* **Nav Links**:
  * Features
  * How It Works
  * With vs. Without
  * AI Quick-Point
  * Docs
  * Creator
* **Action Buttons**:
  * `GitHub ★ Star` (Link to: `https://github.com/Sabari-Vasan-SM/fridayy`)
  * `npm Package` (Link to: `https://www.npmjs.com/package/fridayy`)
  * `❤️ Donate / Sponsor` (Smooth scroll to donation section)

---

## 🚀 3. Hero Section

### Headline:
# Turn Any Application Into AI-Ready MCP Tools In Minutes.

### Subheadline:
> The local-first, zero-rewrite bridge connecting existing REST APIs, OpenAPI specifications, and Node.js backends directly to **Claude, Cursor, ChatGPT, and Gemini**.

### Primary Call-to-Actions (CTAs):
1. **Copyable Terminal Command Box**:
   ```bash
   npx fridayy init
   ```
   *(With one-click copy button and toast notification "Copied to clipboard!")*
2. **Secondary Button**: `Explore Documentation ➔`
3. **Tertiary Button**: `View on GitHub (MIT License)`

### Hero Visual: Interactive Live Cyberpunk Terminal Simulator
Simulate the real animated terminal output of Fridayy:

```text
  ███████╗██████╗ ██╗██████╗  █████╗ ██╗   ██╗██╗   ██╗
  ██╔════╝██╔══██╗██║██╔══██╗██╔══██╗╚██╗ ██╔╝╚██╗ ██╔╝
  █████╗  ██████╔╝██║██║  ██║███████║ ╚████╔╝  ╚████╔╝ 
  ██╔══╝  ██╔══██╗██║██║  ██║██╔══██║  ╚██╔╝    ╚██╔╝  
  ██║     ██║  ██║██║██████╔╝██║  ██║   ██║      ██║   
  ╚═╝     ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝  ╚═╝   ╚═╝      ╚═╝   
                             sabarivasan
   Universal Application-to-MCP Platform – Turn existing APIs into AI tools
          v1.2.0    MCP Standard   •  ⚡ Developed with ❤️ by Sabarivasan
                 Repository: https://github.com/Sabari-Vasan-SM/fridayy

> Starting Fridayy

  ✔ Pulling project context...
  ✔ Initialising MCP runtime...
  ✔ Turning existing APIs into tools...
  ✔ Orchestrating AI capabilities...
  ✔ Connecting MCP interface...

✔ DONE Fridayy is ready.

  MCP Server     ● Ready
  AI Tools       ● Connected
  Runtime        ● Active

  friday - build once. connect everywhere.
  Developed by sabarivasan
```

### Social Proof / Ecosystem Pill Badges:
* ⚡ **100% Standards Compliant with Model Context Protocol**
* 🔒 **Zero-Trust Destructive Action Shield**
* 🛡️ **Zero Secret Leakage Guaranteed**
* 📦 **Local-First & Open Source (MIT)**

---

## ⚖️ 4. The Problem & Solution: "With Fridayy vs. Without Fridayy"

| Feature & Challenge | ❌ Without Fridayy | ✅ With Fridayy |
|---|---|---|
| **Development Time** | 2–4 weeks spent writing custom JSON-RPC MCP wrappers for every endpoint. | **< 60 seconds.** Automatic discovery generates standard tools instantly. |
| **Codebase Impact** | Requires invasive refactoring and new server code inside your application. | **Zero code rewriting.** Reads OpenAPI specs or existing routes non-invasively. |
| **Destructive Security** | Models can accidentally invoke `DELETE /users` or `POST /refunds` without approval. | **3-Tier Risk Engine.** Destructive endpoints default to `BLOCKED` until human review. |
| **Secret Management** | High risk of leaking API tokens & DB credentials in LLM context windows. | **Zero-Leak Isolation.** Secrets load exclusively via runtime `FRIDAYY_*` env variables. |
| **Schema Compatibility** | Manual translation of query params, body schemas, headers, and paths. | **Automated Normalization.** Translates everything into strict JSON Schema Draft-7. |
| **AI Autonomous Setup** | AI agents struggle to comprehend backend routes without extensive prompting. | **Point-and-Play (`point/`).** Point AI to `point/AI_INSTRUCTIONS.md` for auto-setup. |

---

## ⚙️ 5. How It Works (Under the Hood)

Visual 5-stage pipeline diagram:

```text
┌────────────────────────┐
│ 1. Capability Discovery│ Scans OpenAPI 3.0/3.1, Swagger 2.0 & Express/Fastify routes
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ 2. Schema Normalizer   │ Merges path, query, headers & request bodies into JSON Schema
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ 3. Zero-Trust Security │ Categorizes operations into READ, WRITE, and DESTRUCTIVE
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ 4. Human-in-the-Loop   │ Developer reviews & approves candidate tools via CLI
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ 5. Official MCP Server │ Serves active tools via Stdio & SSE to Claude, Cursor & Gemini
└────────────────────────┘
```

---

## 💎 6. Key Features (Bento Grid Layout)

### Card 1: 🔍 Automated Capability Discovery
Scans OpenAPI specs (`openapi.yaml`, `swagger.json`) or parses AST route trees in Express, Fastify, and Koa projects to find every endpoint automatically.

### Card 2: 🛡️ 3-Tier Zero-Trust Risk Engine
Every detected tool is automatically classified:
* **READ (Safe - Green)**: `GET /products`, `GET /users` — Pre-approved for instant AI access.
* **WRITE (Mutating - Amber)**: `POST /orders`, `PUT /profile` — Pending developer check.
* **DESTRUCTIVE (Dangerous - Red)**: `DELETE /account`, `POST /purge` — Blocked by default. Requires explicit human sign-off.

### Card 3: 🔒 Zero-Leak Secret Isolation
Never put API keys or Bearer tokens in LLM prompts! Fridayy securely resolves credentials at execution time from environment variables (`FRIDAYY_API_KEY`, `FRIDAYY_BEARER_TOKEN`).

### Card 4: 🤖 Autonomous AI Guidance (`@point/`)
Drop Fridayy into any codebase. Developers or AI agents can simply reference `@point/AI_INSTRUCTIONS.md` to have Cursor or Claude configure and run the entire MCP pipeline autonomously.

### Card 5: 🔌 Dual Transport MCP Engine
* **Stdio Mode**: High-performance standard I/O for local AI clients (Claude Desktop, Cursor IDE).
* **SSE Mode**: Server-Sent Events over HTTP for remote AI agents, background workers, and webhooks.

### Card 6: ⚡ Rate Limiting & Tamper-Evident Audit Log
Built-in sliding-window rate limiters prevent API exhaustion, while JSONL audit logging records every tool call, caller identity, and sanitized response.

---

## 🛠️ 7. The 5-Step CLI Workflow (Interactive Stepper)

### Step 1: Initialize
```bash
npx fridayy init
```
*Creates `fridayy.config.json` with detected API sources and environments.*

### Step 2: Deep Scan
```bash
fridayy scan
```
*Analyzes endpoints, parameter definitions, and authentication schemes.*

### Step 3: Tool Generation
```bash
fridayy generate
```
*Builds standardized MCP tool schemas and outputs `fridayy.tools.json`.*

### Step 4: Developer Review
```bash
fridayy review --approve-read
```
*Allows developers to safely approve read-only tools and inspect mutating operations.*

### Step 5: Start MCP Server
```bash
fridayy start
```
*Boots the live MCP Server ready to receive tool calls from AI clients.*

---

## 💻 8. AI Client Setup Guides (Tabbed Code Boxes)

### Tab 1: Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "my-backend": {
      "command": "npx",
      "args": ["fridayy", "start"],
      "env": {
        "FRIDAYY_API_KEY": "your_secret_api_key"
      }
    }
  }
}
```

### Tab 2: Cursor IDE
1. Open Cursor Settings ➔ Features ➔ **MCP Servers**.
2. Click **+ Add New MCP Server**.
3. **Name**: `fridayy`
4. **Type**: `command`
5. **Command**: `npx fridayy start`

### Tab 3: Remote SSE Web Server
```bash
fridayy start --transport sse --port 3000 --host 0.0.0.0
```
*Endpoints exposed:*
* `GET  http://localhost:3000/sse` (SSE Stream)
* `POST http://localhost:3000/messages` (JSON-RPC Message Receiver)
* `GET  http://localhost:3000/health` (Health & Diagnostic Probe)

---

## 👨‍💻 9. Creator & Story

### About the Creator:
**Sabarivasan**
*Passionate Software Engineer, Open-Source Builder & AI Systems Architect.*

* **GitHub**: [@Sabari-Vasan-SM](https://github.com/Sabari-Vasan-SM)
* **Project Repository**: [https://github.com/Sabari-Vasan-SM/fridayy](https://github.com/Sabari-Vasan-SM/fridayy)
* **npm**: [https://www.npmjs.com/package/fridayy](https://www.npmjs.com/package/fridayy)

### The Fridayy Vision:
> *"We believe AI should seamlessly enhance existing software rather than forcing companies to rebuild their infrastructure from scratch. Fridayy is built to be the most secure, delightful, and instantaneous bridge from existing APIs to the AI era."*

---

## ❤️ 10. Support & Sponsorship (Donation Section)

Help keep Fridayy open-source, maintained, and independent!

### Why Support Fridayy?
* 🚀 Faster support for GraphQL, Python, PHP, Go, and SQL adapters
* 🛡️ Continuous security audits and MCP protocol upgrades
* ⚡ Free, open-source development for developer tools

### Donation / Support Options:
1. **GitHub Sponsors**: [Sponsor Sabari-Vasan-SM](https://github.com/sponsors/Sabari-Vasan-SM)
2. **Buy Me a Coffee**: [buymeacoffee.com/sabarivasan](https://buymeacoffee.com/sabarivasan)
3. **Crypto / Web3**:
   * **ETH / ERC-20**: `0x71C...` *(Placeholder for user's wallet)*
   * **Bitcoin**: `bc1q...` *(Placeholder for user's wallet)*

### Sponsorship Tiers:
* ☕ **Individual Supporter ($5/mo)**: Name listed in GitHub README and website hall of fame.
* 🚀 **Pro Developer ($20/mo)**: Priority support and early access to new adapters.
* 🏢 **Enterprise Sponsor ($250/mo)**: Company logo on website header, priority feature requests, and direct Slack/Discord access.

---

## 📜 11. Open Source & License

* **License**: **MIT License** (100% Free for commercial and personal use).
* **Copyright**: © 2026 Sabarivasan. All rights reserved.
* **Community**: Open for contributions, issues, and feature proposals on GitHub.

---

## ❓ 12. Frequently Asked Questions (FAQ)

### Q: Does Fridayy send my source code or API keys to cloud servers?
**A:** No. Fridayy is 100% local-first. All parsing, schema generation, and MCP server execution happen on your local machine or your own infrastructure. No telemetry or secret data is ever transmitted.

### Q: How does Fridayy prevent AI from executing dangerous DELETE requests?
**A:** Fridayy features a strict Permission Classifier. All destructive operations (`DELETE`, purge, erase) are classified as `high risk` and default to `BLOCKED` in `fridayy.tools.json`. They cannot be invoked by LLMs unless explicitly approved by a human developer.

### Q: Can Fridayy work with private/internal REST APIs?
**A:** Yes! As long as you have an OpenAPI specification (or provide a URL endpoint and authentication headers), Fridayy can bridge your private microservices to your local IDE or desktop AI.

### Q: How do I point AI agents (like Cursor or Claude) to set up Fridayy for me?
**A:** Simply point your AI agent to the `point/AI_INSTRUCTIONS.md` file included in the repository. It contains strict directives that guide the AI to autonomously scan, generate, review, and test your MCP server.

---

## 📬 13. Footer & Quick Links

* **Product**: Fridayy MCP Platform
* **Version**: v1.2.0
* **Tagline**: *Build once. Connect everywhere.*
* **Developer**: Sabarivasan
* **Links**:
  * [npm Registry](https://www.npmjs.com/package/fridayy)
  * [GitHub Repository](https://github.com/Sabari-Vasan-SM/fridayy)
  * [Model Context Protocol Docs](https://modelcontextprotocol.io)
  * [Report an Issue](https://github.com/Sabari-Vasan-SM/fridayy/issues)
