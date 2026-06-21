/**
 * Top-level shell: Sidebar + MainPanel + WS connection.
 *
 * Uses `useSyncExternalStore` to subscribe to the WsClient — gives us
 * tear-free concurrent rendering and minimal re-renders for free.
 *
 * Phase 3.0: adds an `EventFilter` chip row above the EventStream and
 * wires Sidebar badges to live event counters.
 */

import {
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
	type ReactElement,
} from "react";
import {
	type SectionId,
	type TelemetryEvent,
	type TelemetryEventKind,
	type WsConnectionState,
} from "./types.js";
import { MainPanel } from "./MainPanel.js";
import { Sidebar } from "./Sidebar.js";
import { StatusBar } from "./StatusBar.js";
import { WsClient } from "./ws-client.js";

export function App(): ReactElement {
	const [active, setActive] = useState<SectionId>("radar");
	const [client] = useState(() => new WsClient());
	const [visibleKinds, setVisibleKinds] = useState<ReadonlySet<TelemetryEventKind>>(
		() => new Set(),
	);

	useEffect(() => {
		client.connect();
		return () => client.close();
	}, [client]);

	const state = useWsState(client);
	const events = useWsEvents(client);

	const sections = useMemo<readonly SectionId[]>(
		() => ["radar", "graph", "analytics", "settings"],
		[],
	);

	const toggleKind = (kind: TelemetryEventKind): void => {
		setVisibleKinds((prev) => {
			const next = new Set(prev);
			if (next.has(kind)) next.delete(kind);
			else next.add(kind);
			return next;
		});
	};

	const clearFilter = (): void => {
		setVisibleKinds(new Set());
	};

	return (
		<div className="flex h-full w-full overflow-hidden bg-bg text-fg">
			<Sidebar
				active={active}
				onSelect={setActive}
				sections={sections}
				eventCount={events.length}
				visibleKinds={visibleKinds}
			/>
			<div className="flex min-w-0 flex-1 flex-col">
				<MainPanel
					active={active}
					events={events}
					visibleKinds={visibleKinds}
					onToggleKind={toggleKind}
					onClearFilter={clearFilter}
				/>
				<StatusBar state={state} eventCount={events.length} />
			</div>
		</div>
	);
}

// ─── Hooks ────────────────────────────────────────────────────────────────

function useWsState(client: WsClient): WsConnectionState {
	return useSyncExternalStore(
		(listener: () => void) => client.subscribeState(listener),
		() => client.state,
		() => client.state,
	);
}

function useWsEvents(client: WsClient): readonly TelemetryEvent[] {
	return useSyncExternalStore(
		(listener: () => void) => client.subscribeEvents(listener),
		() => client.events,
		() => client.events,
	);
}
