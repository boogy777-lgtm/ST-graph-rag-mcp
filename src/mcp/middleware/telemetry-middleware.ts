/**
 * Telemetry Middleware — Decorator pattern over MCP tool handlers.
 *
 * Wraps a `ToolHandler` so every invocation emits three telemetry events:
 *   1. `tool_started`   — before delegation, with sanitized args preview
 *   2. `tool_completed` — on successful return, with measured `durationMs`
 *   3. `tool_failed`    — on thrown error, with measured `durationMs` + message
 *
 * All three events share a `callId` (branded string) so the UI can group
 * them into a single "AI call" row.
 *
 * Injection mechanism (no DI container — Bun-friendly, zero deps):
 *   - Tool registration happens statically (at module load time in st-tools.ts).
 *   - The telemetry bus is created dynamically at runtime (in src/index.ts).
 *   - Therefore the sink is set via `setTelemetrySink()` from the composition
 *     root AFTER `startTelemetry()` returns, BEFORE stdio connect.
 *   - If the sink is `null`, `withTelemetry` is a transparent pass-through
 *     — handlers still work, just without telemetry. This keeps tests and
 *     tooling usable even when telemetry is disabled.
 *
 * Sanitization policy:
 *   - String values in args are truncated to 200 chars (and marked with "…").
 *   - Arrays/objects are JSON-stringified first, then truncated as a single
 *     string. This keeps the WS payload small and prevents accidental PII
 *     leakage (paths, query strings, large content blobs).
 */

import type {
	TelemetryEventDraft,
	ToolCallId,
} from "../../telemetry/domain/events.js";
import type { ToolHandler } from "../registry.js";

/** Max length of a sanitized args preview before truncation. */
const ARGS_PREVIEW_MAX_CHARS = 200;

/** Sink type — same shape as `TelemetryBus.publish` accepts. */
export type TelemetrySink = (draft: TelemetryEventDraft) => void;

let sink: TelemetrySink | null = null;

/**
 * Install the telemetry sink. Called once from `src/index.ts` after
 * `startTelemetry()` returns the bus. Calling twice replaces the previous
 * sink (intentional — useful in tests).
 *
 * Pass `null` to disable telemetry (handlers become transparent wrappers).
 */
export function setTelemetrySink(next: TelemetrySink | null): void {
	sink = next;
}

/**
 * Read-only access to the current sink — for tests and diagnostics.
 */
export function getTelemetrySink(): TelemetrySink | null {
	return sink;
}

/**
 * Sanitize tool-call args for the `tool_started` preview.
 *
 * Rules:
 * - Non-objects → String() and truncate to ARGS_PREVIEW_MAX_CHARS.
 * - Objects → JSON.stringify → truncate to ARGS_PREVIEW_MAX_CHARS.
 * - Circular refs / throws → best-effort fallback to "{}".
 *
 * Why truncate here and not in the bus: the bus is shared with indexer
 * events that have well-bounded payloads; tool args are user-controlled
 * (paths, queries, free-form text) and need a per-call cap.
 */
export function sanitizeArgsPreview(args: unknown): string {
	let raw: string;
	try {
		if (args === undefined || args === null) return "{}";
		raw = typeof args === "string" ? args : JSON.stringify(args);
	} catch {
		return "{}";
	}
	if (raw.length <= ARGS_PREVIEW_MAX_CHARS) return raw;
	return `${raw.slice(0, ARGS_PREVIEW_MAX_CHARS)}…`;
}

/**
 * Build a unique call id. We don't need crypto-grade uniqueness — a
 * monotonic counter + a random suffix gives us collision-free ids
 * within a single process while keeping ids short (good for WS frames).
 */
let callCounter = 0;
export function makeCallId(): ToolCallId {
	callCounter = (callCounter + 1) >>> 0;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${Date.now().toString(36)}-${callCounter.toString(36)}-${rand}` as ToolCallId;
}

/**
 * Decorator: wrap a `ToolHandler` with telemetry.
 *
 * Behavior:
 * - If `sink === null`: pure pass-through, zero overhead beyond one branch.
 * - If `sink !== null`: emit started, time the call, emit completed/failed.
 *
 * The decorated handler preserves the original signature, including the
 * `ToolHelpers` propagation, so dispatcher internals (normalizePaths,
 * stripInternalFields) still run AFTER the decorated handler returns.
 *
 * Errors are RE-THROWN so the dispatcher's existing error-handling path
 * is not bypassed.
 */
export function withTelemetry(
	toolName: string,
	handler: ToolHandler,
): ToolHandler {
	return async function decorated(args, helpers): Promise<unknown> {
		const activeSink = sink;
		if (activeSink === null) {
			return handler(args, helpers);
		}

		const callId = makeCallId();
		const startedAt = Date.now();

		activeSink({
			kind: "tool_started",
			callId,
			tool: toolName,
			argsPreview: sanitizeArgsPreview(args),
		});

		try {
			const result = await handler(args, helpers);
			activeSink({
				kind: "tool_completed",
				callId,
				tool: toolName,
				durationMs: Date.now() - startedAt,
				ok: true,
			});
			return result;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			activeSink({
				kind: "tool_failed",
				callId,
				tool: toolName,
				durationMs: Date.now() - startedAt,
				ok: false,
				error: message,
			});
			throw err;
		}
	};
}
