/**
 * Handlers Index
 *
 * Central export point for all ST MCP handlers.
 */

// Advanced handlers (renamed from phase3 in P4)
export {
	handleDataFlowGraph,
	handleGraphHealthExtended,
	handleStateMachine,
} from "./advanced";
// Analysis handlers (renamed from phase2 in P4)
export {
	handleCallChain,
	handleCodeMetrics,
	handleFBInstances,
	handleGlobalVars,
	handleImpactAnalysis,
	handleVariableFlow,
} from "./analysis";
// Core handlers
export {
	getIndexer,
	getLastStats,
	handleBatchIndex,
	handleCallHierarchy,
	handleGraphHealth,
	handleIndex,
	handleReferences,
	handleSearch,
	setIndexer,
} from "./core";
// Phase 6 handlers
export { handleObsidianExport } from "./obsidian-export";
// Schemas
export * from "./schemas";
// SQL-Graph handlers
export {
	handleDetectCodeClones,
	handleGetEntitySource,
	handleGetGraph,
	handleListFileEntities,
} from "./sql-graph";
// Utility handlers
export {
	handleGetVersion,
	handleResetGraph,
} from "./utility";
