/**
 * Sidebar — left navigation + footer.
 *
 * Phase 3.0: adds a live event-count badge per section so the user can
 * see at a glance whether the WS feed is active and which sections have
 * meaningful data.
 */

import type { ReactElement } from "react";
import { type SectionId, type TelemetryEventKind } from "./types.js";

interface SidebarProps {
	readonly active: SectionId;
	readonly onSelect: (next: SectionId) => void;
	readonly sections: readonly SectionId[];
	readonly eventCount: number;
	readonly visibleKinds: ReadonlySet<TelemetryEventKind>;
}

interface SectionMeta {
	readonly label: string;
	readonly hint: string;
}

const SECTION_LABELS: Readonly<Record<SectionId, SectionMeta>> = {
	radar: { label: "Radar", hint: "Real-time event stream" },
	graph: { label: "Graph", hint: "Code graph exploration" },
	analytics: { label: "Analytics", hint: "Metrics & hotspots" },
	settings: { label: "Settings", hint: "Workspace & LSP config" },
};

const ICONS: Readonly<Record<SectionId, ReactElement>> = {
	radar: <RadarIcon />,
	graph: <GraphIcon />,
	analytics: <AnalyticsIcon />,
	settings: <SettingsIcon />,
};

export function Sidebar({
	active,
	onSelect,
	sections,
	eventCount,
	visibleKinds,
}: SidebarProps): ReactElement {
	const filterActive = visibleKinds.size > 0;

	return (
		<aside className="flex w-56 shrink-0 flex-col border-r border-border bg-panel">
			<div className="flex items-center gap-2 border-b border-border px-4 py-3">
				<div className="size-6 rounded bg-accent" aria-hidden />
				<div className="flex flex-col leading-tight">
					<span className="text-sm font-semibold text-fg">ST-Graph</span>
					<span className="text-[10px] uppercase tracking-wider text-fg-dim">
						RAG · MCP · v3.0
					</span>
				</div>
			</div>

			<nav className="flex-1 overflow-y-auto py-2">
				{sections.map((id) => {
					const isActive = id === active;
					const meta = SECTION_LABELS[id];
					const badge = sectionBadge(id, eventCount, filterActive);
					return (
						<button
							key={id}
							type="button"
							onClick={() => onSelect(id)}
							className={[
								"group flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
								isActive
									? "bg-panel-2 text-fg"
									: "text-fg-muted hover:bg-panel-2/50 hover:text-fg",
							].join(" ")}
						>
							<span
								className={[
									"flex size-5 items-center justify-center",
									isActive ? "text-accent" : "text-fg-dim group-hover:text-fg-muted",
								].join(" ")}
								aria-hidden
							>
								{ICONS[id]}
							</span>
							<span className="flex flex-1 flex-col leading-tight">
								<span className="flex items-center gap-2">
									<span className="font-medium">{meta.label}</span>
									{badge !== null && (
										<span
											className={[
												"rounded-full px-1.5 py-px font-mono text-[10px]",
												badge.tone === "accent"
													? "bg-accent/20 text-accent"
													: badge.tone === "muted"
														? "bg-panel-2 text-fg-dim"
														: "bg-panel-2 text-fg-muted",
											].join(" ")}
										>
											{badge.value}
										</span>
									)}
								</span>
								<span className="text-[10px] text-fg-dim">{meta.hint}</span>
							</span>
						</button>
					);
				})}
			</nav>

			<div className="border-t border-border px-4 py-3 text-[11px] text-fg-dim">
				<div className="flex items-center justify-between">
					<span>Bun · bun:sqlite</span>
					<span className="rounded bg-panel-2 px-1.5 py-0.5 text-fg-muted">
						local
					</span>
				</div>
				<div className="mt-1">LSP-only · 21 tools</div>
				{filterActive && (
					<div className="mt-1 text-accent">
						{visibleKinds.size} filter{visibleKinds.size === 1 ? "" : "s"} active
					</div>
				)}
			</div>
		</aside>
	);
}

/**
 * Compute a small badge for each section: total events for Radar,
 * presence indicator for Analytics, "3.1" for Graph, etc.
 */
function sectionBadge(
	id: SectionId,
	eventCount: number,
	filterActive: boolean,
): { value: string; tone: "accent" | "muted" | "neutral" } | null {
	switch (id) {
		case "radar":
			if (eventCount === 0) return { value: "0", tone: "muted" };
			return {
				value: filterActive ? `${eventCount}*` : String(eventCount),
				tone: filterActive ? "accent" : "neutral",
			};
		case "analytics":
			return { value: eventCount > 0 ? "live" : "idle", tone: eventCount > 0 ? "accent" : "muted" };
		case "graph":
			return { value: "3.1", tone: "muted" };
		case "settings":
			return null;
	}
}

// ─── Inline icons (no extra deps) ─────────────────────────────────────────

function RadarIcon(): ReactElement {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="12" r="5" />
			<circle cx="12" cy="12" r="1.5" fill="currentColor" />
			<line x1="12" y1="12" x2="20" y2="6" />
		</svg>
	);
}

function GraphIcon(): ReactElement {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
			<circle cx="6" cy="6" r="2" />
			<circle cx="18" cy="6" r="2" />
			<circle cx="12" cy="18" r="2" />
			<line x1="7.5" y1="7" x2="16.5" y2="7" />
			<line x1="7.5" y1="7" x2="11" y2="16.5" />
			<line x1="16.5" y1="7" x2="13" y2="16.5" />
		</svg>
	);
}

function AnalyticsIcon(): ReactElement {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
			<line x1="4" y1="20" x2="20" y2="20" />
			<rect x="6" y="11" width="3" height="7" />
			<rect x="11" y="6" width="3" height="12" />
			<rect x="16" y="14" width="3" height="4" />
		</svg>
	);
}

function SettingsIcon(): ReactElement {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
		</svg>
	);
}
