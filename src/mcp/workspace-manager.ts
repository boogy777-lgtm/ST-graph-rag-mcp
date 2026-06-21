/**
 * WorkspaceManager — centralized state management for MCP server.
 *
 * Replaces module-level mutable globals (indexers, sqliteManagers, lastStats, activeWorkspace)
 * with a testable, encapsulated class using WorkspaceContext.
 *
 * Singleton pattern is justified here because the state is inherently process-level
 * (LSP clients, SQLite connections).
 */

import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import type { BatchIndexer } from "../st/batch-indexer";
import type { IndexStats } from "../st/indexer";
import { STIndexer } from "../st/indexer";
import { STSQLiteManager } from "../st/sqlite-manager";
import type { IndexerHooks } from "../telemetry/domain/ports";
import { noopHooks } from "../telemetry/domain/ports";

/**
 * Per-workspace context — всё состояние для одной директории.
 */
class WorkspaceContext {
	indexer: STIndexer | null = null;
	sqliteManager: STSQLiteManager | null = null;
	lastStats: IndexStats | null = null;
	batchIndexer: BatchIndexer | null = null;

	constructor(
		public workspaceDir: string,
		public dbPath: string,
	) {}
}

/**
 * WorkspaceManager — инкапсуляция глобального состояния.
 */
export class WorkspaceManager {
	private readonly contexts = new Map<string, WorkspaceContext>();
	private activeWorkspace: string = process.cwd();
	private indexerHooks: IndexerHooks = noopHooks;

	/**
	 * Inject telemetry hooks. Defaults to no-op (no telemetry).
	 * Called once at boot from src/index.ts after startTelemetry().
	 */
	setIndexerHooks(hooks: IndexerHooks): void {
		this.indexerHooks = hooks;
	}

	// === Workspace management ===

	resolveWs(workspace?: string): string {
		return resolve(workspace || this.activeWorkspace);
	}

	private getContext(workspace?: string): WorkspaceContext | undefined {
		return this.contexts.get(this.resolveWs(workspace));
	}

	private getOrCreateContext(workspace: string): WorkspaceContext {
		const ws = resolve(workspace);
		let ctx = this.contexts.get(ws);
		if (!ctx) {
			const dbPath = resolve(ws, ".code-graph-rag", "st-graph.db");
			ctx = new WorkspaceContext(ws, dbPath);
			this.contexts.set(ws, ctx);
		}
		return ctx;
	}

	setActiveWorkspace(workspace: string): void {
		this.activeWorkspace = resolve(workspace);
	}

	getActiveWorkspace(): string {
		return this.activeWorkspace;
	}

	// === SQLite Manager (dual-path recovery) ===

	/**
	 * Dual-path: hot-cache (in-memory indexer) → cold-cache (direct DB from disk).
	 */
	getSQLiteManager(workspace?: string): STSQLiteManager | null {
		const ws = this.resolveWs(workspace);
		const ctx = this.getContext(ws);

		// Path 1: in-memory indexer (hot-cache)
		if (ctx?.indexer) {
			const mgr = ctx.indexer.getSQLiteManager();
			if (mgr) return mgr;
		}

		// Path 2: direct SQLite from disk (survives process restart)
		if (ctx?.sqliteManager) return ctx.sqliteManager;

		const dbPath = resolve(ws, ".code-graph-rag", "st-graph.db");
		if (!existsSync(dbPath)) {
			mkdirSync(dirname(dbPath), { recursive: true });
		}

		try {
			const manager = new STSQLiteManager(dbPath);
			manager.initialize();
			const newCtx = this.getOrCreateContext(ws);
			newCtx.sqliteManager = manager;
			return manager;
		} catch (err) {
			console.error(`[WorkspaceManager] Failed to open DB at ${dbPath}:`, err);
			return null;
		}
	}

	// === Indexer (lazy reconstruction) ===

	/**
	 * Dual-path: hot-cache → lazy reconstruction from DB meta.
	 */
	async getIndexer(workspace?: string): Promise<STIndexer | null> {
		const ws = this.resolveWs(workspace);
		const ctx = this.getContext(ws);

		// Path 1: in-memory cache
		if (ctx?.indexer) return ctx.indexer;

		// Path 2: lazy reconstruction from DB meta
		const dbPath = resolve(ws, ".code-graph-rag", "st-graph.db");
		if (!existsSync(dbPath)) {
			mkdirSync(dirname(dbPath), { recursive: true });
		}

		try {
			const manager = new STSQLiteManager(dbPath);
			manager.initialize();
			const lspPath = manager.getMeta("lspPath");
			if (!lspPath) return null;
			if (!existsSync(lspPath)) {
				console.error(`[WorkspaceManager] LSP path not found: ${lspPath}`);
				return null;
			}

			const indexer = new STIndexer(lspPath, ws, undefined, this.indexerHooks);
			await indexer.start();
			const newCtx = this.getOrCreateContext(ws);
			newCtx.indexer = indexer;
			return indexer;
		} catch (err) {
			console.error(
				`[WorkspaceManager] Failed to reconstruct indexer for ${ws}:`,
				err,
			);
			return null;
		}
	}

	setIndexer(indexer: STIndexer | null, workspace?: string): void {
		const ws = this.resolveWs(workspace);
		if (indexer) {
			const ctx = this.getOrCreateContext(ws);
			ctx.indexer = indexer;
		} else {
			const ctx = this.getContext(ws);
			if (ctx) ctx.indexer = null;
		}
	}

	// === Batch Indexer ===

	getBatchIndexer(workspace?: string): BatchIndexer | null {
		return this.getContext(this.resolveWs(workspace))?.batchIndexer ?? null;
	}

	setBatchIndexer(batchIndexer: BatchIndexer | null, workspace?: string): void {
		const ws = this.resolveWs(workspace);
		if (batchIndexer) {
			const ctx = this.getOrCreateContext(ws);
			ctx.batchIndexer = batchIndexer;
		} else {
			const ctx = this.getContext(ws);
			if (ctx) ctx.batchIndexer = null;
		}
	}

	// === Stats ===

	getLastStats(workspace?: string): IndexStats | null {
		return this.getContext(this.resolveWs(workspace))?.lastStats ?? null;
	}

	setLastStats(workspace: string, stats: IndexStats): void {
		this.getOrCreateContext(workspace).lastStats = stats;
	}

	// === Path Normalization ===

	/**
	 * Recursively normalizes absolute paths to workspace-relative paths.
	 * Skipped if MCP_ABSOLUTE_PATHS=1.
	 */
	normalizePaths(obj: unknown, workspaceDir: string): unknown {
		if (process.env.MCP_ABSOLUTE_PATHS === "1") return obj;
		if (typeof obj !== "object" || obj === null) return obj;

		const ws = workspaceDir.replace(/\\/g, "/") + "/";

		if (Array.isArray(obj)) {
			return obj.map((item) => this.normalizePaths(item, workspaceDir));
		}

		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			if (typeof value === "string") {
				const normalized = value.replace(/\\/g, "/");
				if (normalized.startsWith(ws)) {
					result[key] = normalized.slice(ws.length);
				} else {
					result[key] = value;
				}
			} else if (typeof value === "object") {
				result[key] = this.normalizePaths(value, workspaceDir);
			} else {
				result[key] = value;
			}
		}
		return result;
	}

	// === Shutdown ===

	async shutdownAll(): Promise<void> {
		for (const [dir, ctx] of this.contexts) {
			try {
				if (ctx.batchIndexer) {
					await ctx.batchIndexer.cleanup();
					console.error(`[WorkspaceManager] Aborted batch sessions for ${dir}`);
				}
			} catch (err) {
				console.error(
					`[WorkspaceManager] Failed to abort batch sessions for ${dir}:`,
					err,
				);
			}

			try {
				if (ctx.indexer) {
					await ctx.indexer.stop();
					console.error(`[WorkspaceManager] Stopped indexer for ${dir}`);
				}
			} catch (err) {
				console.error(
					`[WorkspaceManager] Failed to stop indexer for ${dir}:`,
					err,
				);
			}
		}
		this.contexts.clear();
	}
}

/**
 * Singleton instance (process-level state).
 */
export const workspaceManager = new WorkspaceManager();
