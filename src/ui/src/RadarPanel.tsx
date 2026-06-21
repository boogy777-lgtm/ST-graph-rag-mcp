/**
 * RadarPanel — "AI Radar": live feed of MCP tool calls.
 *
 * Subscribes to the same event stream as EventStream, but groups events by
 * `callId` so the user sees a logical "one row per AI call" view, with the
 * current status surfaced visually:
 *
 *   🟡 Running   — `tool_started` seen, no terminal event yet
 *   🟢 Completed — `tool_completed` seen, with `durationMs`
 *   🔴 Failed    — `tool_failed` seen, with `durationMs` + error message
 *
 * Keeps the last 50 calls (configurable via prop). Renders above the
 * generic EventStream so the user always sees the live AI activity first;
 * the raw event log is still available for forensic drilling.
 */

import { useMemo, type ReactElement } from "react";
import {
	deriveToolCalls,
	type ToolCallRow,
	type ToolCallStatus,
} from "./types.js";

interface RadarPanelProps {
	readonly events: readonly import("./types.js").TelemetryEvent[];
	readonly limit?: number;
}

export function RadarPanel({ events, limit = 50 }: RadarPanelProps): ReactElement {
	const rows = useMemo(() => deriveToolCalls(events, limit), [events, limit]);

	const summary = useMemo(() => summarize(rows), [rows]);

	if (rows.length === 0) {
		return (
			<div className="flex h-full items-center justify-center px-6 text-center text-xs text-fg-dim">
				Waiting for AI tool calls… the radar will light up as soon as the
				MCP client invokes its first tool.
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-panel px-6 py-2 text-[11px] text-fg-dim">
				<span>
					<span className="font-mono text-fg">{rows.length}</span> call
					{rows.length === 1 ? "" : "s"} tracked
				</span>
				<span className="flex items-center gap-3 font-mono">
					<Legend tone="running" label={`${summary.running} running`} />
					<Legend tone="completed" label={`${summary.completed} ok`} />
					<Legend tone="failed" label={`${summary.failed} failed`} />
				</span>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-6 py-3 font-mono text-[12px]">
				{rows.map((row) => (
					<CallRow key={row.callId} row={row} />
				))}
			</div>
		</div>
	);
}

function Legend({
	tone,
	label,
}: {
	readonly tone: ToolCallStatus;
	readonly label: string;
}): ReactElement {
	const color =
		tone === "running"
			? "text-warning"
			: tone === "completed"
				? "text-success"
				: "text-danger";
	return (
		<span className="flex items-center gap-1">
			<span className={color}>{iconFor(tone)}</span>
			<span className="text-fg-muted">{label}</span>
		</span>
	);
}

function CallRow({ row }: { row: ToolCallRow }): ReactElement {
	const time = formatTime(row.startedAt || 0);
	const tone = row.status;

	return (
		<div
			className="flex flex-col gap-1 border-b border-border/40 py-2 hover:bg-panel-2/40"
			title={String(row.callId)}
		>
			<div className="flex items-baseline gap-3">
				<span className="w-20 shrink-0 text-fg-dim">{time}</span>
				<span
					className={[
						"w-4 shrink-0 text-center",
						tone === "running"
							? "text-warning"
							: tone === "completed"
								? "text-success"
								: "text-danger",
					].join(" ")}
				>
					{iconFor(tone)}
				</span>
				<span className="w-40 shrink-0 truncate text-fg" title={String(row.tool)}>
					{String(row.tool)}
				</span>
				<span className="min-w-0 flex-1 truncate text-fg-muted">
					{String(row.argsPreview || "")}
				</span>
				<span className="shrink-0 text-fg-dim">{formatDuration(row)}</span>
			</div>
			{row.status === "failed" && row.error !== null && (
				<div className="ml-24 truncate text-[11px] text-danger" title={String(row.error)}>
					{String(row.error)}
				</div>
			)}
		</div>
	);
}

function iconFor(status: ToolCallStatus): string {
	switch (status) {
		case "running":
			return "●";
		case "completed":
			return "✓";
		case "failed":
			return "✗";
	}
}

function formatDuration(row: ToolCallRow): string {
	if (row.status === "running") return "…";
	const ms = row.durationMs ?? 0;
	if (ms < 1000) return `${ms} ms`;
	return `${(ms / 1000).toFixed(2)} s`;
}

function formatTime(ts: number): string {
	const d = new Date(ts);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	const ss = String(d.getSeconds()).padStart(2, "0");
	const ms = String(d.getMilliseconds()).padStart(3, "0");
	return `${hh}:${mm}:${ss}.${ms}`;
}

function summarize(
	rows: readonly ToolCallRow[],
): { running: number; completed: number; failed: number } {
	let running = 0;
	let completed = 0;
	let failed = 0;
	for (const r of rows) {
		if (r.status === "running") running++;
		else if (r.status === "completed") completed++;
		else failed++;
	}
	return { running, completed, failed };
}
