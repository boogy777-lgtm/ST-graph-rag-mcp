/**
 * Zod Schemas for ST MCP Tools
 *
 * All schemas are defined here to avoid circular dependencies
 * and allow sharing between handlers and st-tools.ts
 */

import { z } from "zod";

// === Core Schemas ===

export const IndexSchema = z.object({
	directory: z.string().optional(),
	lspPath: z.string().optional(),
	incremental: z.boolean().optional().default(true),
	showConsole: z.boolean().optional().default(true),
	forceReindex: z.boolean().optional().default(false),
	filePaths: z.array(z.string()).optional(),
	useHir: z.boolean().optional().default(true),
});

export const SearchSchema = z.object({
	query: z.string().describe("search: entity name or free-text"),
	type: z
		.enum(["FUNCTION_BLOCK", "PROGRAM", "METHOD", "TYPE", "ENUM", "VARIABLE"])
		.optional(),
	limit: z.number().optional().default(100),
	varType: z.string().optional(),
	direction: z.string().optional(),
	pouType: z.string().optional(),
	caseSensitive: z.boolean().optional().default(false),
	useRegex: z.boolean().optional().default(false),
	mode: z.enum(["search", "resolve"]).optional().default("search"),
	directory: z.string().optional(),
});

export const ReferencesSchema = z.object({
	entityName: z.string().describe("entity name for references"),
	directory: z.string().optional(),
});

export const CallHierarchySchema = z.object({
	entityName: z.string().describe("entity name"),
	direction: z
		.enum(["incoming", "outgoing", "both"])
		.optional()
		.default("both"),
	directory: z.string().optional(),
});

export const GraphHealthSchema = z.object({
	mode: z
		.enum(["basic", "extended", "metrics", "stats", "full"])
		.optional()
		.default("full"),
	directory: z.string().optional(),
});

export const BatchIndexSchema = z.object({
	sessionId: z.string().optional(),
	directory: z.string().optional(),
	excludePatterns: z.array(z.string()).optional(),
	incremental: z.boolean().optional().default(true),
	fullScan: z.boolean().optional().default(false),
	reset: z.boolean().optional().default(false),
	maxFilesPerBatch: z.number().optional().default(25),
	statusOnly: z.boolean().optional().default(false),
	abort: z.boolean().optional().default(false),
});

// === Phase 2 Schemas ===

export const VariableFlowSchema = z.object({
	pouName: z.string().describe("POU name for variable flow"),
	directory: z.string().optional(),
});

export const FBInstancesSchema = z.object({
	fbName: z.string().describe("FB type name for instances"),
	directory: z.string().optional(),
});

export const CallChainSchema = z.object({
	pouName: z.string().describe("start POU for call chain"),
	maxDepth: z.number().optional().default(10),
	limit: z.number().optional().default(50),
	directory: z.string().optional(),
});

export const GlobalVarsSchema = z.object({
	varName: z.string().optional(),
	limit: z.number().optional().default(50),
	directory: z.string().optional(),
});

export const ImpactAnalysisSchema = z.object({
	entityName: z.string().describe("entity name for impact analysis"),
	limit: z.number().optional().default(50),
	directory: z.string().optional(),
});

export const CodeMetricsSchema = z.object({
	pouName: z.string().optional(),
	filePath: z.string().optional(),
	limit: z.number().optional().default(50),
	mode: z.enum(["metrics", "hotspots"]).optional().default("metrics"),
	metric: z
		.enum(["dependents", "complexity", "variables", "combined"])
		.optional()
		.default("combined"),
	directory: z.string().optional(),
});

// === Phase 3 Schemas ===

export const StateMachineSchema = z.object({
	pouName: z.string().optional(),
	directory: z.string().optional(),
});

export const GraphHealthExtendedSchema = z.object({});

export const DataFlowGraphSchema = z.object({
	startPou: z.string().describe("start POU for data flow"),
	directory: z.string().optional(),
});

// === Utility Schemas ===

export const GetVersionSchema = z.object({});

export const ResetGraphSchema = z.object({
	force: z.boolean().optional().default(false),
});

// === SQL-Graph Schemas ===

export const ListFileEntitiesSchema = z.object({
	filePath: z.string().describe("ST file path"),
	entityTypes: z.array(z.string()).optional(),
	directory: z.string().optional(),
});

export const GetGraphSchema = z.object({
	limit: z.number().optional().default(100),
	cursor: z.string().optional(),
	includeTypes: z.array(z.string()).optional(),
	directory: z.string().optional(),
});

export const GetEntitySourceSchema = z.object({
	entityName: z.string().describe("entity name for source"),
	entityType: z.string().optional(),
	contextLines: z.number().optional().default(5),
	directory: z.string().optional(),
});

export const DetectCodeClonesSchema = z.object({
	minVariables: z.number().optional().default(3),
	scope: z.enum(["all", "pou", "type"]).optional().default("all"),
	directory: z.string().optional(),
});

// === Extend Schemas ===

export const STResolveEntitySchema = z.object({
	name: z.string().describe("entity name to resolve"),
	entityType: z.string().optional(),
	limit: z.number().optional().default(10),
});

export const STAnalyzeHotspotsSchema = z.object({
	metric: z
		.enum(["dependents", "complexity", "variables", "combined"])
		.optional()
		.default("combined"),
	limit: z.number().optional().default(10),
});

export const STGetMetricsSchema = z.object({});

export const STGetGraphStatsSchema = z.object({});

// === Phase 6 Schemas (Obsidian Vault Exporter) ===

export const ObsidianExportSchema = z
	.object({
		vaultPath: z
			.string()
			.min(1)
			.describe(
				"Absolute path to the Obsidian vault root (directory containing the .obsidian folder)",
			),
		mode: z
			.enum(["full", "incremental"])
			.optional()
			.default("incremental")
			.describe(
				"full: rewrite all pages. incremental: skip files whose SHA256 matches the cache (default)",
			),
		includeMermaid: z
			.boolean()
			.optional()
			.default(true)
			.describe("Render Mermaid graph in the root index (default true)"),
	})
	.strict();

export type ObsidianExportArgs = z.infer<typeof ObsidianExportSchema>;

// === AI/ML Schemas ===

export const QuerySchema = z.object({
	question: z.string().describe("natural language question"),
	limit: z.number().optional().default(10),
	directory: z.string().optional(),
});

export const SuggestRefactoringSchema = z.object({
	entityName: z.string().describe("POU name for refactoring"),
	sourceCode: z.string().optional(),
	directory: z.string().optional(),
});

// === Unified Schemas ===

export const UnifiedQuerySchema = z.object({
	operation: z.string().describe("unified operation name"),
	params: z.record(z.unknown()).optional(),
	directory: z.string().optional(),
});

export const UnifiedIndexSchema = z.object({
	directory: z.string().optional(),
	lspPath: z.string().optional(),
	incremental: z.boolean().optional().default(true),
	forceReindex: z.boolean().optional().default(false),
});

export const UnifiedHealthSchema = z.object({
	mode: z
		.enum(["basic", "extended", "metrics", "stats", "full"])
		.optional()
		.default("full"),
	directory: z.string().optional(),
});
