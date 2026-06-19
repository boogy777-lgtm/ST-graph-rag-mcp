/**
 * Core ST MCP Handlers
 *
 * Основные handlers: index, search, references, call_hierarchy, batch_index, graph_health
 */

import { resolve } from "path";
import { BatchIndexConfig, BatchIndexer } from "../../st/batch-indexer";
import { STIndexer } from "../../st/indexer";
import type { STSQLiteManager } from "../../st/sqlite-manager";
import type { ToolHelpers } from "../registry";
import { workspaceManager } from "../workspace-manager";
import {
	BatchIndexSchema,
	CallHierarchySchema,
	GraphHealthSchema,
	IndexSchema,
	ReferencesSchema,
	SearchSchema,
} from "./schemas";

// Re-export getSQLiteManager for use by other handlers that need it
export { getSQLiteManager };

/**
 * Get SQLite manager for a workspace.
 * Delegates to WorkspaceManager singleton.
 */
function getSQLiteManager(workspace?: string): STSQLiteManager | null {
	return workspaceManager.getSQLiteManager(workspace);
}

/**
 * Get indexer instance for a workspace.
 * Delegates to WorkspaceManager singleton.
 */
export async function getIndexer(
	workspace?: string,
): Promise<STIndexer | null> {
	return workspaceManager.getIndexer(workspace);
}

/**
 * Set indexer instance for a workspace (for external initialization).
 * Delegates to WorkspaceManager singleton.
 */
export function setIndexer(
	newIndexer: STIndexer | null,
	workspace?: string,
): void {
	workspaceManager.setIndexer(newIndexer, workspace);
}

/**
 * Get last indexing stats for a workspace.
 * Delegates to WorkspaceManager singleton.
 */
export function getLastStats(workspace?: string): unknown {
	return workspaceManager.getLastStats(workspace);
}

/**
 * Get active workspace.
 * Delegates to WorkspaceManager singleton.
 */
export function getActiveWorkspace(): string {
	return workspaceManager.getActiveWorkspace();
}

/**
 * Set active workspace.
 * Delegates to WorkspaceManager singleton.
 */
export function setActiveWorkspace(workspace: string): void {
	workspaceManager.setActiveWorkspace(workspace);
}

/**
 * Shutdown all indexers.
 * Delegates to WorkspaceManager singleton.
 */
export async function shutdownAllIndexers(): Promise<void> {
	await workspaceManager.shutdownAll();
}

/**
 * Index ST files using truST LSP for semantic analysis.
 */
export async function handleIndex(
	args: any,
	helpers?: ToolHelpers,
): Promise<any> {
	const { directory, lspPath, incremental, forceReindex, filePaths, useHir } =
		IndexSchema.parse(args);

	const targetDir = directory ? resolve(directory) : resolve(process.cwd());
	const lspPathResolved = lspPath || process.env.TRUST_LSP_PATH || "trust-lsp";

	let indexer = await workspaceManager.getIndexer(targetDir);
	if (!indexer) {
		indexer = new STIndexer(lspPathResolved, targetDir);
		await indexer.start();
		workspaceManager.setIndexer(indexer, targetDir);
	}

	if (forceReindex) {
		indexer.setForceReindex(true);
	}

	try {
		let stats: any;
		if (filePaths && filePaths.length > 0) {
			stats = await indexer.indexFiles(filePaths);
		} else {
			stats = await indexer.indexAll();
		}
		workspaceManager.setLastStats(targetDir, stats);
		workspaceManager.setActiveWorkspace(targetDir);

		// Persist lspPath to DB meta for lazy reconstruction after restart
		const sqliteManager = indexer.getSQLiteManager();
		if (sqliteManager) {
			sqliteManager.setMeta("lspPath", lspPathResolved);
		}

		return {
			message: `Indexed ${stats.indexedFiles}/${stats.totalFiles} ST files`,
			stats: {
				totalFiles: stats.totalFiles,
				indexedFiles: stats.indexedFiles,
				skippedFiles: stats.skippedFiles,
				totalEntities: stats.totalEntities,
				totalEdges: stats.totalEdges,
				totalTimeMs: stats.totalTime,
			},
		};
	} finally {
		indexer.setForceReindex(false);
	}
}

/**
 * Search ST entities via SQL (bug #2 fix — exact match support).
 * Problem #5 fix: Added LIMIT parameter to prevent returning thousands of results.
 */
const DEFAULT_LIMIT = 50;

export async function handleSearch(args: any): Promise<any> {
	const parsed = SearchSchema.parse(args);
	const {
		query,
		type,
		limit,
		varType,
		direction,
		pouType,
		caseSensitive,
		useRegex,
		mode,
		directory,
	} = parsed;
	const effectiveLimit = limit === 0 ? undefined : limit || DEFAULT_LIMIT;

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	// mode='resolve' — exact entity resolution
	if (mode === "resolve") {
		const entities = sqliteManager.resolveEntity(
			query,
			type,
			effectiveLimit || 10,
		);
		if (entities.length === 0) {
			return {
				name: query,
				entityType: type || "all",
				entityCount: 0,
				entities: [],
			};
		}
		return {
			name: query,
			entityType: type || "all",
			entityCount: entities.length,
			entities: entities.map((e) => ({
				name: e.name,
				type: e.type,
				file: e.file,
				line: e.line,
				description: e.description,
			})),
		};
	}

	// Determine if advanced search mode is needed
	const isAdvanced =
		varType !== undefined || direction !== undefined || pouType !== undefined;

	if (isAdvanced) {
		// Advanced search: uses searchAdvanced with multiple filters
		const allResults = sqliteManager.searchAdvanced({
			varType,
			direction,
			pouType,
			query,
		});
		const results = effectiveLimit
			? allResults.slice(0, effectiveLimit)
			: allResults;

		// Group by POU
		const pouMap = new Map<string, { pou: any; variables: any[] }>();
		for (const row of results) {
			if (!pouMap.has(row.id)) {
				pouMap.set(row.id, {
					pou: {
						name: row.name,
						type: row.pou_type,
						file: row.file_path,
						line: row.start_line,
					},
					variables: [],
				});
			}
			if (row.var_name) {
				pouMap.get(row.id)!.variables.push({
					name: row.var_name,
					direction: row.direction,
					type: row.var_type,
					defaultValue: row.default_value,
				});
			}
		}

		const pous = Array.from(pouMap.values()).map((entry) => ({
			...entry.pou,
			variableCount: entry.variables.length,
			variables: entry.variables,
		}));

		return {
			method: "advanced_search",
			filters: { varType, direction, pouType, query },
			resultCount: pous.length,
			totalCount: allResults.length,
			hasMore: effectiveLimit ? allResults.length > effectiveLimit : false,
			limit: effectiveLimit,
			pous,
		};
	}

	// Basic search: uses LIKE for flexible matching
	const pous = sqliteManager.searchPOUs(query, type, effectiveLimit);
	const types = sqliteManager.searchTypes(query, effectiveLimit);
	const fields = sqliteManager.searchFieldsByName(query, effectiveLimit);

	const allEntities = [
		...pous.map((p) => ({
			name: p.name,
			type: p.pou_type,
			file: p.file_path,
			line: p.start_line,
			parent: p.namespace,
			signature: p.signature,
		})),
		...types.map((t) => ({
			name: t.name,
			type: t.type_kind,
			file: t.file_path,
			line: t.start_line,
			parent: null,
			definition: t.definition,
		})),
		...fields.map((f) => ({
			name: f.name,
			type: "FIELD",
			file: f.file_path,
			line: f.start_line,
			parent: f.parent_type_id,
			dataType: f.field_type,
		})),
	];

	const filteredEntities = type
		? allEntities.filter((e) => e.type === type)
		: allEntities;
	const results = effectiveLimit
		? filteredEntities.slice(0, effectiveLimit)
		: filteredEntities;

	return {
		method: "basic_search",
		query,
		type: type || "all",
		limit: effectiveLimit,
		count: results.length,
		entities: results,
	};
}

/**
 * Get references via SQL exact match (bug #2 fix).
 * Uses WHERE to_id = ? or from_id = ? instead of substring includes().
 */
export async function handleReferences(args: any): Promise<any> {
	const { entityName, directory } = ReferencesSchema.parse(args);

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	// Find the entity by exact name
	const pou = sqliteManager.getPOUByNameExact(entityName);
	if (!pou) {
		return {
			entityName,
			referenceCount: 0,
			references: [],
		};
	}

	// Get all relationships where this entity is involved (exact ID match)
	const relationships = sqliteManager.getRelationshipsByEntityId(pou.id);

	return {
		entityName,
		entityId: pou.id,
		referenceCount: relationships.length,
		references: relationships.map((r) => ({
			type: r.type,
			file: r.file_path,
			line: r.line,
		})),
	};
}

/**
 * Get call hierarchy via SQL (bug #1 fix — CALLS edges stored in SQLite).
 */
export async function handleCallHierarchy(args: any): Promise<any> {
	const { entityName, direction, directory } = CallHierarchySchema.parse(args);

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	// Find the entity by exact name
	const pou = sqliteManager.getPOUByNameExact(entityName);
	if (!pou) {
		return {
			entityName,
			direction,
			incomingCount: 0,
			outgoingCount: 0,
			incoming: [],
			outgoing: [],
		};
	}

	let incoming: any[] = [];
	let outgoing: any[] = [];

	if (direction === "incoming" || direction === "both") {
		// Who calls this entity? (to_id = entity.id)
		const incomingRels = sqliteManager.getIncomingCalls(pou.id);
		incoming = incomingRels.map((r) => ({
			file: r.file_path,
			line: r.line,
		}));
	}

	if (direction === "outgoing" || direction === "both") {
		// Who does this entity call? (from_id = entity.id)
		const outgoingRels = sqliteManager.getOutgoingCalls(pou.id);
		outgoing = outgoingRels.map((r) => ({
			file: r.file_path,
			line: r.line,
		}));
	}

	return {
		entityName,
		entityId: pou.id,
		direction,
		incomingCount: incoming.length,
		outgoingCount: outgoing.length,
		incoming,
		outgoing,
	};
}

/**
 * Get graph health from SQLite — unified health/metrics/stats endpoint.
 * mode: 'basic' → simple health, 'extended' → orphans+stale, 'metrics' → codebase overview,
 *       'stats' → graph stats, 'full' → all combined.
 */
export async function handleGraphHealth(args: any = {}): Promise<any> {
	const { mode, directory } = GraphHealthSchema.parse(args);

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return {
			status: "not_indexed",
			message: "Call index first to build the graph",
		};
	}

	const health = sqliteManager.getGraphHealth();

	const base = {
		status: health.status,
		lastStats: getLastStats(directory),
		entities: health.entities,
		edges: health.edges,
		files: health.files,
	};

	if (mode === "basic") {
		return base;
	}

	if (mode === "extended") {
		const extended = sqliteManager.getGraphHealthExtended();
		return {
			...base,
			extended: {
				orphanEntities: extended.orphanEntities,
				staleFiles: extended.staleFiles,
				stats: extended.stats,
			},
		};
	}

	if (mode === "metrics") {
		const metrics = sqliteManager.getMetrics();
		return {
			...base,
			metrics: {
				totalFiles: metrics.totalFiles,
				totalPous: metrics.totalPous,
				totalTypes: metrics.totalTypes,
				totalVariables: metrics.totalVariables,
				totalRelationships: metrics.totalRelationships,
				avgVariablesPerPou: metrics.avgVariablesPerPou,
			},
		};
	}

	if (mode === "stats") {
		const stats = sqliteManager.getGraphStats();
		return {
			...base,
			stats: {
				entityTypes: stats.entityTypes,
				relationshipTypes: stats.relationshipTypes,
				mostConnected: stats.mostConnected.filter(
					(e: any) => e.connections > 0,
				),
			},
		};
	}

	// mode === 'full' — return everything
	const extended = sqliteManager.getGraphHealthExtended();
	const metrics = sqliteManager.getMetrics();
	const stats = sqliteManager.getGraphStats();
	return {
		...base,
		extended: {
			orphanEntities: extended.orphanEntities,
			staleFiles: extended.staleFiles,
			stats: extended.stats,
		},
		metrics: {
			totalFiles: metrics.totalFiles,
			totalPous: metrics.totalPous,
			totalTypes: metrics.totalTypes,
			totalVariables: metrics.totalVariables,
			totalRelationships: metrics.totalRelationships,
			avgVariablesPerPou: metrics.avgVariablesPerPou,
		},
		stats: {
			entityTypes: stats.entityTypes,
			relationshipTypes: stats.relationshipTypes,
			mostConnected: stats.mostConnected.filter((e: any) => e.connections > 0),
		},
	};
}

/**
 * Batch index — async indexing with sessions, progress, and cancellation.
 */
export async function handleBatchIndex(args: any): Promise<any> {
	const parsed = BatchIndexSchema.parse(args);
	const { sessionId, statusOnly, abort } = parsed;

	const directory = parsed.directory
		? resolve(parsed.directory)
		: workspaceManager.getActiveWorkspace();

	const ws = workspaceManager.resolveWs(directory);
	let batchIndexer = workspaceManager.getBatchIndexer(ws);
	if (!batchIndexer) {
		const indexer = await workspaceManager.getIndexer(directory);
		if (!indexer) {
			return {
				error: `Workspace '${directory}' not indexed. Run index first.`,
			};
		}
		batchIndexer = new BatchIndexer(directory, indexer);
		workspaceManager.setBatchIndexer(batchIndexer, ws);
	}

	// Abort request
	if (abort) {
		if (!sessionId) {
			return { error: "sessionId is required for abort" };
		}
		const result = batchIndexer.abortSession(sessionId);
		if (!result) {
			return { error: `Session '${sessionId}' not found` };
		}
		return result;
	}

	// Status-only request
	if (statusOnly) {
		if (!sessionId) {
			// Return all sessions
			const sessions = batchIndexer.listSessions();
			return { sessions, count: sessions.length };
		}
		const result = batchIndexer.getSessionStatus(sessionId);
		if (!result) {
			return { error: `Session '${sessionId}' not found` };
		}
		return result;
	}

	// Start new session
	const result = await batchIndexer.startSession({
		directory: parsed.directory || directory,
		excludePatterns: parsed.excludePatterns,
		incremental: parsed.incremental,
		fullScan: parsed.fullScan,
		reset: parsed.reset,
		maxFilesPerBatch: parsed.maxFilesPerBatch,
		sessionId: parsed.sessionId,
	});

	return result;
}
