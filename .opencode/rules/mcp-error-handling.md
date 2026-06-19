---
paths: ["src/mcp/**/*.ts"]
topic: mcp-error-handling
---

# MCP Error Handling (scope: src/mcp/**)

## Format

- Wrap handler body in try/catch
- On error: `{ isError: true, content: [{ type: 'text', text: JSON.stringify({code,message}) }] }`
- Never `throw new Error()` to client — catch and format

## Anti-patterns

- ❌ Throwing raw `Error` strings
- ❌ Synchronous file I/O in handlers (use `async`/`fs.promises`)
- ❌ Leaking stack traces in production

## Reference

- @src/mcp/handlers/core.ts
