/**
 * Telemetry Composition Root
 *
 * Wires together: TelemetryBus + WsServer + PortFile, and returns a single
 * handle that the MCP entry point (`src/index.ts`) can start at boot and
 * stop on shutdown.
 *
 * Side effects on start:
 *   - Writes <cwd>/.code-graph-rag/ui.port with { port, pid, startedAt }
 *   - Listens on 127.0.0.1:<random> for the WS dashboard
 *
 * Side effects on stop:
 *   - Stops Bun.serve (closes all WS connections)
 *   - Removes the port file
 *   - Drains the bus one last time
 */

import { TelemetryBus } from "./application/telemetry-bus.js";
import type { IndexerHooks } from "./domain/ports.js";
import { hooksToEventSink } from "./domain/ports.js";
import { PortFile } from "./infrastructure/port-file.js";
import {
	fanOutSink,
	startWsServer,
	type WsServerHandle,
} from "./infrastructure/ws-server.js";

export interface TelemetryHandle {
	readonly port: number;
	readonly url: string;
	readonly hooks: IndexerHooks;
	stop(): void;
}

export interface StartTelemetryOptions {
	readonly busCapacity?: number;
	readonly batchIntervalMs?: number;
	readonly portFilePath?: string;
	readonly now?: () => number;
}

export function startTelemetry(
	opts: StartTelemetryOptions = {},
): TelemetryHandle {
	const portFile = new PortFile(opts.portFilePath);
	const startedAt = (opts.now ?? Date.now)();

	// Phase 1: construct WS server first so we know the assigned port.
	// We pass a placeholder bus; the real sink is wired after construction.
	let busRef: TelemetryBus | null = null;

	const ws: WsServerHandle = startWsServer({
		get bus(): TelemetryBus {
			if (!busRef) throw new Error("[Telemetry] bus not yet constructed");
			return busRef;
		},
		onClientConnected: (remote) => {
			busRef?.publish({ kind: "ws_client_connected", remote });
		},
		onClientDisconnected: (remote) => {
			busRef?.publish({ kind: "ws_client_disconnected", remote });
		},
	});

	// Phase 2: build the bus, sink = WS fan-out.
	const bus = new TelemetryBus({
		capacity: opts.busCapacity,
		batchIntervalMs: opts.batchIntervalMs,
		now: opts.now,
		sink: fanOutSink(ws.server),
	});
	busRef = bus;
	bus.start();

	// Phase 3: write port file and announce startup.
	portFile.write({
		port: ws.port,
		pid: process.pid,
		startedAt,
	});

	bus.publish({
		kind: "server_started",
		pid: process.pid,
		bunVersion: Bun.version,
		uiPort: ws.port,
	});

	// Phase 4: expose IndexerHooks wired through the bus.
	const hooks: IndexerHooks = hooksToEventSink((draft) => bus.publish(draft));

	return {
		port: ws.port,
		url: ws.url,
		hooks,
		stop(): void {
			bus.publish({ kind: "server_stopped", reason: "manual" });
			bus.stop();
			ws.stop();
			portFile.remove();
		},
	};
}
