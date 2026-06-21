/**
 * Main content area — switches between section views.
 *
 * Phase 3.0 sections:
 *   - Radar: live tail of telemetry events with kind-filter chips.
 *   - Graph: code-graph placeholder (Phase 3.1 will wire MCP tools).
 *   - Analytics: live metric cards derived from the event stream.
 *   - Settings: workspace + WS endpoint info, connection diagnostics.
 */

import { useMemo, useState, type ReactElement } from "react";
import {
	asSqliteStats,
	countByKind,
	type SectionId,
	type TelemetryEvent,
	type TelemetryEventKind,
} from "./types.js";
import { EventFilter } from "./EventFilter.js";
import { GraphCanvas } from "./GraphCanvas.js";
import { EventStream } from "./EventStream.js";
import { RadarPanel } from "./RadarPanel.js";
import {
	StatsPanel,
	countFailedFiles,
	deriveIndexRun,
	deriveLspStage,
} from "./StatsPanel.js";

interface MainPanelProps {
	readonly active: SectionId;
	readonly events: readonly TelemetryEvent[];
	readonly visibleKinds: ReadonlySet<TelemetryEventKind>;
	readonly onToggleKind: (kind: TelemetryEventKind) => void;
	readonly onClearFilter: () => void;
}

type RadarView = "ai" | "raw";

export function MainPanel({
	active,
	events,
	visibleKinds,
	onToggleKind,
	onClearFilter,
}: MainPanelProps): ReactElement {
	const filteredEvents = useMemo(() => {
		const hiddenKinds = new Set(["ws_client_connected", "ws_client_disconnected", "server_started", "server_stopped"]);
		return events.filter(e => !hiddenKinds.has(e.kind));
	}, [events]);

	const reversed = useMemo(() => [...filteredEvents].reverse(), [filteredEvents]);
	const counts = useMemo(() => countByKind(filteredEvents), [filteredEvents]);
	const [radarView, setRadarView] = useState<RadarView>("ai");

	return (
		<main className="flex-1 overflow-hidden bg-bg">
			<div className="flex h-full flex-col">
				<header className="flex items-center justify-between border-b border-border bg-panel px-6 py-3">
					<div>
						<h1 className="text-sm font-semibold capitalize text-fg">
							{active}
						</h1>
						<p className="text-[11px] text-fg-dim">{descriptionFor(active)}</p>
					</div>
					<div className="flex items-center gap-2">
						<span className="rounded bg-panel-2 px-2 py-0.5 text-[11px] text-fg-muted">
							Bun · bun:sqlite
						</span>
						<span className="rounded bg-panel-2 px-2 py-0.5 text-[11px] text-fg-muted">
							21 tools
						</span>
						<span className="rounded bg-panel-2 px-2 py-0.5 text-[11px] text-fg-muted">
							Phase 3.0
						</span>
					</div>
				</header>

				<div className="min-h-0 flex-1 overflow-hidden">
					{active === "radar" ? (
						<div className="flex h-full flex-col">
							<EventFilter
								counts={counts}
								visibleKinds={visibleKinds}
								onToggle={onToggleKind}
								onClear={onClearFilter}
							/>
							<RadarViewToggle value={radarView} onChange={setRadarView} />
							{radarView === "ai" ? (
								<RadarPanel events={filteredEvents} />
							) : (
								<EventStream events={reversed} visibleKinds={visibleKinds} />
							)}
						</div>
					) : active === "analytics" ? (
						<AnalyticsView events={events} />
					) : active === "graph" ? (
						<GraphCanvas />
					) : (
						<SettingsView />
					)}
				</div>
			</div>
		</main>
	);
}

function descriptionFor(id: SectionId): string {
	switch (id) {
		case "radar":
			return "AI Radar — live feed of MCP tool calls (tool_started → tool_completed / tool_failed).";
		case "graph":
			return "Explore POU call graph, type relationships, and impact radius.";
		case "analytics":
			return "Live SQLite metrics, LSP progress, and indexing hotspots.";
		case "settings":
			return "Workspace paths, WS endpoint, and connection diagnostics.";
	}
}

// ─── Analytics view (live metric cards) ───────────────────────────────────

interface AnalyticsViewProps {
	readonly events: readonly TelemetryEvent[];
}

import { HotspotsPanel } from "./HotspotsPanel.js";
import { HealthScore } from "./HealthScore.js";

// ... skipping to AnalyticsView component ...

function AnalyticsView({ events }: AnalyticsViewProps): ReactElement {
	const sqlite = useMemo(() => {
		for (let i = events.length - 1; i >= 0; i--) {
			const ev = events[i];
			if (ev !== undefined) {
				const s = asSqliteStats(ev);
				if (s !== null) return s;
			}
		}
		return null;
	}, [events]);

	const indexRun = useMemo(() => deriveIndexRun(events), [events]);
	const lspStage = useMemo(() => deriveLspStage(events), [events]);
	const failedFiles = useMemo(() => countFailedFiles(events), [events]);

	return (
		<div className="h-full overflow-y-auto">
			<StatsPanel
				sqlite={sqlite}
				indexRun={indexRun}
				lspStage={lspStage}
				totalEvents={events.length}
				failedFiles={failedFiles}
			/>
			<div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
				<HealthScore />
				<HotspotsPanel />
			</div>
			<div className="px-6 pb-6">
				<div className="rounded-lg border border-border bg-panel p-4">
					<div className="mb-2 text-[11px] uppercase tracking-wider text-fg-dim">
						Index run
					</div>
					{indexRun === null ? (
						<p className="text-xs text-fg-muted">
							No index run has been observed yet. Trigger one with the{" "}
							<span className="font-mono text-accent">index</span> MCP tool or
							wait for automatic indexing on workspace open.
						</p>
					) : (
						<dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
							<Field label="Status" value={indexRun.status} />
							<Field label="Workspace" value={indexRun.workspace} mono />
							<Field label="Indexed" value={String(indexRun.indexedFiles)} />
							<Field label="Skipped" value={String(indexRun.skippedFiles)} />
							<Field label="Entities" value={String(indexRun.totalEntities)} />
							<Field label="Edges" value={String(indexRun.totalEdges)} />
						</dl>
					)}
				</div>
			</div>
		</div>
	);
}

function Field({
	label,
	value,
	mono = false,
}: {
	readonly label: string;
	readonly value: string;
	readonly mono?: boolean;
}): ReactElement {
	return (
		<div>
			<dt className="text-fg-dim">{label}</dt>
			<dd className={`text-fg ${mono ? "font-mono" : ""} truncate`} title={value}>
				{value}
			</dd>
		</div>
	);
}

// Removed GraphPlaceholder

// ─── Settings view (connection diagnostics) ──────────────────────────────

function SettingsView(): ReactElement {
	const wsEndpoint = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;
	const httpEndpoint = `${location.protocol}//${location.host}/healthz`;

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="mx-auto max-w-2xl space-y-4">
				<Section title="Connection">
					<Row label="HTTP root" value={location.origin} mono />
					<Row label="WS endpoint" value={wsEndpoint} mono />
					<Row label="Health probe" value={httpEndpoint} mono />
				</Section>
				<Section title="Runtime">
					<Row label="Engine" value="Bun + Vite + React + Tailwind v4" />
					<Row label="Bundler" value="bun build --compile (single binary)" mono />
					<Row label="Database" value=".code-graph-rag/st-graph.db (SQLite v4)" mono />
					<Row label="LSP" value="trust-lsp.exe (Rust, native)" mono />
				</Section>
				<Section title="Phase 3.0 status">
					<Row label="UI skeleton" value="✓ ready" />
					<Row label="Vite + Tailwind" value="✓ ready" />
					<Row label="WS telemetry" value="✓ streaming" />
					<Row label="Static asset embed" value="✓ Bun.embeddedFiles" />
					<Row label="Graph renderer" value="Phase 3.1" />
					<Row label="Advanced analytics" value="Phase 3.2" />
				</Section>
			</div>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	readonly title: string;
	readonly children: ReactElement | readonly ReactElement[];
}): ReactElement {
	return (
		<div className="rounded-lg border border-border bg-panel p-4">
			<div className="mb-3 text-[11px] uppercase tracking-wider text-fg-dim">
				{title}
			</div>
			<dl className="space-y-1.5 text-xs">{children}</dl>
		</div>
	);
}

function Row({
	label,
	value,
	mono = false,
}: {
	readonly label: string;
	readonly value: string;
	readonly mono?: boolean;
}): ReactElement {
	return (
		<div className="flex items-baseline justify-between gap-3">
			<dt className="shrink-0 text-fg-muted">{label}</dt>
			<dd
				className={`min-w-0 truncate text-right text-fg ${mono ? "font-mono" : ""}`}
				title={value}
			>
				{value}
			</dd>
		</div>
	);
}

// ─── Radar view toggle (AI Radar vs Raw Events) ───────────────────────────

function RadarViewToggle({
	value,
	onChange,
}: {
	readonly value: RadarView;
	readonly onChange: (next: RadarView) => void;
}): ReactElement {
	const opts: readonly { readonly id: RadarView; readonly label: string }[] = [
		{ id: "ai", label: "AI Radar" },
		{ id: "raw", label: "Raw Events" },
	];
	return (
		<div className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-panel/30 px-6 py-1.5">
			<span className="mr-2 text-[11px] uppercase tracking-wider text-fg-dim">
				View
			</span>
			{opts.map((opt) => {
				const active = opt.id === value;
				return (
					<button
						key={opt.id}
						type="button"
						onClick={() => onChange(opt.id)}
						className={[
							"rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
							active
								? "border-accent bg-accent/15 text-accent"
								: "border-border text-fg-muted hover:border-fg-muted hover:text-fg",
						].join(" ")}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
