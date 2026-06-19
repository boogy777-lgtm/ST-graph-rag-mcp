---
paths: ["src/mcp/**/*.ts"]
topic: mcp-input-validation
---

# MCP Input Validation (scope: src/mcp/**)

## Zod Schemas

- Schemas from `src/mcp/schemas/`
- Schema name: `<ToolName>Schema` (PascalCase)
- Use `z.object().strict()` — reject unknown keys
- Output schema: `z.object({ content: z.array(...) })` per MCP SDK

## Anti-patterns

- ❌ `any` in tool input/output schemas
- ❌ Inline schemas in handlers (extract to schemas/)

## Reference

- @src/mcp/schemas/
