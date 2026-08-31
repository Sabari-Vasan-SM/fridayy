# Fridayy Project Context & Machine-Readable Spec

This document provides structured context for AI agents reading the codebase.

---

## 📌 Project Metadata
* **Name**: `fridayy`
* **Version**: `1.2.0`
* **Author**: `Sabarivasan`
* **Protocol**: Model Context Protocol (MCP) v1.6+
* **Repository**: `https://github.com/Sabari-Vasan-SM/fridayy`
* **License**: MIT

---

## 🛠️ Data Model & Schemas

### FridayyToolDefinition
```typescript
interface FridayyToolDefinition {
  id: string;                                   // Unique ID (e.g. tool_get_products)
  name: string;                                 // Valid snake_case tool name (e.g. get_products)
  description: string;                          // Human & AI-readable description
  inputSchema: {                                // Unified JSON Schema Draft-7
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  source: {                                     // Source binding
    type: 'openapi' | 'rest' | 'nodejs' | 'manual';
    method?: string;
    path?: string;
    baseUrl?: string;
  };
  permissions: {                                // Permission classification
    type: 'READ' | 'WRITE' | 'DESTRUCTIVE';
    read: boolean;
    write: boolean;
    destructive: boolean;
  };
  risk: 'low' | 'medium' | 'high';              // Risk scoring
  status: 'APPROVED' | 'PENDING' | 'BLOCKED' | 'REJECTED';
}
```

---

## 🚦 Permission Matrix

| HTTP Method / Pattern | Classification | Risk Level | Default Status | Action Required |
|---|---|---|---|---|
| `GET`, `HEAD`, `OPTIONS` | `READ` | `low` | `APPROVED` | Ready for AI invocation |
| `POST`, `PUT`, `PATCH` | `WRITE` | `medium` | `PENDING` | Review before enabling |
| `DELETE`, `purge`, `erase`, `cancel` | `DESTRUCTIVE` | `high` | `BLOCKED` | Explicit human approval mandatory |

---

## 🔌 Available Transports
1. **Stdio Transport**: Default standard I/O stream for local desktop AI clients (Claude Desktop, Cursor IDE).
2. **SSE Transport**: Server-Sent Events over HTTP for remote AI agents and web hooks (`--transport sse --port 3000`).
