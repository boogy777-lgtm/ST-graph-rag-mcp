---
paths: ["src/st/**/*.ts", "**/*repository*.ts"]
topic: sqlite-connection-lifecycle
---

# SQLite Connection Lifecycle (scope: src/st/**, **/*repository*)

## Single Instance

- One `Database` instance per workspace
- Owned by `workspace-manager.ts`
- Do not create `new Database(path)` outside `workspace-manager.ts`

## Read-Only

- Use `readonly: true` for read-only operations
- Avoids WAL lock contention with writers

## Transactions

- Wrap mutations: `db.transaction(() => { ... })()`
- Auto-rollback on throw inside transaction
- Avoid long-lived transactions across multiple `prepare()` calls

## Cleanup

- Close via `db.close()` on workspace switch
- Check `opencode.json` reload to trigger close

## Anti-patterns

- ❌ `new Database(path)` outside `workspace-manager.ts`
- ❌ Long-lived transactions across multiple `prepare()` calls
- ❌ Direct `fs.unlink()` of `.code-graph-rag/` — use `reset_graph` tool

## Reference

- @src/st/sqlite-manager.ts
- @src/mcp/workspace-manager.ts
