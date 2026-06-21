/**
 * Domain types shared between UI components and the WS client.
 *
 * MUST stay in sync with `src/telemetry/domain/events.ts` on the backend.
 * The backend serializes TelemetryEvent to JSON over WebSocket; the UI
 * consumes the same shape via `TelemetryEventSchema` runtime guards.
 */

/** Backend → client notification envelope. */
export type ServerMessage =
	| { readonly type: "events"; readonly events: readonly TelemetryEvent[] }
	| {
			readonly type: "hello";
			readonly serverVersion: string;
			readonly now: number;
	  };

/** Client → backend replay request. */
export type ClientMessage = {
	readonly type: "replay";
	readonly sinceId: number;
};

/**
 * Mirrors `TelemetryEvent` from the backend. The `kind` discriminant is
 * intentionally a string union — adding a new event kind on the backend
 * surfaces as a TS error here when we extend the discriminated switch.
 *
 * Phase 3.0: unified with the actual `EventKind` from
 * `src/telemetry/domain/events.ts`. Legacy Phase 2 kinds are kept for
 * backward compatibility with any in-flight buffered events.
 */
export type TelemetryEventKind =
	// ─── Backend Phase 2.x (actual) ────────────────────────────────────
	| "lsp_progress"
	| "lsp_diagnostic"
	| "sqlite_stats"
	| "index_started"
	| "index_file_started"
	| "index_file_done"
	| "index_file_failed"
	| "index_done"
	| "ws_client_connected"
	| "ws_client_disconnected"
	| "server_started"
	| "server_stopped"
	| "bus_overflow"
	// ─── AI-Radar (Phase 3.0 middleware) ──────────────────────────────
	| "tool_started"
	| "tool_completed"
	| "tool_failed"
	// ─── Legacy Phase 1.x kinds (kept for replay safety) ───────────────
	| "index_progress"
	| "index_completed"
	| "index_failed"
	| "lsp_spawned"
	| "lsp_exited"
	| "file_indexed"
	| "diagnostic";

/**
 * Event payloads are intentionally `unknown` on the wire — the UI only
 * cares about `kind`, `id`, and `ts` for now. When we add per-kind
 * rendering we will narrow with type predicates, never with `any`.
 */
export interface TelemetryEvent {
	readonly id: number;
	readonly ts: number;
	readonly kind: TelemetryEventKind;
	readonly [extra: string]: unknown;
}

/** Connection state surfaced to UI components. */
export type WsConnectionState =
	| { readonly status: "connecting" }
	| { readonly status: "open"; readonly since: number }
	| {
			readonly status: "closed";
			readonly code: number;
			readonly reason: string;
	  }
	| { readonly status: "error"; readonly message: string };

/** Sidebar section id — discriminated union for exhaustive routing. */
export type SectionId = "radar" | "graph" | "analytics" | "settings";

export interface SectionMeta {
	readonly id: SectionId;
	readonly label: string;
	readonly badge?: string;
}

/**
 * SQLite statistics extracted from a `sqlite_stats` event. Used by the
 * Analytics section to render metric cards.
 */
export interface SqliteStats {
	readonly pous: number;
	readonly variables: number;
	readonly types: number;
	readonly relationships: number;
	readonly files: number;
	readonly dbBytes: number;
}

/**
 * Aggregated index run summary. Derived from `index_started` +
 * `index_done` events seen in the live stream. Used by the Radar header
 * and Analytics section.
 */
export interface IndexRunSummary {
	readonly workspace: string;
	readonly totalFiles: number;
	readonly indexedFiles: number;
	readonly skippedFiles: number;
	readonly totalEntities: number;
	readonly totalEdges: number;
	readonly totalTimeMs: number;
	readonly status: "running" | "completed" | "failed";
}

/** Runtime guard for messages arriving on the WebSocket. */
export function isTelemetryEvent(value: unknown): value is TelemetryEvent {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.id === "number" &&
		typeof v.ts === "number" &&
		typeof v.kind === "string"
	);
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
	if (typeof raw !== "object" || raw === null) return null;
	const v = raw as Record<string, unknown>;
	if (v.type === "events" && Array.isArray(v.events)) {
		const events: TelemetryEvent[] = [];
		for (const ev of v.events) {
			if (isTelemetryEvent(ev)) events.push(ev);
		}
		return { type: "events", events };
	}
	if (v.type === "hello" && typeof v.serverVersion === "string") {
		return {
			type: "hello",
			serverVersion: v.serverVersion,
			now: typeof v.now === "number" ? v.now : Date.now(),
		};
	}
	return null;
}

/**
 * Narrow a `TelemetryEvent` to `SqliteStats`. Returns `null` if the event
 * is not a `sqlite_stats` event or if any required field is missing.
 */
export function asSqliteStats(ev: TelemetryEvent): SqliteStats | null {
	if (ev.kind !== "sqlite_stats") return null;
	if (
		typeof ev.pous !== "number" ||
		typeof ev.variables !== "number" ||
		typeof ev.types !== "number" ||
		typeof ev.relationships !== "number" ||
		typeof ev.files !== "number" ||
		typeof ev.dbBytes !== "number"
	) {
		return null;
	}
	return {
		pous: ev.pous,
		variables: ev.variables,
		types: ev.types,
		relationships: ev.relationships,
		files: ev.files,
		dbBytes: ev.dbBytes,
	};
}

/**
 * Build a count-by-kind map for the live event stream. Used by the
 * Sidebar badge and the EventFilter component.
 *
 * @returns a `Map<kind, count>` containing every kind seen, in insertion order.
 */
export function countByKind(
	events: readonly TelemetryEvent[],
): ReadonlyMap<TelemetryEventKind, number> {
	const out = new Map<TelemetryEventKind, number>();
	for (const ev of events) {
		out.set(ev.kind, (out.get(ev.kind) ?? 0) + 1);
	}
	return out;
}

// ─── AI-Radar (Phase 3.0 middleware) ──────────────────────────────────────

/** Correlated group of tool events for a single MCP call. */
export type ToolCallStatus = "running" | "completed" | "failed";

export interface ToolCallRow {
	readonly callId: string;
	readonly tool: string;
	readonly startedAt: number;
	readonly argsPreview: string;
	readonly durationMs: number | null;
	readonly status: ToolCallStatus;
	readonly error: string | null;
}

/**
 * Build a per-call aggregation of all `tool_*` events seen so far.
 *
 * Algorithm:
 *   1. Walk events in arrival order (oldest → newest).
 *   2. On `tool_started` create a new row in `running` state.
 *   3. On `tool_completed`/`tool_failed` promote the matching row.
 *   4. Keep only the last `limit` rows (newest-first in the returned array).
 *
 * Unmatched completion/failure events (e.g. arrived via replay before the
 * matching start) are surfaced as a synthetic row with durationMs = 0.
 */
export function deriveToolCalls(
	events: readonly TelemetryEvent[],
	limit = 50,
): readonly ToolCallRow[] {
	const rows = new Map<string, ToolCallRow>();
	for (const ev of events) {
		if (ev.kind === "tool_started") {
			const callId = stringField(ev, "callId");
			const tool = stringField(ev, "tool");
			if (callId === null || tool === null) continue;
			rows.set(callId, {
				callId,
				tool,
				startedAt: ev.ts,
				argsPreview: stringField(ev, "argsPreview") ?? "",
				durationMs: null,
				status: "running",
				error: null,
			});
			continue;
		}
		if (ev.kind === "tool_completed" || ev.kind === "tool_failed") {
			const callId = stringField(ev, "callId");
			const tool = stringField(ev, "tool");
			if (callId === null || tool === null) continue;
			const existing = rows.get(callId);
			const durationMs = numberField(ev, "durationMs") ?? 0;
			if (ev.kind === "tool_completed") {
				rows.set(callId, {
					callId,
					tool,
					startedAt: existing?.startedAt ?? ev.ts - durationMs,
					argsPreview: existing?.argsPreview ?? "",
					durationMs,
					status: "completed",
					error: null,
				});
			} else {
				rows.set(callId, {
					callId,
					tool,
					startedAt: existing?.startedAt ?? ev.ts - durationMs,
					argsPreview: existing?.argsPreview ?? "",
					durationMs,
					status: "failed",
					error: stringField(ev, "error") ?? "(unknown error)",
				});
			}
		}
	}
	const ordered = Array.from(rows.values()).sort(
		(a, b) => (b.startedAt || 0) - (a.startedAt || 0),
	);
	return ordered.slice(0, limit);
}

function stringField(ev: TelemetryEvent, key: string): string | null {
	const v = ev[key];
	return typeof v === "string" ? v : null;
}

function numberField(ev: TelemetryEvent, key: string): number | null {
	const v = ev[key];
	return typeof v === "number" ? v : null;
}
