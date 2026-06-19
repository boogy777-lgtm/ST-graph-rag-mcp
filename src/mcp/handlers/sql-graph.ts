/**
 * SQL-Graph ST MCP Handlers
 *
 * Handlers: list_file_entities, get_graph, get_entity_source, detect_code_clones
 */

import type { STSQLiteManager } from "../../st/sqlite-manager";
import {
	DetectCodeClonesSchema,
	GetEntitySourceSchema,
	GetGraphSchema,
	ListFileEntitiesSchema,
} from "./schemas";

/**
 * Lists all ST entities (POUs, types, variables) found in a specific file.
 */
export async function handleListFileEntities(
	args: any,
	getSQLiteManager: () => STSQLiteManager | null,
): Promise<any> {
	const { filePath, entityTypes } = ListFileEntitiesSchema.parse(args);

	const sqliteManager = getSQLiteManager();
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	const entities = sqliteManager.getFileEntities(filePath, entityTypes);

	return {
		file: filePath,
		entityCount: entities.length,
		entities: entities.map((e) => ({
			id: e.id,
			name: e.name,
			type: e.type,
			line: e.line,
		})),
	};
}

/**
 * Returns the code graph as nodes and edges for visualization or analysis.
 */
export async function handleGetGraph(
	args: any,
	getSQLiteManager: () => STSQLiteManager | null,
): Promise<any> {
	const { limit, cursor, includeTypes } = GetGraphSchema.parse(args);
	const offset = cursor ? parseInt(cursor, 10) : 0;

	const sqliteManager = getSQLiteManager();
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	const { nodes, total } = sqliteManager.getGraphNodes(
		limit,
		offset,
		includeTypes,
	);

	// Get edges for the returned nodes
	const nodeIds = nodes.map((n) => n.id);
	const edges = sqliteManager.getGraphEdges(nodeIds);

	const nextCursor =
		offset + nodes.length < total ? String(offset + limit) : undefined;

	return {
		nodes,
		edges,
		total,
		nextCursor,
	};
}

/**
 * Returns the source code snippet for a specific entity with surrounding context.
 */
export async function handleGetEntitySource(
	args: any,
	getSQLiteManager: () => STSQLiteManager | null,
): Promise<any> {
	const { entityName, entityType, contextLines } =
		GetEntitySourceSchema.parse(args);

	const sqliteManager = getSQLiteManager();
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	const result = sqliteManager.getEntitySource(
		entityName,
		entityType,
		contextLines,
	);

	if (!result) {
		return {
			entityName,
			message: `Entity '${entityName}' not found in database`,
		};
	}

	return {
		entity: result.entity,
		source: result.source,
		startLine: result.startLine,
		endLine: result.endLine,
	};
}

/**
 * Detects potential code clones by finding POU/type definitions with identical variable signatures.
 */
export async function handleDetectCodeClones(
	args: any,
	getSQLiteManager: () => STSQLiteManager | null,
): Promise<any> {
	const { minVariables, scope } = DetectCodeClonesSchema.parse(args);

	const sqliteManager = getSQLiteManager();
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	const clones = sqliteManager.detectCodeClones(minVariables, scope);

	return {
		cloneGroupCount: clones.length,
		totalCloneEntities: clones.reduce((sum, c) => sum + c.entities.length, 0),
		clones: clones.map((c) => ({
			signature: c.signature,
			entityCount: c.entities.length,
			entities: c.entities,
		})),
	};
}
