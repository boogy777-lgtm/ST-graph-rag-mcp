/**
 * Telemetry Ports (Hexagonal: domain-facing interfaces for adapters)
 *
 * Producers (indexer, sqlite, ws-server) call these hooks; the application
 * layer wires them to the telemetry bus. Application code never imports
 * the WS server or indexer directly — only this interface.
 */

import type { TelemetryEventDraft } from "./events.js";

/**
 * Hook surface for the indexer + persistence layer.
 *
 * Every method is fire-and-forget: producers MUST NOT await telemetry
 * (we don't want a slow UI to backpressure indexing).
 *
 * All methods are optional-safe: a no-op default is provided by `noopHooks`,
 * so non-instrumented tests don't need to wire anything.
 */
export interface IndexerHooks {
	/** LSP progress update for a file (per-stage granularity). */
	onLspProgress(input: {
		file: string;
		current: number;
		total: number;
		stage:
			| "preparing"
			| "lsp_open"
			| "parsing"
			| "extracting"
			| "building_edges"
			| "resolving"
			| "persisting"
			| "cleanup"
			| "done";
	}): void;

	/** Single LSP diagnostic emitted for a file. */
	onLspDiagnostic(input: {
		file: string;
		line: number;
		severity: "error" | "warning" | "info" | "hint";
		message: string;
	}): void;

	/** Periodic snapshot of SQLite graph state. */
	onSqliteStats(input: {
		pous: number;
		variables: number;
		types: number;
		relationships: number;
		files: number;
		dbBytes: number;
	}): void;

	/** Indexing of a workspace started. */
	onIndexStarted(input: { workspace: string; totalFiles: number }): void;

	/** Per-file indexing started. */
	onIndexFileStarted(input: {
		file: string;
		index: number;
		total: number;
	}): void;

	/** Per-file indexing done. */
	onIndexFileDone(input: {
		file: string;
		index: number;
		total: number;
		entities: number;
		edges: number;
		durationMs: number;
	}): void;

	/** Per-file indexing failed. */
	onIndexFileFailed(input: {
		file: string;
		index: number;
		total: number;
		error: string;
	}): void;

	/** Workspace-level indexing done. */
	onIndexDone(input: {
		workspace: string;
		indexedFiles: number;
		skippedFiles: number;
		totalEntities: number;
		totalEdges: number;
		totalTimeMs: number;
	}): void;
}

/**
 * Cheap no-op implementation for tests and un-instrumented call sites.
 * All methods do nothing — no allocation, no closure capture.
 */
export const noopHooks: IndexerHooks = {
	onLspProgress: () => {},
	onLspDiagnostic: () => {},
	onSqliteStats: () => {},
	onIndexStarted: () => {},
	onIndexFileStarted: () => {},
	onIndexFileDone: () => {},
	onIndexFileFailed: () => {},
	onIndexDone: () => {},
};

/**
 * Bridge an IndexerHooks view to a generic TelemetryEvent sink.
 *
 * This adapter lets the indexer depend only on `IndexerHooks`
 * (its native vocabulary) while the bus (which speaks TelemetryEventDraft)
 * receives well-formed events. Keeps the dependency direction:
 *
 *   indexer → IndexerHooks → [this adapter] → TelemetryEventDraft → Bus
 */
export function hooksToEventSink(
	publish: (draft: TelemetryEventDraft) => void,
): IndexerHooks {
	return {
		onLspProgress: (i) => publish({ kind: "lsp_progress", ...i }),
		onLspDiagnostic: (i) => publish({ kind: "lsp_diagnostic", ...i }),
		onSqliteStats: (i) => publish({ kind: "sqlite_stats", ...i }),
		onIndexStarted: (i) => publish({ kind: "index_started", ...i }),
		onIndexFileStarted: (i) => publish({ kind: "index_file_started", ...i }),
		onIndexFileDone: (i) => publish({ kind: "index_file_done", ...i }),
		onIndexFileFailed: (i) => publish({ kind: "index_file_failed", ...i }),
		onIndexDone: (i) => publish({ kind: "index_done", ...i }),
	};
}
