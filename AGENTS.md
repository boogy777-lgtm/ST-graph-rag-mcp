# ST-Graph-RAG-MCP

> MCP server for ST (CODESYS Structured Text) code analysis with graph-based representations and SQLite-backed graph queries.
> **Targets:** opencode (Claude Code fallback via `CLAUDE.md`).
> **Version:** 3.0.0 (Bun runtime, `bun:sqlite`, LSP-only, 21 tools, Obsidian export)

## Rules

- All scope-specific rules live in `.opencode/rules/<topic>.md` (one rule = one file)
- LLM applies a rule by matching its `paths:` marker against the file being edited
- Full list: see `@.opencode/rules/` below

## MCP Handlers
@.opencode/rules/mcp-tool-definition.md
@.opencode/rules/mcp-input-validation.md
@.opencode/rules/mcp-error-handling.md

## ST Files (.st, .pou)
@.opencode/rules/st-pou-types.md
@.opencode/rules/st-indexing-strategy.md

## SQLite / Database
@.opencode/rules/sqlite-bun.md
@.opencode/rules/sqlite-connection-lifecycle.md
@.opencode/rules/sqlite-schema-migrations.md

## Build

| Field | Value |
|-------|-------|
| Runtime | **Bun ≥ 1.3.0** (single runtime: ESM, TS, SQLite, bundler, test runner) |
| UI Stack | **Vite + React + Tailwind + React Flow + Recharts** (`src/ui`) |
| Bundler | **`bun build`** via `bun run scripts/build.ts` (Builds UI, then embeds as strings into `.exe`) |
| TypeCheck | `tsc --noEmit` (`bun run typecheck`) |
| Lint/Format | `biome` (`bun run lint`, `bun run format`) |
| Smoke | `bun run scripts/smoke.js` (`bun run smoke`) |
| Output | `bin/st-graph-rag-mcp.exe` (~95 MB) + `bin/obsidian-export.exe` |
| Driver | `bun:sqlite` (built-in, native, ~3× faster than `better-sqlite3`) |

```bash
bun run build      # Builds React UI and compiles to bin/*.exe
bun run typecheck  # tsc --noEmit
bun run lint       # biome check .
bun run smoke      # validates binary size and basic execution
bun test           # bun test via scripts/run-tests.js
```

## MCP Server

| Field | Value |
|-------|-------|
| Entry | `bin/st-graph-rag-mcp.exe` (Standalone Bun binary) |
| Transport | stdio |
| Dashboard | `http://127.0.0.1:61131` (Live telemetry, graph, analytics) |
| Config | `opencode.json` → `mcp.code-graph-rag-st` |
| Command | `D:\ST-graph-rag-mcp\bin\st-graph-rag-mcp.exe` |
| Env | `TRUST_LSP_PATH=bin/trust-lsp.exe` (only env var) |
| Tools | **21 total** (Core 6 + Analysis 6 + Advanced 2 + SQL-Graph 4 + Utility 2 + Export 1) |

## Database

| Field | Value |
|-------|-------|
| Path | `<workspace>/.code-graph-rag/st-graph.db` |
| Engine | SQLite via `bun:sqlite` (native binding, built into Bun) |
| Schema | **v4** (migrations v1→v2→v3→v4, all idempotent) |
| Auto-create | ✅ `workspace-manager.ts` creates dir + DB on first index |
| Tables (10) | `st_pous`, `st_variables`, `st_types`, `st_relationships`, `st_files`, `st_diagnostics` + 4 internal |
| Removed in v4 | `vec_embeddings`, `st_bus_cache`, `st_agent_metrics` (all `DROP IF EXISTS`) |

## LSP Binary

| Field | Value |
|-------|-------|
| Source | Rust crate `trust-platform/crates/trust-lsp` |
| Build | `cargo build --release -p trust-lsp` |
| Deploy to | `D:\ST-graph-rag-mcp\bin\trust-lsp.exe` |
| Config | `opencode.json` → `lsp.trust-lsp` (extensions: `.st`, `.pou`) |

## Indexing Flow (4-stage pipeline)

1. **`handleIndex`** spawns `trust-lsp.exe` (LSP only, no HIR fallback)
2. **LSP** returns symbols (POU, VAR, TYPE) via `textDocument/documentSymbol`
3. **`STSQLiteManager`** persists to `st_pous`, `st_variables`, `st_types`, `st_relationships`
4. **SQLite** (via `bun:sqlite`) auto-creates DB on first index via `workspace-manager.ts` Path 2

## Obsidian Export

1. `obsidian_export` MCP tool OR `bun run obsidian:export` CLI
2. `src/obsidian/exporter.ts` queries `st_pous`/`st_types`/`st_variables`/`st_relationships`
3. Renders POU/TYPE/index templates, builds `[[wikilinks]]`, adds YAML frontmatter
4. SHA256 incremental cache skips unchanged entities
5. Atomic write: temp file + `fs.renameSync` to final path

## Cognitive Asymmetry (Когнитивная асимметрия)

**Внимание всем агентам (включая code-engineer и ts-architect):**
ИИ-агенты не держат в контексте весь проект целиком. Из-за этой "когнитивной асимметрии" возникает соблазн писать "бетонный" код, срезать углы и ломать архитектуру ради того, чтобы быстрее получить "зеленые тесты".

**Строгие правила противодействия:**
1. **НИКОГДА** не обходите архитектурные слои проекта ради быстрого локального фикса (например, прямого доступа к БД из хендлеров). Все модули общаются строго через публичные `index.ts`.
2. Внимательно следите за историями ошибок. Мы уже сталкивались с падением бинарника из-за использования динамического `require()` и потерей файлов из-за слепого `git checkout .`.
3. Мы используем **`bun build --compile`** для создания единого монолитного бинарника (`st-graph-rag-mcp.exe`). Все статические ассеты UI зашиваются прямо в код в виде строк (`UI_ASSETS`).
4. Вы обязаны учитывать этот паттерн поведения при каждом изменении кода.

## Restart opencode After

- Rebuilding `bin/*.exe` (`bun run build`)
- Replacing `bin/trust-lsp.exe`
- Changing `opencode.json` (mcp/lsp/agent/instructions sections)
- Creating/editing `.opencode/rules/*.md`
- Creating/editing `.opencode/skills/*/SKILL.md`
- Creating/editing `.opencode/agents/*/agent.md`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Ran `node dist/index.js` | Use `bun D:\ST-graph-rag-mcp\dist\index.js` (Bun runtime required for `bun:sqlite`) |
| Ran `npm run X` | Use `bun run X` (project has no `package-lock.json`, npm install fails) |
| Installed `better-sqlite3` | ❌ removed; use `bun:sqlite` (built-in, no install) |
| Search returns empty | DB not persisted — check `.code-graph-rag/st-graph.db` exists |
| Smoke fails after adding a tool | Add the tool name to `REQUIRED_TOOLS` in `scripts/smoke.js` |
| Rule in wrong place | Use `.opencode/rules/<topic>.md` (one rule = one file), not AGENTS.md |
| `Cannot find module 'bun:sqlite'` | Not running under Bun — verify `bun --version` ≥ 1.3.0 |

## Key Files

| File | Role |
|------|-----|
| `src/index.ts` | MCP server entry (LSP spawn, stdio transport) |
| `src/cli/obsidian-export.ts` | Standalone CLI for vault export |
| `src/mcp/workspace-manager.ts` | DB lifecycle, multi-workspace context |
| `src/mcp/tool-registry.ts` | Registers all 21 MCP tools |
| `src/mcp/handlers/core.ts` | index, search, references, call_hierarchy, batch_index, health |
| `src/mcp/handlers/analysis.ts` | variable_flow, fb_instances, call_chain, global_vars, impact_analysis, metrics |
| `src/mcp/handlers/advanced.ts` | state_machine, data_flow_graph |
| `src/mcp/handlers/sql-graph.ts` | list_file_entities, get_graph, get_entity_source, detect_code_clones |
| `src/mcp/handlers/utility.ts` | get_version, reset_graph |
| `src/mcp/handlers/obsidian-export.ts` | obsidian_export |
| `src/st/indexer.ts` | LSP-based indexing pipeline |
| `src/st/sqlite-manager.ts` | SQLite operations (Repository pattern, `bun:sqlite`) |
| `src/obsidian/exporter.ts` | Obsidian vault main orchestrator |
| `src/obsidian/frontmatter-builder.ts` | YAML frontmatter (8 fields + schema_version) |
| `src/obsidian/wikilink-builder.ts` | entityName → `[[wikilink]]` |
| `src/obsidian/incremental.ts` | SHA256 cache for incremental export |
| `src/storage/sqlite-database.ts` | Schema v4 + `migrateV3toV4()` |
| `src/storage/graph-repository.ts` | Graph edges (CALLS, USES_TYPE, INHERITS, IMPLEMENTS) |
| `src/storage/metrics-repository.ts` | POU metrics, hotspots |
| `scripts/build.ts` | Bun bundler entry (2 outputs) |
| `scripts/smoke.js` | Validates 21 tools registered in bundle |
| `scripts/run-tests.js` | `bun test` wrapper (empty `test/` = success) |
| `scripts/clean.ts` | `rm -rf dist/` cross-platform |
| `.opencode/rules/*.md` | Scope-specific rules (one per file, 8 files) |
| `opencode.json` | MCP + LSP + agents config |
| `bunfig.toml` | Bun configuration (loader, test runner) |

## Style

- TypeScript strict ESM, `.js` extensions in relative imports
- `biome` for lint+format (not eslint/prettier)
- No comments unless asked
- 2-space indent, single quotes, no semicolons (biome defaults)

## Do Not Touch

- `dist/` (generated by `bun run build`)
- `node_modules/` (transient; Bun uses `bun.lock`)
- `bin/trust-lsp.exe` (binary, replace only via `cargo build`)
- `trust-platform/` (git submodule, locally modified — leave for v3.0.0 final)
- `*.local.md` (gitignored — use for secrets)

@package.json
@opencode.json
