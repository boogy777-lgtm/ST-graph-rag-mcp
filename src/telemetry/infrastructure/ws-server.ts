/**
 * Telemetry WebSocket Server (infrastructure adapter)
 */

import { UI_ASSETS } from "../../ui-embed.gen.js";
import type { TelemetryBus } from "../application/telemetry-bus.js";
import type { TelemetryEvent } from "../domain/events.js";

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
	readonly getDb: () => any;
	readonly getActiveWorkspace: () => string | null;
	readonly onClientConnected?: (remote: string) => void;
	readonly onClientDisconnected?: (remote: string) => void;
}

type EmbeddedAsset = { readonly contentType: string; readonly content: string };

function buildAssetIndex(): {
	readonly byPath: ReadonlyMap<string, EmbeddedAsset>;
	readonly indexHtml: EmbeddedAsset | null;
} {
	const byPath = new Map<string, EmbeddedAsset>();
	let indexHtml: EmbeddedAsset | null = null;

	const keys = Object.keys(UI_ASSETS);
	console.error(`[WsServer] UI_ASSETS keys = ${keys.length}`);

	for (const key of keys) {
		const asset = UI_ASSETS[key as keyof typeof UI_ASSETS];
		if (asset === undefined) continue;
		byPath.set(key, asset);
		if (key === "/index.html") {
			indexHtml = asset;
		}
	}

	return { byPath, indexHtml };
}

export function startWsServer(opts: WsServerOptions): WsServerHandle {
	const assets = buildAssetIndex();

	const server = Bun.serve({
		port: 61131,
		hostname: "127.0.0.1",

		fetch(req, server): Response | undefined {
			const url = new URL(req.url);

			if (url.pathname === "/ws") {
				const upgraded = server.upgrade(req);
				if (upgraded) return undefined;
				return new Response("WebSocket upgrade failed", { status: 400 });
			}

			if (url.pathname === "/healthz") {
				return new Response(
					JSON.stringify({ ok: true, clients: server.pendingWebSockets }),
					{
						headers: { "content-type": "application/json" },
					},
				);
			}

			if (url.pathname === "/api/analytics/hotspots") {
				try {
					const wsDir = opts.getActiveWorkspace();
					if (!wsDir)
						return new Response(
							JSON.stringify({ error: "No active workspace" }),
							{
								status: 400,
								headers: {
									"content-type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);

					const db = opts.getDb();
					if (!db)
						return new Response(JSON.stringify({ error: "No DB" }), {
							status: 500,
							headers: {
								"content-type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						});

					const hotspots = db
						.query(`
						SELECT to_id as name, COUNT(from_id) as dependents_count 
						FROM st_relationships 
						GROUP BY to_id 
						ORDER BY dependents_count DESC 
						LIMIT 10
					`)
						.all();

					return new Response(JSON.stringify(hotspots), {
						headers: {
							"content-type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					});
				} catch (err: any) {
					return new Response(JSON.stringify({ error: err.message }), {
						status: 500,
						headers: {
							"content-type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					});
				}
			}

			if (url.pathname === "/api/analytics/health") {
				try {
					const wsDir = opts.getActiveWorkspace();
					if (!wsDir)
						return new Response(
							JSON.stringify({ error: "No active workspace" }),
							{
								status: 400,
								headers: {
									"content-type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);

					const db = opts.getDb();
					if (!db)
						return new Response(JSON.stringify({ error: "No DB" }), {
							status: 500,
							headers: {
								"content-type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						});

					const fbCount =
						(
							db
								.query(
									"SELECT COUNT(*) as c FROM st_pous WHERE pou_type = 'FUNCTION_BLOCK'",
								)
								.get() as any
						)?.c || 0;
					const prgCount =
						(
							db
								.query(
									"SELECT COUNT(*) as c FROM st_pous WHERE pou_type = 'PROGRAM'",
								)
								.get() as any
						)?.c || 0;
					const totalNodes =
						(db.query("SELECT COUNT(*) as c FROM st_pous").get() as any)?.c ||
						0;
					const isolatedNodes =
						(
							db
								.query(`
						SELECT COUNT(id) as c FROM st_pous p
						WHERE NOT EXISTS (SELECT 1 FROM st_relationships r WHERE r.from_id = p.id OR r.to_id = p.id)
					`)
								.get() as any
						)?.c || 0;

					const healthScore =
						totalNodes > 0
							? Math.round(((totalNodes - isolatedNodes) / totalNodes) * 100)
							: 100;

					return new Response(
						JSON.stringify({
							score: healthScore,
							fbCount,
							prgCount,
							totalNodes,
							isolatedNodes,
						}),
						{
							headers: {
								"content-type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						},
					);
				} catch (err: any) {
					return new Response(JSON.stringify({ error: err.message }), {
						status: 500,
						headers: {
							"content-type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					});
				}
			}

			if (url.pathname === "/api/graph/snapshot") {
				try {
					const wsDir = opts.getActiveWorkspace();
					if (!wsDir) {
						return new Response(
							JSON.stringify({ error: "No active workspace" }),
							{
								status: 400,
								headers: {
									"content-type": "application/json",
									"Access-Control-Allow-Origin": "*",
								},
							},
						);
					}

					const db = opts.getDb();
					if (!db) {
						return new Response(JSON.stringify({ error: "No DB" }), {
							status: 500,
							headers: {
								"content-type": "application/json",
								"Access-Control-Allow-Origin": "*",
							},
						});
					}

					const nodes = db.query("SELECT * FROM st_pous").all();
					const edges = db.query("SELECT * FROM st_relationships").all();

					const graph = {
						nodes: nodes.map((n: any) => ({
							id: n.id,
							type:
								n.pou_type === "FUNCTION_BLOCK" ? "functionBlock" : "program",
							position: { x: 0, y: 0 }, // Let React Flow layout or keep stable
							data: { label: n.name, type: n.pou_type },
						})),
						edges: edges.map((e: any) => ({
							id: e.id || `${e.from_id}-${e.to_id}-${e.type}`,
							source: e.from_id,
							target: e.to_id,
							label: e.type,
						})),
					};
					return new Response(JSON.stringify(graph), {
						headers: {
							"content-type": "application/json",
							"Access-Control-Allow-Origin": "*",
						},
					});
				} catch (err: any) {
					return new Response(JSON.stringify({ error: err.message }), {
						status: 500,
					});
				}
			}

			const asset = lookupAsset(assets.byPath, url.pathname);
			if (asset !== null) {
				return new Response(asset.content, {
					headers: { "Content-Type": asset.contentType },
				});
			}

			if (
				url.pathname === "/" ||
				url.pathname === "/index.html" ||
				isSpaPath(url.pathname)
			) {
				if (assets.indexHtml !== null) {
					return new Response(assets.indexHtml.content, {
						headers: { "Content-Type": assets.indexHtml.contentType },
					});
				}
				return new Response("Dashboard not embedded", { status: 500 });
			}

			return new Response("Not Found", { status: 404 });
		},

		websocket: {
			open(ws) {
				const remote = ws.remoteAddress ?? "unknown";
				opts.onClientConnected?.(remote);
				ws.subscribe(EVENTS_TOPIC);
				const snapshot = opts.bus.drain();
				if (snapshot.length > 0) {
					ws.send(JSON.stringify({ type: "events", events: snapshot }));
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
					(parsed as any).type === "replay"
				) {
					const sinceId = Number((parsed as any).sinceId ?? 0);
					const events = opts.bus.drain(Number.isFinite(sinceId) ? sinceId : 0);
					if (events.length > 0) {
						ws.send(JSON.stringify({ type: "events", events }));
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

function lookupAsset(
	byPath: ReadonlyMap<string, EmbeddedAsset>,
	pathname: string,
): EmbeddedAsset | null {
	if (pathname.length === 0 || pathname.includes("..")) return null;
	const key = pathname.startsWith("/") ? pathname : `/${pathname}`;
	return byPath.get(key) ?? null;
}

function isSpaPath(pathname: string): boolean {
	return (
		!pathname.startsWith("/api/") &&
		!pathname.startsWith("/assets/") &&
		pathname !== "/ws" &&
		pathname !== "/healthz"
	);
}

export function fanOutSink(server: ReturnType<typeof Bun.serve>) {
	return (batch: TelemetryEvent[]): void => {
		if (batch.length === 0) return;
		try {
			server.publish(
				EVENTS_TOPIC,
				JSON.stringify({ type: "events", events: batch }),
			);
		} catch (err) {
			console.error("[WsServer] broadcast failed:", err);
		}
	};
}
