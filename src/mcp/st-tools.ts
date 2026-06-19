/**
 * ST Language MCP Tools (SQLite-backed) — Factory Pattern
 *
 * Интегрирует truST LSP pipeline в MCP server.
 * Все данные хранятся в SQLite таблицах для персистентности между рестартами.
 *
 * Инструменты регистрируются декларативно через ToolRegistry,
 * вызовы диспетчеризуются через ToolDispatcher (без switch-case).
 *
 * Экспортирует:
 * - createMCPTools() — создаёт registry + dispatcher
 * - getToolDefinitions() — для MCP ListTools (backward compat)
 * - handleSTToolCall() — для MCP CallTool (backward compat)
 * - schemas, state management, shutdown (re-exports)
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ProgressReporter } from "../types/progress.js";
import { ToolDispatcher } from "./dispatcher";
import { handleDataFlowGraph, handleStateMachine } from "./handlers/advanced";

import {
	handleCallChain,
	handleCodeMetrics,
	handleFBInstances,
	handleGlobalVars,
	handleImpactAnalysis,
	handleVariableFlow,
} from "./handlers/analysis";
// Import all handlers
import {
	getActiveWorkspace,
	getIndexer,
	getLastStats,
	getSQLiteManager,
	handleBatchIndex,
	handleCallHierarchy,
	handleGraphHealth,
	handleIndex,
	handleReferences,
	handleSearch,
	setActiveWorkspace,
	setIndexer,
} from "./handlers/core";
import { handleObsidianExport } from "./handlers/obsidian-export";
// Import all schemas
import {
	BatchIndexSchema,
	CallChainSchema,
	CallHierarchySchema,
	CodeMetricsSchema,
	DataFlowGraphSchema,
	DetectCodeClonesSchema,
	FBInstancesSchema,
	GetEntitySourceSchema,
	GetGraphSchema,
	GetVersionSchema,
	GlobalVarsSchema,
	GraphHealthSchema,
	ImpactAnalysisSchema,
	IndexSchema,
	ListFileEntitiesSchema,
	ObsidianExportSchema,
	ReferencesSchema,
	ResetGraphSchema,
	SearchSchema,
	StateMachineSchema,
	VariableFlowSchema,
} from "./handlers/schemas";
import {
	handleDetectCodeClones,
	handleGetEntitySource,
	handleGetGraph,
	handleListFileEntities,
} from "./handlers/sql-graph";
import { handleGetVersion, handleResetGraph } from "./handlers/utility";
// Registry + Dispatcher
import {
	type MCPToolDefinition,
	type ToolDefinition,
	ToolHelpers,
	type ToolRegistry,
} from "./registry";
import { workspaceManager } from "./workspace-manager";

export { ToolDispatcher } from "./dispatcher";

// Re-export state management
export {
	getActiveWorkspace,
	getIndexer,
	getLastStats,
	getSQLiteManager,
	setActiveWorkspace,
	setIndexer,
} from "./handlers/core";
// Re-export schemas for external use
export {
	BatchIndexSchema,
	CallChainSchema,
	CallHierarchySchema,
	CodeMetricsSchema,
	DataFlowGraphSchema,
	DetectCodeClonesSchema,
	FBInstancesSchema,
	GetEntitySourceSchema,
	GetGraphSchema,
	GetVersionSchema,
	GlobalVarsSchema,
	GraphHealthSchema,
	ImpactAnalysisSchema,
	IndexSchema,
	ListFileEntitiesSchema,
	ObsidianExportSchema,
	ReferencesSchema,
	ResetGraphSchema,
	SearchSchema,
	StateMachineSchema,
	VariableFlowSchema,
} from "./handlers/schemas";

// Re-export shutdown
export { shutdownSTIndexer } from "./handlers/shutdown";

// Re-export types
export type {
	MCPToolDefinition,
	ToolDefinition,
	ToolHelpers,
	ToolRegistry,
} from "./registry";
// Re-export workspace manager
export { workspaceManager } from "./workspace-manager";

/**
 * Регистрирует все инструменты в registry.
 * 20 базовых инструментов (Core + Analysis + Advanced + Utility + SQL-Graph).
 * +1 obsidian_export (P6).
 */
function registerAllTools(registry: ToolRegistry): void {
	const register = (def: ToolDefinition) => registry.set(def.name, def);

	// === Core Tools ===
	register({
		name: "index",
		description:
			"Index(dir?, lspPath?) → stats(entities, edges). Full|incremental.",
		inputSchema: IndexSchema,
		handler: (args, h) => handleIndex(args, h),
	});
	register({
		name: "search",
		description:
			"Search(query, type?, varType?, direction?, pouType?) → POU/vars. Req: index.",
		inputSchema: SearchSchema,
		handler: (args) => handleSearch(args),
	});
	register({
		name: "references",
		description: "References(entityName) → edges(usage). Req: index.",
		inputSchema: ReferencesSchema,
		handler: (args) => handleReferences(args),
	});
	register({
		name: "call_hierarchy",
		description:
			"CallHierarchy(entityName, direction?) → incoming|outgoing calls. Req: index.",
		inputSchema: CallHierarchySchema,
		handler: (args) => handleCallHierarchy(args),
	});
	register({
		name: "batch_index",
		description:
			"BatchIndex(dir?, sessionId?, statusOnly?, abort?) → session|progress. Async.",
		inputSchema: BatchIndexSchema,
		handler: (args) => handleBatchIndex(args),
	});
	register({
		name: "health",
		description:
			"Health(mode?) → unified health/metrics/stats. mode: basic|extended|metrics|stats|full. Req: index.",
		inputSchema: GraphHealthSchema,
		handler: (args) => handleGraphHealth(args),
	});

	// === Analysis Tools ===
	register({
		name: "variable_flow",
		description: "VariableFlow(pouName) → inputs→outputs. Req: index.",
		inputSchema: VariableFlowSchema,
		handler: (args, h) => handleVariableFlow(args, h.getSQLiteManager),
	});
	register({
		name: "fb_instances",
		description:
			"FBInstances(fbName) → instances(POU, varName, file). Req: index.",
		inputSchema: FBInstancesSchema,
		handler: (args, h) => handleFBInstances(args, h.getSQLiteManager),
	});
	register({
		name: "call_chain",
		description:
			"CallChain(pouName, maxDepth?) → chain(caller, callee, depth). Req: index.",
		inputSchema: CallChainSchema,
		handler: (args, h) => handleCallChain(args, h.getSQLiteManager),
	});
	register({
		name: "global_vars",
		description:
			"GlobalVars(varName?) → globals(name, type, file). Req: index.",
		inputSchema: GlobalVarsSchema,
		handler: (args, h) => handleGlobalVars(args, h.getSQLiteManager),
	});
	register({
		name: "impact_analysis",
		description:
			"Impact(entityName) → direct+transitive dependents. Req: index.",
		inputSchema: ImpactAnalysisSchema,
		handler: (args, h) => handleImpactAnalysis(args, h.getSQLiteManager),
	});
	register({
		name: "metrics",
		description:
			"Metrics(pouName?, file?, mode?, metric?) → POU metrics or hotspots. mode: metrics|hotspots. Req: index.",
		inputSchema: CodeMetricsSchema,
		handler: (args, h) => handleCodeMetrics(args, h.getSQLiteManager),
	});

	// === Advanced Tools ===
	register({
		name: "state_machine",
		description: "StateMachine(pouName?) → CASE candidates. Req: index.",
		inputSchema: StateMachineSchema,
		handler: (args, h) => handleStateMachine(args, h.getSQLiteManager),
	});
	register({
		name: "data_flow_graph",
		description: "DataFlow(startPou) → OUTPUT→INPUT flow. Req: index.",
		inputSchema: DataFlowGraphSchema,
		handler: (args, h) => handleDataFlowGraph(args, h.getSQLiteManager),
	});

	// === Utility Tools ===
	register({
		name: "get_version",
		description: "Version() → server version, features list.",
		inputSchema: GetVersionSchema,
		handler: () => handleGetVersion(),
	});
	register({
		name: "reset_graph",
		description: "Reset(force?) → clear all. DESTRUCTIVE.",
		inputSchema: ResetGraphSchema,
		handler: (args, h) => handleResetGraph(args, h.getSQLiteManager),
	});

	// === SQL-Graph Tools ===
	register({
		name: "list_file_entities",
		description:
			"FileEntities(filePath, types?) → POU/TYPE/VAR in file. Req: index.",
		inputSchema: ListFileEntitiesSchema,
		handler: (args, h) => handleListFileEntities(args, h.getSQLiteManager),
	});
	register({
		name: "get_graph",
		description: "Graph(limit?, cursor?, types?) → nodes+edges. Paginated.",
		inputSchema: GetGraphSchema,
		handler: (args, h) => handleGetGraph(args, h.getSQLiteManager),
	});
	register({
		name: "get_entity_source",
		description:
			"Source(entityName, type?, context?) → ST code snippet. Req: index.",
		inputSchema: GetEntitySourceSchema,
		handler: (args, h) => handleGetEntitySource(args, h.getSQLiteManager),
	});
	register({
		name: "detect_code_clones",
		description: "Clones(minVars?, scope?) → duplicate signatures. Req: index.",
		inputSchema: DetectCodeClonesSchema,
		handler: (args, h) => handleDetectCodeClones(args, h.getSQLiteManager),
	});

	// === Phase 6: Obsidian Vault Exporter ===
	register({
		name: "obsidian_export",
		description:
			"ObsidianExport(vaultPath, mode?, includeMermaid?) → stats. Writes ST graph to Obsidian vault as .md pages with wikilinks. Req: index.",
		inputSchema: ObsidianExportSchema,
		handler: (args, h) => handleObsidianExport(args, h),
	});
}

/**
 * Результат createMCPTools — registry + dispatcher.
 */
export interface MCPTools {
	registry: ToolRegistry;
	dispatcher: ToolDispatcher;
}

/**
 * Recursively strips `directory` property from JSON Schema objects.
 * Keeps it in Zod for backward-compat validation, hides from LLM.
 */
function stripDirectoryFromSchema(schema: unknown): unknown {
	if (!schema || typeof schema !== "object") return schema;

	const s = schema as Record<string, unknown>;

	if (s.properties && typeof s.properties === "object") {
		const props = s.properties as Record<string, unknown>;
		if ("directory" in props) {
			delete props.directory;
		}
	}

	if (Array.isArray(s.required)) {
		s.required = (s.required as string[]).filter((r) => r !== "directory");
	}

	for (const key of Object.keys(s)) {
		if (typeof s[key] === "object") {
			s[key] = stripDirectoryFromSchema(s[key]);
		}
	}

	return s;
}

/**
 * Factory: создаёт registry, регистрирует все инструменты, создаёт dispatcher.
 * Это основная точка входа для инициализации MCP инструментов.
 */
export function createMCPTools(): MCPTools {
	const registry: ToolRegistry = new Map();
	registerAllTools(registry);

	const dispatcher = new ToolDispatcher(registry, workspaceManager);

	return { registry, dispatcher };
}

// === Backward Compatibility ===

// Лениво инициализируемый singleton для обратной совместимости
let _mcpTools: MCPTools | null = null;

function getMCPTools(): MCPTools {
	if (!_mcpTools) {
		_mcpTools = createMCPTools();
	}
	return _mcpTools;
}

/**
 * Get ST tool definitions for MCP ListTools.
 * Backward compatible — вызывает registry.getToolDefinitions().
 */
export function getSTToolDefinitions(): MCPToolDefinition[] {
	const { registry } = getMCPTools();
	const result: MCPToolDefinition[] = [];
	for (const [, def] of registry) {
		const jsonSchema = zodToJsonSchema(def.inputSchema) as Record<
			string,
			unknown
		>;
		result.push({
			name: def.name,
			description: def.description,
			inputSchema: stripDirectoryFromSchema(jsonSchema) as Record<
				string,
				unknown
			>,
		});
	}
	return result;
}

/**
 * Handle ST tool calls.
 * Backward compatible — делегирует dispatcher.dispatch().
 */
export async function handleSTToolCall(
	name: string,
	args: any,
	reporter?: ProgressReporter,
): Promise<any> {
	const { dispatcher } = getMCPTools();
	return dispatcher.dispatch(name, args, reporter);
}
