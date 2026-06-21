/**
 * WebSocket client connecting the bundled SPA to the MCP telemetry server.
 *
 * URL discovery: `ws://${window.location.host}/ws`
 *   - Same-origin → no config, no env vars, works in any bundled binary.
 *   - The MCP server (ws-server.ts) accepts only upgrades on `/ws`.
 *
 * Auto-reconnect: exponential backoff capped at 30s, with full jitter.
 * Replay: on each (re)connect we send `{type:"replay", sinceId}` to get
 * missed events — the backend filters by id.
 *
 * State machine: idle → connecting → open → closed → connecting …
 * Exposed as a subscribe/unsubscribe model so React can `useSyncExternalStore`.
 */

import {
	type ClientMessage,
	parseServerMessage,
	type ServerMessage,
	type TelemetryEvent,
	type WsConnectionState,
} from "./types.js";

export type Listener<T> = (value: T) => void;

export interface WsClientOptions {
	/** Override URL (mainly for tests). Default: same-origin /ws. */
	readonly url?: string;
	/** Max backoff between reconnect attempts. */
	readonly maxBackoffMs?: number;
	/** Send a replay request on (re)connect. */
	readonly replayOnReconnect?: boolean;
}

const DEFAULTS = {
	maxBackoffMs: 30_000,
	replayOnReconnect: true,
} as const;

export class WsClient {
	readonly #url: string;
	readonly #maxBackoffMs: number;
	readonly #replayOnReconnect: boolean;

	#socket: WebSocket | null = null;
	#attempt = 0;
	#lastEventId = 0;
	#retryTimer: ReturnType<typeof setTimeout> | null = null;
	#closedByUser = false;

	#state: WsConnectionState = { status: "connecting" };
	#events: TelemetryEvent[] = [];
	readonly #stateListeners = new Set<Listener<WsConnectionState>>();
	readonly #eventListeners = new Set<Listener<readonly TelemetryEvent[]>>();

	constructor(opts: WsClientOptions = {}) {
		this.#url = opts.url ?? defaultWsUrl();
		this.#maxBackoffMs = opts.maxBackoffMs ?? DEFAULTS.maxBackoffMs;
		this.#replayOnReconnect =
			opts.replayOnReconnect ?? DEFAULTS.replayOnReconnect;
	}

	// ─── Public observable API ───────────────────────────────────────────

	get state(): WsConnectionState {
		return this.#state;
	}

	get events(): readonly TelemetryEvent[] {
		return this.#events;
	}

	get lastEventId(): number {
		return this.#lastEventId;
	}

	subscribeState(listener: Listener<WsConnectionState>): () => void {
		this.#stateListeners.add(listener);
		listener(this.#state);
		return () => this.#stateListeners.delete(listener);
	}

	subscribeEvents(listener: Listener<readonly TelemetryEvent[]>): () => void {
		this.#eventListeners.add(listener);
		listener(this.#events);
		return () => this.#eventListeners.delete(listener);
	}

	// ─── Lifecycle ───────────────────────────────────────────────────────

	connect(): void {
		this.#closedByUser = false;
		this.#openSocket();
	}

	close(): void {
		this.#closedByUser = true;
		if (this.#retryTimer !== null) {
			clearTimeout(this.#retryTimer);
			this.#retryTimer = null;
		}
		this.#socket?.close();
		this.#socket = null;
	}

	clearEvents(): void {
		this.#events = [];
		this.#lastEventId = 0;
		this.#emitEvents();
	}

	// ─── Internals ───────────────────────────────────────────────────────

	#openSocket(): void {
		this.#setState({ status: "connecting" });

		let socket: WebSocket;
		try {
			socket = new WebSocket(this.#url);
		} catch (err) {
			this.#setState({
				status: "error",
				message: err instanceof Error ? err.message : String(err),
			});
			this.#scheduleReconnect();
			return;
		}

		this.#socket = socket;

		socket.addEventListener("open", () => {
			this.#attempt = 0;
			this.#setState({ status: "open", since: Date.now() });
			if (this.#replayOnReconnect && this.#lastEventId > 0) {
				this.#send({ type: "replay", sinceId: this.#lastEventId });
			}
		});

		socket.addEventListener("message", (ev) => {
			this.#handleRaw(ev.data);
		});

		socket.addEventListener("close", (ev) => {
			this.#setState({
				status: "closed",
				code: ev.code,
				reason: ev.reason,
			});
			if (!this.#closedByUser) this.#scheduleReconnect();
		});

		socket.addEventListener("error", () => {
			// The close event will fire right after; do nothing here.
		});
	}

	#handleRaw(data: unknown): void {
		// WebSocket message data is either string or Blob; we only expect strings.
		if (typeof data !== "string") return;
		let parsed: unknown;
		try {
			parsed = JSON.parse(data);
		} catch {
			return;
		}
		const message: ServerMessage | null = parseServerMessage(parsed);
		if (message === null) return;
		if (message.type === "events") {
			this.#ingestEvents(message.events);
		}
		// `hello` envelope is reserved for future use.
	}

	#ingestEvents(batch: readonly TelemetryEvent[]): void {
		if (batch.length === 0) return;
		const merged = [...this.#events];
		let maxId = this.#lastEventId;
		for (const ev of batch) {
			if (ev.id > maxId) maxId = ev.id;
			merged.push(ev);
		}
		// Cap memory: keep last 1000 events on the UI side too.
		const MAX_EVENTS = 1000;
		const trimmed =
			merged.length > MAX_EVENTS ? merged.slice(-MAX_EVENTS) : merged;
		this.#events = trimmed;
		this.#lastEventId = maxId;
		this.#emitEvents();
	}

	#send(msg: ClientMessage): void {
		const sock = this.#socket;
		if (sock === null || sock.readyState !== sock.OPEN) return;
		try {
			sock.send(JSON.stringify(msg));
		} catch {
			// Best-effort; close will trigger reconnect.
		}
	}

	#scheduleReconnect(): void {
		if (this.#closedByUser) return;
		this.#attempt++;
		const base = Math.min(1000 * 2 ** this.#attempt, this.#maxBackoffMs);
		const jittered = Math.floor(Math.random() * base);
		this.#retryTimer = setTimeout(() => {
			this.#retryTimer = null;
			this.#openSocket();
		}, jittered);
	}

	#setState(next: WsConnectionState): void {
		this.#state = next;
		for (const listener of this.#stateListeners) listener(next);
	}

	#emitEvents(): void {
		for (const listener of this.#eventListeners) listener(this.#events);
	}
}

function defaultWsUrl(): string {
	if (typeof window === "undefined") return "ws://127.0.0.1:0/ws";
	const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${proto}//${window.location.host}/ws`;
}
