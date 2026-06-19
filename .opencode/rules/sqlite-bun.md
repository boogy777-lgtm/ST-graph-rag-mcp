---
paths: ["src/storage/**/*.ts", "src/st/**/*.ts", "src/cli/**/*.ts"]
topic: sqlite-bun
---

# SQLite (Bun) (scope: src/storage/**, src/st/**, src/cli/**)

## Driver

- `bun:sqlite` is the only allowed driver.
- Import: `import { Database, type Statement, type Database as DBType } from "bun:sqlite"`
- Never import `better-sqlite3`. The package is uninstalled.
- Types come from `@types/bun` (which provides `BunSQLite` namespace).

## Construction

```ts
const db = new Database(dbPath, { readonly?: boolean, create?: boolean });
// Bun default: create=true. Use { readonly: true } for read-only.
```

## Pragmas

```ts
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA cache_size = -64000");
db.exec(`PRAGMA busy_timeout = ${ms}`);  // replaces .busyTimeout(ms)
```

`db.pragma("name = value")` is supported but **returns the new value (string)**, not the prior value. Prefer `db.exec()` for side effects.

## Prepared Statements

```ts
const stmt = db.query<T>(sql);  // Bun: .query() not .prepare()
// or: db.prepare(sql) — both work in Bun
stmt.all(...params): T[]
stmt.get(...params): T | null      // Bun: get() returns null, not undefined
stmt.run(...params): void
stmt.values(...params): unknown[][] // exists
```

## Transactions

```ts
// Bun signature: db.transaction(fn) returns a wrapped function.
// Sync execution only (Bun SQLite is sync, like better-sqlite3).
const wrapped = db.transaction(fn);
wrapped();             // execute
wrapped.deferred();    // BEGIN DEFERRED
wrapped.immediate();   // BEGIN IMMEDIATE
wrapped.exclusive();   // EXCLUSIVE
```

## Type Gotchas

- `Statement.get()` returns `null` (not `undefined`) when no row.
- `Database.run()` does not exist; use `db.exec()` for raw multi-statement SQL.
- No `safeIntegers` toggle; use BigInt-aware queries if needed.
- `db.iterate(sql, ...params)` exists; yields `T | null`.

## Anti-Patterns

- ❌ `import Database from "better-sqlite3"` — package is uninstalled
- ❌ `as Database.Statement` (better-sqlite3 namespace) — use `Statement` from `bun:sqlite`
- ❌ `db.pragma("name = value")` and ignoring the return value side effects — prefer `db.exec("PRAGMA ...")`
- ❌ `stmt.get()` and then `?? undefined` — Bun returns `null`; convert once at boundary
- ❌ Async wrappers around sync SQLite — Bun is sync; `await` is a lie

## Reference

- @src/storage/sqlite-database.ts
- @src/st/sqlite-manager.ts
- @src/cli/obsidian-export.ts
