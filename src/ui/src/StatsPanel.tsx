/**
 * StatsPanel — live metric cards derived from the telemetry stream.
 *
 * Shows the latest values seen for:
 *   - SQLite stats (pous / variables / types / relationships / files / dbBytes)
 *   - Index run progress (current / total + ETA + failures)
 *   - LSP progress (current stage)
 *   - Connection diagnostics
 *
 * Pure presentational: receives a derived snapshot from the parent and
 * renders a grid of cards. No subscriptions, no hooks.
 */

import type { ReactElement } from "react";
import type { IndexRunSummary, SqliteStats, TelemetryEvent } from "./types.js";

interface StatsPanelProps {
	readonly sqlite: SqliteStats | null;
	readonly indexRun: IndexRunSummary | null;
	readonly lspStage: string | null;
	readonly totalEvents: number;
	readonly failedFiles: number;
}

export function StatsPanel({
	sqlite,
	indexRun,
	lspStage,
	totalEvents,
	failedFiles,
}: StatsPanelProps): ReactElement {
	return (
		<div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
			<Card
				label="POUs"
				value={sqlite?.pous ?? "—"}
				hint="FUNCTION_BLOCK / PROGRAM / FUNCTION / METHOD"
				accent="accent"
			/>
			<Card
				label="Variables"
				value={sqlite?.variables ?? "—"}
				hint="across all VAR sections"
				accent="fg"
			/>
			<Card
				label="Types"
				value={sqlite?.types ?? "—"}
				hint="DUT / STRUCT / ENUM / ALIAS"
				accent="fg"
			/>
			<Card
				label="Relationships"
				value={sqlite?.relationships ?? "—"}
				hint="CALLS / USES_TYPE / INHERITS / IMPLEMENTS"
				accent="fg"
			/>
			<Card
				label="Files indexed"
				value={
					indexRun === null
						? (sqlite?.files ?? "—")
						: `${indexRun.indexedFiles}/${indexRun.totalFiles}`
				}
				hint={
					indexRun === null
						? "in SQLite"
						: `in ${(indexRun.totalTimeMs / 1000).toFixed(1)}s`
				}
				accent={failedFiles > 0 ? "danger" : "success"}
			/>
			<Card
				label="DB size"
				value={sqlite === null ? "—" : formatBytes(sqlite.dbBytes)}
				hint=".code-graph-rag/st-graph.db"
				accent="fg"
			/>
			<Card
				label="LSP stage"
				value={lspStage ?? "—"}
				hint="trust-lsp · Rust · release"
				accent="accent"
			/>
			<Card
				label="Events buffered"
				value={totalEvents}
				hint={`${failedFiles} file failures`}
				accent={failedFiles > 0 ? "warning" : "fg"}
			/>
		</div>
	);
}

type Accent = "accent" | "success" | "warning" | "danger" | "fg";

interface CardProps {
	readonly label: string;
	readonly value: string | number;
	readonly hint: string;
	readonly accent: Accent;
}

function Card({ label, value, hint, accent }: CardProps): ReactElement {
	const valueClass =
		accent === "accent"
			? "text-accent"
			: accent === "success"
				? "text-success"
				: accent === "warning"
					? "text-warning"
					: accent === "danger"
						? "text-danger"
						: "text-fg";

	return (
		<div className="rounded-lg border border-border bg-panel p-4">
			<div className="text-[11px] uppercase tracking-wider text-fg-dim">
				{label}
			</div>
			<div className={`mt-1 font-mono text-2xl ${valueClass}`}>{value}</div>
			<div className="mt-1 truncate text-[11px] text-fg-muted" title={hint}>
				{hint}
			</div>
		</div>
	);
}

/**
 * Format a byte count as a short human-readable string.
 *
 * @param n number of bytes (non-negative)
 * @returns formatted string like "12.4 KB" or "3.1 MB"
 */
export function formatBytes(n: number): string {
	if (!Number.isFinite(n) || n < 0) return "—";
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
	return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Derive a run summary from the live event stream.
 *
 * Looks at `index_started` (anchor), `index_file_done` / `index_file_failed`
 * (progress), and `index_done` (terminal) events. Falls back to `null`
 * if no index run has been observed.
 *
 * Pure function — pure data → summary, no side effects.
 */
export function deriveIndexRun(
	events: readonly TelemetryEvent[],
): IndexRunSummary | null {
	let started: TelemetryEvent | null = null;
	let done: TelemetryEvent | null = null;
	let indexed = 0;
	let skipped = 0;
	let entities = 0;
	let edges = 0;
	let failed = 0;
	let elapsed = 0;

	for (const ev of events) {
		if (ev.kind === "index_started") {
			started = ev;
			done = null;
			indexed = 0;
			skipped = 0;
			entities = 0;
			edges = 0;
			failed = 0;
			elapsed = 0;
			continue;
		}
		if (ev.kind === "index_done") {
			done = ev;
			elapsed = typeof ev.totalTimeMs === "number" ? ev.totalTimeMs : 0;
			indexed = typeof ev.indexedFiles === "number" ? ev.indexedFiles : indexed;
			skipped = typeof ev.skippedFiles === "number" ? ev.skippedFiles : skipped;
			entities = typeof ev.totalEntities === "number" ? ev.totalEntities : entities;
			edges = typeof ev.totalEdges === "number" ? ev.totalEdges : edges;
			continue;
		}
		if (ev.kind === "index_file_done" && done === null) {
			indexed++;
			if (typeof ev.entities === "number") entities += ev.entities;
			if (typeof ev.edges === "number") edges += ev.edges;
			continue;
		}
		if (ev.kind === "index_file_failed" && done === null) {
			failed++;
			continue;
		}
		// Legacy kind aliases.
		if (ev.kind === "index_completed") {
			done = ev;
			elapsed = typeof ev.duration === "number" ? ev.duration : 0;
			continue;
		}
	}

	if (started === null && done === null && indexed === 0) return null;

	const totalFiles =
		typeof started?.totalFiles === "number"
			? started.totalFiles
			: typeof done?.indexedFiles === "number"
				? done.indexedFiles + skipped + failed
				: indexed + skipped + failed;

	const status: IndexRunSummary["status"] =
		done !== null ? "completed" : failed > 0 ? "failed" : "running";

	const workspace =
		typeof started?.workspace === "string"
			? started.workspace
			: typeof done?.workspace === "string"
				? done.workspace
				: "(unknown)";

	return {
		workspace,
		totalFiles,
		indexedFiles: indexed,
		skippedFiles: skipped,
		totalEntities: entities,
		totalEdges: edges,
		totalTimeMs: elapsed,
		status,
	};
}

/**
 * Extract the latest LSP stage from the stream (or null if none seen).
 */
export function deriveLspStage(events: readonly TelemetryEvent[]): string | null {
	for (let i = events.length - 1; i >= 0; i--) {
		const ev = events[i];
		if (ev !== undefined && ev.kind === "lsp_progress") {
			const stage = (ev as Record<string, unknown>).stage;
			if (typeof stage === "string") return stage;
		}
	}
	return null;
}

/**
 * Count file failures in the stream.
 */
export function countFailedFiles(events: readonly TelemetryEvent[]): number {
	let n = 0;
	for (const ev of events) {
		if (ev.kind === "index_file_failed" || ev.kind === "index_failed") n++;
	}
	return n;
}
