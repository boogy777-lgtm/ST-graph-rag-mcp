---
paths: ["src/st/**/*.ts"]
topic: sqlite-schema-migrations
---

# SQLite Schema Migrations (scope: src/st/**)

## Auto-Create

- Schema is auto-created on first index
- See `workspace-manager.ts` Path 2
- Schema version: **v4** (current)
- Migration chain: v1 → v2 → v3 → v4 (cumulative)

## Adding New Tables

- Add to `CREATE TABLE` block in `initSchema()` in `src/storage/sqlite-database.ts`
- Use `IF NOT EXISTS` — idempotent
- Pair with `migrateV<N>toV<N+1>()` function for existing DBs

## Current Tables (v4)

```csv
Table,Purpose
st_pous,POU definitions (FUNCTION_BLOCK, PROGRAM, FUNCTION, METHOD)
st_variables,Variable declarations (VAR, VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR_TEMP, VAR_STAT)
st_types,TYPE/DUT definitions (STRUCT, ENUM, ARRAY, ALIAS)
st_relationships,Edges (CALLS, USES_TYPE, INHERITS, IMPLEMENTS)
st_files,Indexed source files
st_diagnostics,LSP diagnostics (warnings, errors)
```

## migrateV3toV4 (P5 cleanup)

```sql
DROP TABLE IF EXISTS vec_embeddings;
DROP TABLE IF EXISTS st_bus_cache;
DROP TABLE IF EXISTS st_agent_metrics;
DROP INDEX IF EXISTS idx_bus_cache_topic;
DROP INDEX IF EXISTS idx_bus_cache_key;
DROP INDEX IF EXISTS idx_agent_metrics_timestamp;
DROP INDEX IF EXISTS idx_agent_metrics_query_type;
```

All 3 tables are idempotent (DROP IF EXISTS). Safe to re-run on fresh DBs.

## Removed in v4

- ~~vec_embeddings~~ (sqlite-vec removed; no embeddings)
- ~~st_bus_cache~~ (agent bus removed)
- ~~st_agent_metrics~~ (agent telemetry removed)

## Versioning

- Pattern: `migrateV<N>toV<N+1>()` methods in `src/storage/sqlite-database.ts`
- Called sequentially in `initialize()` after `migrateV2toV3()` etc.
- No `SCHEMA_VERSION` constant — version is implicit in method presence

## Anti-patterns

- ❌ `DROP TABLE` outside `migrateV<N>toV<N+1>()` methods
- ❌ Adding `DROP TABLE` for current tables (use IF EXISTS only in migrations)
- ❌ Direct schema edits outside `initSchema()`

## Reference

- @src/storage/sqlite-database.ts
- @src/st/sqlite-manager.ts
