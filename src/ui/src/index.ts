/**
 * Public API of the bundled dashboard.
 *
 * The MCP server (ws-server.ts) only needs to serve the SPA shell.
 * Component-level exports are reserved for future modular testing.
 */
export { App } from "./App.js";
export type {
	IndexRunSummary,
	SectionId,
	SectionMeta,
	SqliteStats,
	TelemetryEvent,
	TelemetryEventKind,
	WsConnectionState,
} from "./types.js";
export {
	asSqliteStats,
	countByKind,
	isTelemetryEvent,
	parseServerMessage,
} from "./types.js";
