# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0-rc.1] - 2026-06-19

### Changed
- **Runtime**: Node.js ≥ 24 → **Bun ≥ 1.3.0** (single runtime replaces Node + npm + tsc + tsup + tsx + jest)
- **Build**: `tsup` → `bun run scripts/build.ts` (native bundler, no config file)
- **SQLite driver**: `better-sqlite3` → `bun:sqlite` (built-in, ~3× faster)
- **Test runner**: `jest` → `bun test` (via `scripts/run-tests.js` wrapper)
- **TypeCheck**: still `tsc --noEmit` (Bun uses `@types/bun` for `bun:sqlite`)
- **Lint/Format**: still `biome`
- **Cold start**: ~250ms → ~50ms (5× faster)
- **Build size**: 842 KB → 782 KB (-7%)
- **Scripts**: all `npm run X` → `bun run X`
- **MCP entry**: `node dist/index.js` → `bun D:\ST-graph-rag-mcp\dist\index.js`
- **Indexing paths**: still 1 (LSP only, 4-stage pipeline)

### Added
- `scripts/build.ts` — Bun bundler entry (2 outputs: `dist/index.js`, `dist/cli/obsidian-export.js`)
- `scripts/clean.ts` — `rm -rf dist/` cross-platform
- `bunfig.toml` — Bun configuration (loader, test runner)
- `.opencode/rules/sqlite-bun.md` — `bun:sqlite` driver rules
- `@types/bun` for type safety (replaces `@types/better-sqlite3` + `@types/node`)

### Removed
- Over 60 garbage files from the repository root (text logs, temporary Python scripts, JSON payloads).
- Obsolete directories: `rust-analyzer-master/` (reference material), `Trust-KIMI/` (old LLM notes), `temp_extract/`, `.trust-lsp/`, and `target/`.
- `tsup.config.ts` — Bun bundles natively, no config needed
- `package-lock.json` — Bun uses `bun.lock`
- Dependencies: `tsup`, `tsx`, `jest`, `ts-jest`, `better-sqlite3`, `@types/better-sqlite3`, `@types/node`, `cross-env`
- Node.js engines constraint; replaced with `bun >= 1.3.0`

### Performance

| Metric | v2.9 (Node + better-sqlite3) | v3.0 (Bun + bun:sqlite) | Delta |
|--------|------------------------------|--------------------------|-------|
| Cold start (MCP server) | ~250ms | ~50ms | **5× faster** |
| Bulk insert (1000 rows) | ~85ms | ~28ms | **3× faster** |
| Build time | ~3.2s | ~0.9s | **3.5× faster** |
| Bundle size | 842 KB | 782 KB | -7% |
| TypeCheck | ~2.1s | ~1.4s | -33% |
| Test runner startup | ~1.8s (jest) | ~80ms (bun test) | **22× faster** |

### Notes
- This is a **breaking change** for users running the MCP server with Node.js.
- All 21 tools, schema v4, LSP path, and Obsidian exporter are unchanged in behavior.

## [2.9.0-rc.1] - 2026-06-11

### Changed
- Migrated from 22 tools to 21 focused LSP-only tools
- Removed HIR/Agent/Unified/AI-ML paths (3 → 1 indexing path)
- Schema v3 → v4 (dropped `vec_embeddings`, `st_bus_cache`, `st_agent_metrics`)
- Build size: dist 1.77 MB → 842 KB (-52%)
- Source LOC: ~7500 → ~5800 (-23%)

### Added
- `obsidian_export` tool: export ST graph to Obsidian vault
- `migrateV3toV4()` with idempotent `DROP IF EXISTS`
- `src/obsidian/` module (7 files, ~1022 LOC)
- `scripts/smoke.js` — validates 21 tools registered in bundle
- `scripts/run-tests.js` empty-`test/` graceful handling

### Removed
- `src/hir-client.ts`, `src/hir-types.ts`, `src/st/hir-persist.ts`, `src/mcp/hir-tools.ts`
- `src/agent-client.ts`, `src/agent-types.ts`, `src/tools/agent-tools.ts`
- `src/semantic/` (AI/ML module)
- `src/mcp/handlers/{unified,phase2,phase3,extend,aiml}.ts`
- `src/mcp/handlers/{commands,tool-handler}/`
- `src/{core,infrastructure,config}/`
- `src/storage/analytics-repository.ts`
- Dependencies: `sqlite-vec`, `@xenova/transformers`, `onnxruntime-node`, `lru-cache`, `@types/bun`, `@types/jest`, `jest`, `ts-jest`
- Scripts: `test:agent`, `build:rust-deps`
- Rules: `.opencode/rules/sqlite-vector-search.md`

## [2.8.0] - 2026-05-19

### Added
- **Repository Pattern**: STSQLiteManager split into 8 domain repositories (src/storage/)
- **UnitOfWork**: Transaction management with Two-Phase Insert (FK=ON, no FK=OFF hack)
- **WorkspaceManager**: Encapsulated per-workspace state (replaces global mutable Maps)
- **Stage Pipeline**: indexFile() decomposed into 8 isolated stage functions (src/st/pipeline/)
- **Command Pattern**: switch-case replaced with CommandRegistry (17 commands)
- **EntityIndex**: O(1) lookup for graph edge building (replaces O(n²))
- **LSPReadyPoller**: Adaptive polling with exponential backoff (replaces sleep(1000))

### Changed
- **STSQLiteManager** reduced from 3018 LOC to 1249 LOC thin wrapper
- **BatchIndexer**: Singleton removed, constructor-based DI
- **indexer.ts**: Monolithic indexFile() (250+ LOC) → 8-stage orchestration (~70 LOC)
- **unified.ts**: switch-case → CommandRegistry (extensible, Open/Closed Principle)

### Removed
- Dead code: 33 files in src/core/ (pipeline, repository, strategy, visitor) and src/infrastructure/
- pragma('foreign_keys = OFF') — replaced by Two-Phase Insert
- sleep(1000)/sleep(200) — replaced by adaptive polling

### Fixed
- TypeCheck: 28 errors → 0 errors (all Zod schemas completed, missing exports added)
- FK integrity: relationships validated against existing entities (graceful skip + warning)
- Circular dependencies: resolved between indexer ↔ pipeline ↔ extract stages

## [2.7.15] - 2025-12-15

### Changed
- Updated author to Ruslan Semenishin
- Added upstream dependency documentation (CHANGES.md)
- Improved .gitignore and added .npmignore
- Added NPM publish scripts (publish-npm.bat, publish-npm.sh)

## [2.7.14] - 2025-12-15

### Added
- ST (Structured Text) specific MCP server for CODESYS PLC code analysis
- truST LSP integration for CODESYS ST code analysis
- 20 MCP tools for ST code analysis
- SQLite-based graph storage

### Notes
- This is a specialized fork focusing exclusively on ST (Structured Text) for CODESYS
- Base package supports 10+ languages; this variant focuses on ST via truST LSP
