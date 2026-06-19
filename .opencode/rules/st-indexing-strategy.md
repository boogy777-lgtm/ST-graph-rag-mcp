---
paths: ["**/*.st", "**/*.pou"]
topic: st-indexing-strategy
---

# ST Indexing Strategy (scope: **/*.st, **/*.pou)

## LSP Path (single source of truth)

- Use `trust-lsp.exe` (boogy777-lgtm/Trust-platform fork, Windows only)
- Native Rust binary, 7.5 MB, release-optimized (`target-cpu=native`, `lto=fat`)
- Binary path: `<workspace>/bin/trust-lsp.exe` (env `TRUST_LSP_PATH`)
- Configuration: `opencode.json` → `lsp.trust-lsp` (extensions `.st`, `.pou`)

## Pipeline

1. `handleIndex` spawns LSP for each `.st`/`.pou` file
2. LSP returns symbols (POU, VAR, TYPE) via `textDocument/documentSymbol`
3. `STSQLiteManager` persists to `st_pous`, `st_variables`, `st_types`, `st_relationships`
4. DB auto-created on first index via `workspace-manager.ts` Path 2

## Performance

- ~10-50 files/sec (depends on file complexity)
- 100-file workspace: <30s cold, <5s incremental
- `batch_index` tool recommended for strict MCP clients/timeouts

## Workspace

- Workspace path: absolute, normalized (no `..`)
- See `workspace-manager.ts:normalizeWorkspacePath`
- Multi-workspace supported via `WorkspaceManager` map

## Anti-patterns

- ❌ Spawn multiple LSP instances per workspace — one per workspace
- ❌ Modify `.st` files during indexing — race condition
- ❌ Store full file content in SQLite — only source range + path
- ❌ Use `sqlite-vec` for code search — removed in v2.9 (no embeddings)

## Reference

- @src/st/indexer.ts
- @src/mcp/handlers/core.ts (handleIndex, handleSearch, handleBatchIndex)
- @trust-platform/crates/trust-lsp
