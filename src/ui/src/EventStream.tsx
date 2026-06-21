/**
 * EventStream — live tail of the telemetry event stream.
 *
 * Features (Phase 3.0):
 *   - Auto-stick to bottom while user hasn't scrolled up.
 *   - Color + icon per kind, fallback for unknown kinds.
 *   - Optional filter chips (via EventFilter component).
 *   - Empty-state placeholder.
 *
 * Events arrive newest-last; this component receives them in the order
 * the parent renders. The parent (`MainPanel`) is responsible for any
 * reverse-to-newest-first transformation if desired.
 */

import { useEffect, useMemo, useRef, type ReactElement } from "react";
import {
	countByKind,
	type TelemetryEvent,
	type TelemetryEventKind,
} from "./types.js";

interface EventStreamProps {
	readonly events: readonly TelemetryEvent[];
	/**
	 * If non-empty, only events whose `kind` is in this set are rendered.
	 * Default: render everything.
	 */
	readonly visibleKinds?: ReadonlySet<TelemetryEventKind>;
}

const KIND_COLOR: Readonly<Record<TelemetryEventKind, string>> = {
	// ─── Backend Phase 2.x ────────────────────────────────────────────
	lsp_progress: "text-fg",
	lsp_diagnostic: "text-warning",
	sqlite_stats: "text-accent",
	index_started: "text-accent",
	index_file_started: "text-fg-muted",
	index_file_done: "text-success",
	index_file_failed: "text-danger",
	index_done: "text-success",
	server_started: "text-success",
	server_stopped: "text-danger",
	ws_client_connected: "text-accent",
	ws_client_disconnected: "text-fg-dim",
	bus_overflow: "text-warning",
	// ─── AI-Radar (Phase 3.0 middleware) ──────────────────────────────
	tool_started: "text-warning",
	tool_completed: "text-success",
	tool_failed: "text-danger",
	// ─── Legacy Phase 1.x ─────────────────────────────────────────────
	index_progress: "text-fg",
	index_completed: "text-success",
	index_failed: "text-danger",
	lsp_spawned: "text-accent",
	lsp_exited: "text-warning",
	file_indexed: "text-fg-muted",
	diagnostic: "text-warning",
};

const KIND_ICON: Readonly<Record<TelemetryEventKind, string>> = {
	// ─── Backend Phase 2.x ────────────────────────────────────────────
	lsp_progress: "·",
	lsp_diagnostic: "⚠",
	sqlite_stats: "Σ",
	index_started: "⟶",
	index_file_started: "▸",
	index_file_done: "✓",
	index_file_failed: "✗",
	index_done: "■",
	server_started: "▶",
	server_stopped: "■",
	ws_client_connected: "⇆",
	ws_client_disconnected: "⇄",
	bus_overflow: "!",
	// ─── AI-Radar (Phase 3.0 middleware) ──────────────────────────────
	tool_started: "●",
	tool_completed: "✓",
	tool_failed: "✗",
	// ─── Legacy Phase 1.x ─────────────────────────────────────────────
	index_progress: "·",
	index_completed: "✓",
	index_failed: "✗",
	lsp_spawned: "⟴",
	lsp_exited: "⟵",
	file_indexed: "·",
	diagnostic: "⚠",
};

export function EventStream({
	events,
	visibleKinds,
}: EventStreamProps): ReactElement {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const stickToBottom = useRef(true);

	useEffect(() => {
		const el = containerRef.current;
		if (el === null) return;
		const onScroll = (): void => {
			const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
			stickToBottom.current = distanceFromBottom < 32;
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, []);

	const visible = useMemo(() => {
		if (visibleKinds === undefined || visibleKinds.size === 0) return events;
		return events.filter((ev) => visibleKinds.has(ev.kind));
	}, [events, visibleKinds]);

	useEffect(() => {
		const el = containerRef.current;
		if (el === null || !stickToBottom.current) return;
		el.scrollTop = el.scrollHeight;
	}, [visible.length]);

	if (events.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-fg-dim">
				Waiting for telemetry events…
			</div>
		);
	}

	if (visible.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-fg-dim">
				No events match the current filter.
			</div>
		);
	}

	const counts = countByKind(events);

	return (
		<div className="flex h-full flex-col">
			<div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-panel px-6 py-1.5 text-[11px] text-fg-dim">
				<span>
					showing{" "}
					<span className="font-mono text-fg">{visible.length}</span>
					{visible.length !== events.length && (
						<>
							{" of "}
							<span className="font-mono text-fg">{events.length}</span>
						</>
					)}{" "}
					event{events.length === 1 ? "" : "s"}
				</span>
				<span className="font-mono">{counts.size} kind{counts.size === 1 ? "" : "s"}</span>
			</div>
			<div
				ref={containerRef}
				className="min-h-0 flex-1 overflow-y-auto px-6 py-3 font-mono text-[12px] leading-relaxed"
			>
				{visible.map((ev) => (
					<Row key={ev.id} ev={ev} />
				))}
			</div>
		</div>
	);
}

function Row({ ev }: { ev: TelemetryEvent }): ReactElement {
	const colorClass = KIND_COLOR[ev.kind] ?? "text-fg";
	const icon = KIND_ICON[ev.kind] ?? "·";
	const time = formatTime(ev.ts);
	const payload = stringifyPayload(ev);

	return (
		<div className="flex gap-3 border-b border-border/40 py-1 hover:bg-panel-2/40">
			<span className="w-20 shrink-0 text-fg-dim">{time}</span>
			<span className={`w-4 shrink-0 text-center ${colorClass}`}>{icon}</span>
			<span className={`w-44 shrink-0 ${colorClass}`}>{ev.kind}</span>
			<span className="min-w-0 flex-1 truncate text-fg-muted">{payload}</span>
		</div>
	);
}

function formatTime(ts: number): string {
	const d = new Date(ts);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	const ss = String(d.getSeconds()).padStart(2, "0");
	const ms = String(d.getMilliseconds()).padStart(3, "0");
	return `${hh}:${mm}:${ss}.${ms}`;
}

function stringifyPayload(ev: TelemetryEvent): string {
	const skip = new Set(["id", "ts", "kind"]);
	const entries: string[] = [];
	for (const [k, v] of Object.entries(ev)) {
		if (skip.has(k)) continue;
		entries.push(`${k}=${formatValue(v)}`);
	}
	return entries.length === 0 ? "—" : entries.join(" ");
}

function formatValue(v: unknown): string {
	if (typeof v === "string") return JSON.stringify(v);
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	if (v === null) return "null";
	return JSON.stringify(v);
}
