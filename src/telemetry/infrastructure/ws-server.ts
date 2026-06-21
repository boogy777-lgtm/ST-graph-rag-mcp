/**
 * Telemetry WebSocket Server (infrastructure adapter)
 *
 * Single Bun.serve() instance that:
 *   1. Serves the bundled HTML dashboard at GET /
 *   2. Accepts WebSocket upgrades at GET /ws
 *   3. Broadcasts new telemetry events to all connected clients (pub/sub topic)
 *   4. Replays the ring-buffer snapshot to a fresh client (filtered by sinceId)
 *
 * Bound to 127.0.0.1 only — no auth, no TLS, no LAN access.
 * Port is requested as 0 so the OS assigns a free port (single workspace,
 * single instance per process → no collision risk in practice).
 *
 * The HTML payload is loaded via Bun's `with { type: "text" }` import from
 * a `.html.txt` file. Bun's HTML auto-loader does not activate for non-`.html`
 * extensions, so we get a plain string. `bun build --compile` inlines the
 * string literal into the binary at build time — no runtime fs.read needed.
 */

import type { TelemetryBus } from "../application/telemetry-bus.js";
import type { TelemetryEvent } from "../domain/events.js";
import indexHtml from "./assets/dashboard.html.txt" with { type: "text" };

export const EVENTS_TOPIC = "telemetry-events";

export interface WsServerHandle {
	readonly port: number;
	readonly hostname: string;
	readonly url: string;
	readonly server: ReturnType<typeof Bun.serve>;
	stop(): void;
}

interface WsServerOptions {
	readonly bus: TelemetryBus;
	readonly onClientConnected?: (remote: string) => void;
	readonly onClientDisconnected?: (remote: string) => void;
}

export function startWsServer(opts: WsServerOptions): WsServerHandle {
	const server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",

		fetch(req, server): Response | undefined {
			const url = new URL(req.url);

			if (url.pathname === "/" || url.pathname === "/index.html") {
				return new Response(indexHtml, {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			if (url.pathname === "/ws") {
				const upgraded = server.upgrade(req);
				if (upgraded) {
					return undefined;
				}
				return new Response("WebSocket upgrade failed", { status: 400 });
			}

			if (url.pathname === "/healthz") {
				const json = JSON.stringify({
					ok: true,
					clients: server.pendingWebSockets,
				});
				return new Response(json, {
					headers: { "content-type": "application/json" },
				});
			}

			return new Response("Not Found", { status: 404 });
		},

		websocket: {
			open(ws) {
				const remote = ws.remoteAddress ?? "unknown";
				opts.onClientConnected?.(remote);
				// Subscribe so server.publish(topic, payload) fan-outs to us.
				ws.subscribe(EVENTS_TOPIC);
				const snapshot = opts.bus.drain();
				if (snapshot.length > 0) {
					const payload = JSON.stringify({ type: "events", events: snapshot });
					ws.send(payload);
				}
			},

			message(ws, raw) {
				const text =
					typeof raw === "string" ? raw : new TextDecoder().decode(raw);
				let parsed: unknown;
				try {
					parsed = JSON.parse(text);
				} catch {
					return;
				}
				if (
					parsed !== null &&
					typeof parsed === "object" &&
					(parsed as { type?: unknown }).type === "replay"
				) {
					const sinceId = Number(
						(parsed as { sinceId?: unknown }).sinceId ?? 0,
					);
					const events = opts.bus.drain(Number.isFinite(sinceId) ? sinceId : 0);
					if (events.length > 0) {
						const payload = JSON.stringify({ type: "events", events });
						ws.send(payload);
					}
				}
			},

			close(ws) {
				const remote = ws.remoteAddress ?? "unknown";
				opts.onClientDisconnected?.(remote);
			},
		},
	});

	return {
		port: server.port ?? 0,
		hostname: server.hostname ?? "127.0.0.1",
		url: `http://${server.hostname}:${server.port}`,
		server,
		stop(): void {
			server.stop(true);
		},
	};
}

/**
 * Build a sink function that fans events out to all subscribers of the given
 * Bun.serve instance via the `EVENTS_TOPIC` topic. Use this as the `sink`
 * option of TelemetryBus.
 *
 * Kept as a separate helper so the server module stays decoupled from
 * bus internals and from Bun server internals.
 */
export function fanOutSink(server: ReturnType<typeof Bun.serve>) {
	return (batch: TelemetryEvent[]): void => {
		if (batch.length === 0) return;
		const payload = JSON.stringify({ type: "events", events: batch });
		try {
			// publish(topic, payload) — Bun fans out to all subscribers.
			server.publish(EVENTS_TOPIC, payload);
		} catch (err) {
			console.error("[WsServer] broadcast failed:", err);
		}
	};
}
