import type { ReactElement } from "react";
import type { WsConnectionState } from "./types.js";

interface StatusBarProps {
	readonly state: WsConnectionState;
	readonly eventCount: number;
}

export function StatusBar({ state, eventCount }: StatusBarProps): ReactElement {
	const { label, dot } = describe(state);

	return (
		<footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-panel px-4 text-[11px] text-fg-muted">
			<div className="flex items-center gap-2">
				<span className={`inline-block size-2 rounded-full ${dot}`} aria-hidden />
				<span className="font-mono">{label}</span>
			</div>
			<div className="flex items-center gap-4 font-mono">
				<span>events: {eventCount}</span>
				<span className="text-fg-dim">Phase 3.0</span>
			</div>
		</footer>
	);
}

function describe(state: WsConnectionState): { label: string; dot: string } {
	switch (state.status) {
		case "connecting":
			return { label: "WS · connecting", dot: "bg-warning animate-pulse" };
		case "open":
			return { label: "WS · connected", dot: "bg-success" };
		case "closed":
			return {
				label: `WS · closed (${state.code})`,
				dot: "bg-fg-dim",
			};
		case "error":
			return { label: `WS · error (${state.message})`, dot: "bg-danger" };
	}
}
