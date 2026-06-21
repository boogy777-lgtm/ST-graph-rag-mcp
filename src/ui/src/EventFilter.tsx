/**
 * EventFilter — chip row to toggle visibility of event kinds.
 *
 * Each chip shows the kind name + count. Clicking a chip toggles it in
 * the `visibleKinds` set. An "All" chip clears the filter (empty set
 * means "show everything").
 *
 * State is fully controlled by the parent — this component is purely
 * presentational.
 */

import type { ReactElement } from "react";
import { type TelemetryEventKind } from "./types.js";

interface EventFilterProps {
	readonly counts: ReadonlyMap<TelemetryEventKind, number>;
	readonly visibleKinds: ReadonlySet<TelemetryEventKind>;
	readonly onToggle: (kind: TelemetryEventKind) => void;
	readonly onClear: () => void;
}

export function EventFilter({
	counts,
	visibleKinds,
	onToggle,
	onClear,
}: EventFilterProps): ReactElement {
	const total = Array.from(counts?.values() || []).reduce((s, n) => s + (n || 0), 0);
	const isActive = visibleKinds?.size > 0;

	if (!counts || counts.size === 0) {
		return <div className="h-9" aria-hidden />;
	}

	return (
		<div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/60 bg-panel/50 px-6 py-2">
			<button
				type="button"
				onClick={onClear}
				className={[
					"rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
					isActive
						? "border-border text-fg-muted hover:border-fg-muted"
						: "border-accent bg-accent/15 text-accent",
				].join(" ")}
			>
				All <span className="ml-1 font-mono text-fg-dim">{total}</span>
			</button>
			{Array.from(counts.entries() || [])
				.sort((a, b) => (b[1] || 0) - (a[1] || 0))
				.map(([kind, n]) => {
					const active = visibleKinds?.has(kind);
					return (
						<button
							key={String(kind)}
							type="button"
							onClick={() => onToggle(kind)}
							className={[
								"rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
								active
									? "border-accent bg-accent/15 text-accent"
									: "border-border text-fg-muted hover:border-fg-muted hover:text-fg",
							].join(" ")}
							title={String(kind)}
						>
							{String(kind)}
							<span className="ml-1 text-fg-dim">{n}</span>
						</button>
					);
				})}
		</div>
	);
}
