/**
 * MCP Module Public API (Barrel file)
 */

export { setTelemetrySink } from "./middleware/telemetry-middleware.js";
export { getResourceCount, registerResources } from "./resources/index.js";
export { getSTToolDefinitions, handleSTToolCall } from "./st-tools.js";
export { workspaceManager } from "./workspace-manager.js";
