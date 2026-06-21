/**
 * Telemetry Bus
 *
 * Single-instance, fire-and-forget event bus with a bounded ring buffer
 * (default 1000 events) and a coalesced broadcast loop.
 *
 * Why a ring buffer + batching loop:
 * - Producers (indexer, LSP) run hot paths and MUST NOT block on subscribers.
 * - A bounded ring prevents unbounded memory growth if no WS client is connected.
 * - One coalesced frame per tick avoids N small WS writes → reduces syscalls.
 *
 * Overflow policy: drop OLDEST, emit a single `bus_overflow` event so the
 * UI can show a warning. Backpressure is intentionally NOT propagated to
 * producers (telemetry must never stall indexing).
 *
 * Threading: single-threaded (Bun main loop). No locks needed.
 */

import type { TelemetryEvent, TelemetryEventDraft } from "../domain/events.js";

const DEFAULT_CAPACITY = 1000;
const DEFAULT_BATCH_INTERVAL_MS = 100;
const DEFAULT_OVERFLOW_REPORT_INTERVAL_MS = 1000;

export interface TelemetryBusOptions {
	readonly capacity?: number;
	readonly batchIntervalMs?: number;
	readonly overflowReportIntervalMs?: number;
	readonly now?: () => number;
	readonly sink?: (batch: TelemetryEvent[]) => void;
	readonly onOverflow?: (dropped: number, capacity: number) => void;
}

export class TelemetryBus {
	readonly #capacity: number;
	readonly #batchIntervalMs: number;
	readonly #overflowReportIntervalMs: number;
	readonly #now: () => number;
	readonly #sink: (batch: TelemetryEvent[]) => void;
	readonly #onOverflow?: (dropped: number, capacity: number) => void;

	/**
	 * Pre-allocated ring buffer. We use a fixed-size array + write index for
	 * cache-friendly behavior; the "logical" view is `events[0..size)`.
	 */
	readonly #buffer: (TelemetryEvent | undefined)[];
	#writeIdx = 0;
	#size = 0;
	#nextId = 1;

	#droppedSinceLastReport = 0;
	#lastOverflowReportAt = 0;

	#batch: TelemetryEvent[] = [];
	#timer: ReturnType<typeof setInterval> | null = null;
	#running = false;

	constructor(opts: TelemetryBusOptions = {}) {
		this.#capacity = opts.capacity ?? DEFAULT_CAPACITY;
		this.#batchIntervalMs = opts.batchIntervalMs ?? DEFAULT_BATCH_INTERVAL_MS;
		this.#overflowReportIntervalMs =
			opts.overflowReportIntervalMs ?? DEFAULT_OVERFLOW_REPORT_INTERVAL_MS;
		this.#now = opts.now ?? (() => Date.now());
		this.#sink = opts.sink ?? (() => {});
		this.#onOverflow = opts.onOverflow;
		this.#buffer = new Array<TelemetryEvent | undefined>(this.#capacity);
	}

	/** Number of events currently in the ring buffer. */
	get size(): number {
		return this.#size;
	}

	get capacity(): number {
		return this.#capacity;
	}

	get isRunning(): boolean {
		return this.#running;
	}

	start(): void {
		if (this.#running) return;
		this.#running = true;
		this.#timer = setInterval(() => this.#flush(), this.#batchIntervalMs);
		// Don't keep the event loop alive solely for telemetry flushing.
		// Bun supports unref on NodeJS-like timer returns.
		(this.#timer as { unref?: () => void } | null)?.unref?.();
	}

	stop(): void {
		if (!this.#running) return;
		this.#running = false;
		if (this.#timer !== null) {
			clearInterval(this.#timer);
			this.#timer = null;
		}
		this.#flush();
	}

	/**
	 * Publish a single event. O(1) amortized.
	 *
	 * When the buffer is full we drop the OLDEST event and overwrite it,
	 * then record the drop for the next overflow report.
	 */
	publish(draft: TelemetryEventDraft): void {
		const event: TelemetryEvent = {
			id: this.#nextId++,
			ts: this.#now(),
			...draft,
		} as TelemetryEvent;

		if (this.#size < this.#capacity) {
			this.#buffer[(this.#writeIdx + this.#size) % this.#capacity] = event;
			this.#size++;
		} else {
			// Drop oldest (at writeIdx), overwrite its slot with new event.
			this.#buffer[this.#writeIdx] = event;
			this.#writeIdx = (this.#writeIdx + 1) % this.#capacity;
			this.#droppedSinceLastReport++;
			this.#maybeReportOverflow();
		}

		this.#batch.push(event);
	}

	/**
	 * Drain pending events and call the sink with the latest snapshot.
	 *
	 * Semantics: the sink receives the LAST `Math.min(snapshotSize, capacity)`
	 * events — useful when consumers want the recent history on (re)connect.
	 *
	 * The `sinceId` parameter allows a newly-connected WS client to request
	 * only events with id > sinceId (avoids replaying the entire buffer).
	 */
	drain(sinceId?: number): TelemetryEvent[] {
		if (this.#size === 0) return [];
		const start = this.#writeIdx;
		const out: TelemetryEvent[] = [];
		for (let i = 0; i < this.#size; i++) {
			const ev = this.#buffer[(start + i) % this.#capacity];
			if (ev === undefined) continue;
			if (sinceId !== undefined && ev.id <= sinceId) continue;
			out.push(ev);
		}
		return out;
	}

	#flush(): void {
		if (this.#batch.length === 0) return;
		const batch = this.#batch;
		this.#batch = [];
		try {
			this.#sink(batch);
		} catch (err) {
			// Sink errors must NEVER propagate to producers; telemetry is best-effort.
			console.error("[TelemetryBus] sink threw:", err);
		}
	}

	#maybeReportOverflow(): void {
		const now = this.#now();
		if (
			this.#droppedSinceLastReport > 0 &&
			now - this.#lastOverflowReportAt >= this.#overflowReportIntervalMs
		) {
			const dropped = this.#droppedSinceLastReport;
			this.#droppedSinceLastReport = 0;
			this.#lastOverflowReportAt = now;

			const overflowEvent: TelemetryEvent = {
				id: this.#nextId++,
				ts: now,
				kind: "bus_overflow",
				dropped,
				capacity: this.#capacity,
			};
			// Push directly to the batch (not into the ring — overflow events
			// are themselves a form of metadata; if the ring is full again,
			// the next overflow report will overwrite them anyway).
			this.#batch.push(overflowEvent);
			this.#onOverflow?.(dropped, this.#capacity);
		}
	}
}
