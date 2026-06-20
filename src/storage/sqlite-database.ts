/**
 * SQLite Database Connection Manager
 *
 * Handles low-level database connection, schema DDL, migrations,
 * and meta-operations. Extracted from STSQLiteManager (God Object refactor).
 *
 * Phase 5: Vec/Bus/Agent tables removed. See migrateV3toV4().
 */

import { Database, type Statement } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { IDatabase } from "./interfaces";

const ST_SCHEMA = `
-- POU (Program Organization Units)
CREATE TABLE IF NOT EXISTS st_pous (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pou_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER,
  namespace TEXT,
  extends TEXT,
  implements TEXT,
  signature TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Variables of POU
CREATE TABLE IF NOT EXISTS st_variables (
  id TEXT PRIMARY KEY,
  pou_id TEXT NOT NULL,
  name TEXT NOT NULL,
  direction TEXT NOT NULL,
  var_type TEXT NOT NULL,
  default_value TEXT,
  start_line INTEGER,
  end_line INTEGER,
  FOREIGN KEY (pou_id) REFERENCES st_pous(id) ON DELETE CASCADE
);

-- Variable lists (global scopes)
CREATE TABLE IF NOT EXISTS st_variable_lists (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  name TEXT NOT NULL,
  direction TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER
);

-- User-defined types (STRUCT, ENUM, TYPE)
CREATE TABLE IF NOT EXISTS st_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type_kind TEXT NOT NULL,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER,
  definition TEXT,
  created_at INTEGER NOT NULL
);

-- Struct fields
CREATE TABLE IF NOT EXISTS st_fields (
  id TEXT PRIMARY KEY,
  parent_type_id TEXT NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  default_value TEXT,
  start_line INTEGER,
  end_line INTEGER,
  file_path TEXT NOT NULL
);

-- ST entity relationships
-- Note: FK constraints removed because from_id/to_id may reference
-- either st_pous or st_types. Integrity is enforced by Two-Phase Insert logic.
CREATE TABLE IF NOT EXISTS st_relationships (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line INTEGER,
  metadata TEXT
);

-- Trigger: cascade delete relationships when st_types are deleted
CREATE TRIGGER IF NOT EXISTS trg_delete_type_relationships
BEFORE DELETE ON st_types
FOR EACH ROW
BEGIN
  DELETE FROM st_relationships WHERE to_id = OLD.id;
  DELETE FROM st_relationships WHERE from_id = OLD.id;
END;

-- File tracking
CREATE TABLE IF NOT EXISTS st_files (
  path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  last_indexed INTEGER NOT NULL,
  pou_count INTEGER NOT NULL DEFAULT 0,
  var_count INTEGER NOT NULL DEFAULT 0
);

-- Diagnostics: LSP publishDiagnostics results
CREATE TABLE IF NOT EXISTS st_diagnostics (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  line INTEGER NOT NULL,
  column INTEGER,
  severity INTEGER,
  code TEXT,
  message TEXT NOT NULL,
  source TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_st_diagnostics_file ON st_diagnostics(file_path);
CREATE INDEX IF NOT EXISTS idx_st_diagnostics_severity ON st_diagnostics(severity);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_st_pous_name ON st_pous(name);
CREATE INDEX IF NOT EXISTS idx_st_pous_type ON st_pous(pou_type);
CREATE INDEX IF NOT EXISTS idx_st_pous_file ON st_pous(file_path);
CREATE INDEX IF NOT EXISTS idx_st_variables_pou ON st_variables(pou_id);
CREATE INDEX IF NOT EXISTS idx_st_variables_type ON st_variables(var_type);
CREATE INDEX IF NOT EXISTS idx_st_types_name ON st_types(name);
CREATE INDEX IF NOT EXISTS idx_st_rel_from ON st_relationships(from_id);
CREATE INDEX IF NOT EXISTS idx_st_rel_to ON st_relationships(to_id);
CREATE INDEX IF NOT EXISTS idx_st_rel_type ON st_relationships(type);
CREATE INDEX IF NOT EXISTS idx_st_files_indexed ON st_files(last_indexed);

-- Meta table: key-value storage for DB metadata
CREATE TABLE IF NOT EXISTS st_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export class SQLiteDatabase implements IDatabase {
	readonly raw: Database;

	private setMetaStmt: Statement | null = null;
	private getMetaStmt: Statement | null = null;

	constructor(dbPath: string) {
		const dir = dirname(dbPath);
		if (dir && !existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		this.raw = new Database(dbPath, { create: true });
		// Bun: pragma() returns the new value as a string; use exec() for side-effects-only PRAGMAs.
		this.raw.exec("PRAGMA journal_mode = WAL");
		this.raw.exec("PRAGMA foreign_keys = ON");
		this.raw.exec("PRAGMA synchronous = NORMAL");
		this.raw.exec("PRAGMA cache_size = -64000"); // 64MB cache
		this.raw.exec("PRAGMA busy_timeout = 5000");
	}

	initialize(): void {
		this.raw.exec(ST_SCHEMA);
		this.prepareMetaStatements();
		this.migrateV1toV2();
		this.migrateV2toV3();
		this.migrateV3toV4();
	}

	private prepareMetaStatements(): void {
		this.setMetaStmt = this.raw.query(
			`INSERT INTO st_meta (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		);
		this.getMetaStmt = this.raw.query(
			`SELECT value FROM st_meta WHERE key = ?`,
		);
	}

	setMeta(key: string, value: string): void {
		if (!this.setMetaStmt) throw new Error("Database not initialized");
		this.setMetaStmt.run(key, value);
	}

	getMeta(key: string): string | null {
		if (!this.getMetaStmt) throw new Error("Database not initialized");
		// Bun: get() returns null when no row; better-sqlite3 returned undefined.
		const row = this.getMetaStmt.get(key) as { value: string } | null;
		return row?.value ?? null;
	}

	transaction<T>(fn: () => T): T {
		// Bun: db.transaction(fn) returns a wrapped function; call it once for sync execution.
		const wrapped = this.raw.transaction(fn);
		return wrapped();
	}

	close(): void {
		this.raw.close();
		this.setMetaStmt = null;
		this.getMetaStmt = null;
	}

	// === Migrations ===

	private migrateV1toV2(): void {
		// Check if st_bus_cache exists (introduced in v2)
		const tableInfo = this.raw
			.query<{ name: string }, []>(
				`SELECT name FROM sqlite_master WHERE type='table' AND name='st_bus_cache'`,
			)
			.get();
		if (!tableInfo) {
			// Already handled by CREATE TABLE IF NOT EXISTS in schema
			console.log("[ST SQLite] Migration v1→v2 applied (bus cache tables)");
		}
	}

	private migrateV2toV3(): void {
		// Check if st_agent_metrics exists (introduced in v3)
		const tableInfo = this.raw
			.query<{ name: string }, []>(
				`SELECT name FROM sqlite_master WHERE type='table' AND name='st_agent_metrics'`,
			)
			.get();
		if (!tableInfo) {
			console.log("[ST SQLite] Migration v2→v3 applied (agent metrics tables)");
		}
	}

	/**
	 * Phase 5: Drop dead Vec/Bus/Agent tables and their indexes.
	 * Idempotent: safe to run on a v3 DB (drops existing) or v4 DB (no-op).
	 * vec_embeddings was the AI/ML virtual table (sqlite-vec); st_bus_cache and
	 * st_agent_metrics were the auxiliary caching/observability tables — all
	 * removed in P5 (M2 + M8 from MIGRATION_PLAN.md).
	 *
	 * Note: vec_embeddings is a virtual table (vec0 module). If sqlite-vec is
	 * not loaded in this process, DROP would fail with "no such module: vec0".
	 * We catch this and log a warning — the table is dead anyway, and a fresh
	 * v4 DB will never create it. Users can `DELETE FROM vec_embeddings` later
	 * when they re-load the extension.
	 */
	private migrateV3toV4(): void {
		// Check if vec_embeddings exists before attempting to drop
		const tableExists = this.raw
			.query<{ name: string }, []>(
				`SELECT name FROM sqlite_master WHERE type='table' AND name='vec_embeddings'`,
			)
			.get();

		if (tableExists) {
			try {
				this.raw.exec(`DROP TABLE IF EXISTS vec_embeddings;`);
			} catch (err) {
				console.warn(
					"[ST SQLite] vec_embeddings not dropped (sqlite-vec unavailable); table is dead code",
					err,
				);
			}
		}

		this.raw.exec(`DROP TABLE IF EXISTS st_bus_cache;`);
		this.raw.exec(`DROP TABLE IF EXISTS st_agent_metrics;`);
		this.raw.exec(`DROP INDEX IF EXISTS idx_bus_cache_topic;`);
		this.raw.exec(`DROP INDEX IF EXISTS idx_bus_cache_key;`);
		this.raw.exec(`DROP INDEX IF EXISTS idx_agent_metrics_timestamp;`);
		this.raw.exec(`DROP INDEX IF EXISTS idx_agent_metrics_query_type;`);
	}
}
