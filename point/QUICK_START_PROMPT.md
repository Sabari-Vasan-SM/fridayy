# AI Agent Prompt Snippets

Copy-paste any of the prompts below into Claude, ChatGPT, Cursor, Gemini, or Antigravity to perform automatic Fridayy tasks:

---

### Prompt 1: Full Automatic API-to-MCP Setup
```text
Please read @point/AI_INSTRUCTIONS.md and automatically analyze my current project.
Detect my OpenAPI / REST endpoints, generate Fridayy tool definitions, approve all safe read-only tools, verify project health with 'fridayy doctor', and guide me on how to start the MCP server.
```

---

### Prompt 2: Safe Tool Review & Selective Approval
```text
Please review @point/PROJECT_CONTEXT.md and my generated fridayy.tools.json.
List all candidate tools, highlight any WRITE or DESTRUCTIVE tools that require confirmation, and help me approve only the tools needed for my specific task.
```

---

### Prompt 3: Add Custom Tool / Adapter Extension
```text
I want to add a custom adapter/tool to Fridayy.
Please check @point/AI_INSTRUCTIONS.md Section 5 for adapter extension rules, and help me implement a new BaseAdapter subclass for my backend.
```
