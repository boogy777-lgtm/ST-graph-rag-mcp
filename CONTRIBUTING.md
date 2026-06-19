# Contributing to ST-Graph-RAG-MCP

Welcome! This document outlines the development workflow, architecture, and coding standards for the project.

## 🏗️ Tech Stack

- **Runtime:** [Bun](https://bun.sh/) (replaces Node.js)
- **Language:** TypeScript (Strict, ES2024, ESM)
- **Database:** `bun:sqlite` (native, highly performant)
- **Linter & Formatter:** [Biome](https://biomejs.dev/)
- **Bundler:** `Bun.build` via `scripts/build.ts`
- **Testing:** `bun:test`

## 🛠️ Local Development

### 1. Setup

```bash
# Clone the repository
git clone <repository-url>
cd ST-graph-rag-mcp

# Install dependencies (do NOT use npm)
bun install
```

### 2. Available Commands

We use `bun run` exclusively. Do not use `npm` or `npx`.

| Command | Action |
|---------|--------|
| `bun run build` | Compiles the server to `dist/index.js` and CLI to `dist/cli/obsidian-export.js`. |
| `bun run typecheck` | Runs `tsc --noEmit` to verify type safety. |
| `bun run lint` | Runs Biome checks. |
| `bun run format` | Runs Biome auto-formatting. |
| `bun run test` | Runs the test suite via `bun test` and `scripts/run-tests.js`. |
| `bun run smoke` | Verifies the compiled bundle correctly exports all 21 MCP tools. |
| `bun run clean` | Removes the `dist/` directory. |

## 📐 Architecture Principles

This project adheres to a strict layered architecture to maintain high performance and separation of concerns:

1. **LSP Protocol over stdio:** The TS server does **not** parse `.st` files itself. It acts as an orchestrator, spawning `bin/trust-lsp.exe`, sending `initialize`, opening documents, and requesting `textDocument/documentSymbol` and `textDocument/callHierarchy`.
2. **4-Stage Indexing Pipeline:** Found in `src/st/pipeline/`.
   - `lspOpenStage`: Opens file in LSP.
   - `parseStage`: Extracts raw symbols.
   - `extractStage`: Resolves regex/structural relationships.
   - `persistStage`: Atomic batch insert into SQLite.
3. **Repository Pattern:** Found in `src/storage/`. Database access is isolated into specialized repositories (`graph-repository.ts`, `metrics-repository.ts`, etc.).
4. **Idempotent Storage:** The SQLite database is rebuilt smoothly. Do not mutate the schema outside of `migrateV(N)toV(N+1)` functions in `sqlite-database.ts`.

## 📜 Coding Standards (The "God Object" Rules)

If you use an LLM or write code manually, enforce these rules:
- **Strict Types:** No `any`. Use `unknown` + type guards.
- **ESM Strictness:** All relative imports MUST include the `.js` extension (e.g., `import { X } from './utils.js'`), even though we build with Bun.
- **No Floating Promises:** Every async call must be `await`-ed or `.catch()`-ed.
- **MCP Tool Definition:** Every MCP tool must use a `zod` schema strictly defined in `src/mcp/handlers/schemas.ts`.

## 🧪 Testing

To add a new feature, run the test suite to ensure no regressions. The smoke test (`bun run smoke`) is required before committing to ensure the MCP protocol contract remains unbroken.

```bash
# Run all checks
bun run typecheck && bun run smoke && bun run test
```

## 📦 Updating the Rust LSP

The `trust-lsp.exe` binary located in `bin/` is compiled from the `trust-platform-main` Rust workspace. If you need to update the ST parser logic:

1. Navigate to `trust-platform-main/`
2. Make your Rust changes.
3. Compile: `cargo build --release -p trust-lsp`
4. Copy `target/release/trust-lsp.exe` to the root `bin/` folder.
