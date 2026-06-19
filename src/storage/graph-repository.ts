/**
 * Graph Repository
 *
 * Cross-entity queries against the graph structure (POU + types + variables
 * + relationships + variable lists). Provides file-scoped entity lookups,
 * graph node/edge pagination, FB instance lookup with POU context, and
 * semantic entity resolution (POU / TYPE).
 *
 * Extracted from AnalyticsRepository (Phase 5: M8).
 */

import type {
	FileEntity,
	GraphEdge,
	GraphNode,
	ResolvedEntity,
} from "../st/sqlite-manager";
import type { IDatabase } from "./interfaces";

export class GraphRepository {
	private readonly getFBInstancesWithPOUStmt;
	private readonly getFilePousStmt;
	private readonly getFileTypesStmt;
	private readonly getFileGlobalVarsStmt;
	private readonly getGraphNodesPousStmt;
	private readonly getGraphNodesTypesStmt;
	private readonly resolveEntityExactStmt;
	private readonly resolveEntityLikeStmt;
	private readonly resolveTypeExactStmt;
	private readonly resolveTypeLikeStmt;
	private readonly detectCodeClonesStmt;
	private readonly searchAdvancedStmt;

	constructor(private db: IDatabase) {
		this.getFBInstancesWithPOUStmt = db.raw.query(`
			SELECT
				p.name as pouName,
				p.pou_type as pouType,
				p.file_path as file,
				v.name as varName,
				v.direction,
				v.start_line as line
			FROM st_variables v
			INNER JOIN st_pous p ON v.pou_id = p.id
			WHERE v.var_type = ?
			ORDER BY p.name, v.name
		`);

		this.getFilePousStmt = db.raw.query(`
			SELECT id, name, pou_type as type, start_line as line
			FROM st_pous
			WHERE file_path = ?
			ORDER BY start_line
		`);
		this.getFileTypesStmt = db.raw.query(`
			SELECT id, name, type_kind as type, start_line as line
			FROM st_types
			WHERE file_path = ?
			ORDER BY start_line
		`);
		this.getFileGlobalVarsStmt = db.raw.query(`
			SELECT id, name, direction as type, start_line as line
			FROM st_variable_lists
			WHERE file_path = ?
			ORDER BY start_line
		`);

		this.getGraphNodesPousStmt = db.raw.query(`
			SELECT id, name, pou_type as type, file_path as file
			FROM st_pous
			ORDER BY file_path, start_line
			LIMIT ? OFFSET ?
		`);
		this.getGraphNodesTypesStmt = db.raw.query(`
			SELECT id, name, type_kind as type, file_path as file
			FROM st_types
			ORDER BY file_path, start_line
			LIMIT ? OFFSET ?
		`);

		this.resolveEntityExactStmt = db.raw.query(`
			SELECT id, name, pou_type as type, file_path as file, start_line as line, signature as description
			FROM st_pous
			WHERE name = ?
			ORDER BY pou_type, file_path
			LIMIT ?
		`);
		this.resolveEntityLikeStmt = db.raw.query(`
			SELECT id, name, pou_type as type, file_path as file, start_line as line, signature as description
			FROM st_pous
			WHERE name LIKE ?
			ORDER BY pou_type, file_path
			LIMIT ?
		`);
		this.resolveTypeExactStmt = db.raw.query(`
			SELECT id, name, type_kind as type, file_path as file, start_line as line, definition as description
			FROM st_types
			WHERE name = ?
			ORDER BY type_kind, file_path
			LIMIT ?
		`);
		this.resolveTypeLikeStmt = db.raw.query(`
			SELECT id, name, type_kind as type, file_path as file, start_line as line, definition as description
			FROM st_types
			WHERE name LIKE ?
			ORDER BY type_kind, file_path
			LIMIT ?
		`);

		this.detectCodeClonesStmt = db.raw.query(`
			SELECT
				p.name,
				p.pou_type as type,
				p.file_path as file,
				GROUP_CONCAT(v.name || ':' || v.var_type, ';') as signature
			FROM st_pous p
			INNER JOIN st_variables v ON v.pou_id = p.id
			WHERE v.direction IN ('VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT')
			GROUP BY p.id
			HAVING COUNT(*) >= ?
			ORDER BY signature, p.name
		`);

		this.searchAdvancedStmt = db.raw.query(`
			SELECT p.id, p.name, p.pou_type, p.file_path, p.start_line, p.end_line, p.namespace,
				v.id as var_id, v.name as var_name, v.direction, v.var_type, v.default_value
			FROM st_pous p
			LEFT JOIN st_variables v ON v.pou_id = p.id
			WHERE (? = '' OR v.direction = ?)
				AND (? = '' OR v.var_type LIKE ?)
				AND (? = '' OR p.pou_type = ?)
				AND (? = '' OR p.name LIKE ? OR v.name LIKE ?)
				AND (? = '' OR p.file_path LIKE ?)
			GROUP BY p.id
			ORDER BY p.file_path, p.start_line
		`);
	}

	// === File-scoped entity lookups ===

	getFilePous(filePath: string): FileEntity[] {
		return this.getFilePousStmt.all(filePath) as FileEntity[];
	}

	getFileTypes(filePath: string): FileEntity[] {
		return this.getFileTypesStmt.all(filePath) as FileEntity[];
	}

	getFileGlobalVars(filePath: string): FileEntity[] {
		return this.getFileGlobalVarsStmt.all(filePath) as FileEntity[];
	}

	// === Graph node/edge pagination ===

	getGraphNodesPous(limit: number, offset: number): GraphNode[] {
		return this.getGraphNodesPousStmt.all(limit, offset) as GraphNode[];
	}

	getGraphNodesTypes(limit: number, offset: number): GraphNode[] {
		return this.getGraphNodesTypesStmt.all(limit, offset) as GraphNode[];
	}

	getGraphEdgesBySourceIds(sourceIds: string[]): GraphEdge[] {
		if (sourceIds.length === 0) return [];
		const placeholders = sourceIds.map(() => "?").join(",");
		const query = `
			SELECT from_id as source, to_id as target, type
			FROM st_relationships
			WHERE from_id IN (${placeholders})
			ORDER BY from_id, type
		`;
		return this.db.raw.query(query).all(...sourceIds) as GraphEdge[];
	}

	// === FB instance lookup with POU context ===

	getFBInstancesWithPOU(fbName: string): Array<{
		pouName: string;
		pouType: string;
		file: string;
		varName: string;
		direction: string;
		line: number | null;
	}> {
		return this.getFBInstancesWithPOUStmt.all(fbName) as Array<{
			pouName: string;
			pouType: string;
			file: string;
			varName: string;
			direction: string;
			line: number | null;
		}>;
	}

	// === Entity resolution (POU / TYPE) ===

	resolveEntity(
		name: string,
		entityType?: string,
		limit = 10,
	): ResolvedEntity[] {
		const results: ResolvedEntity[] = [];

		if (
			!entityType ||
			entityType === "POU" ||
			entityType === "FUNCTION_BLOCK" ||
			entityType === "PROGRAM" ||
			entityType === "FUNCTION" ||
			entityType === "METHOD" ||
			entityType === "CLASS"
		) {
			let pouResults = this.resolveEntityExactStmt.all(
				name,
				limit,
			) as ResolvedEntity[];
			if (pouResults.length === 0) {
				const likeTerm = `%${name}%`;
				pouResults = this.resolveEntityLikeStmt.all(
					likeTerm,
					limit,
				) as ResolvedEntity[];
			}
			results.push(...pouResults);
		}

		if (
			!entityType ||
			entityType === "TYPE" ||
			entityType === "STRUCT" ||
			entityType === "ENUM" ||
			entityType === "ARRAY"
		) {
			let typeResults = this.resolveTypeExactStmt.all(
				name,
				limit,
			) as ResolvedEntity[];
			if (typeResults.length === 0) {
				const likeTerm = `%${name}%`;
				typeResults = this.resolveTypeLikeStmt.all(
					likeTerm,
					limit,
				) as ResolvedEntity[];
			}
			results.push(...typeResults);
		}

		return results.slice(0, limit);
	}

	// === Code clone detection (signature-based) ===

	detectCodeClones(minVars: number): Array<{
		name: string;
		type: string;
		file: string;
		signature: string;
	}> {
		return this.detectCodeClonesStmt.all(minVars) as Array<{
			name: string;
			type: string;
			file: string;
			signature: string;
		}>;
	}

	// === Advanced search with multi-filter support ===

	searchAdvanced(params: {
		varType?: string;
		direction?: string;
		pouType?: string;
		query?: string;
		filePath?: string;
	}): Array<{
		id: string;
		name: string;
		pou_type: string;
		file_path: string;
		start_line: number;
		end_line: number | null;
		namespace: string | null;
		var_id: string | null;
		var_name: string | null;
		direction: string | null;
		var_type: string | null;
		default_value: string | null;
	}> {
		const {
			varType = "",
			direction = "",
			pouType = "",
			query = "",
			filePath = "",
		} = params;
		const likeVarType = varType ? `%${varType}%` : "";
		const likeQuery = query ? `%${query}%` : "";
		const likeFilePath = filePath ? `%${filePath}%` : "";
		return this.searchAdvancedStmt.all(
			direction,
			direction,
			likeVarType,
			likeVarType,
			pouType,
			pouType,
			likeQuery,
			likeQuery,
			likeQuery,
			likeFilePath,
			likeFilePath,
		) as Array<{
			id: string;
			name: string;
			pou_type: string;
			file_path: string;
			start_line: number;
			end_line: number | null;
			namespace: string | null;
			var_id: string | null;
			var_name: string | null;
			direction: string | null;
			var_type: string | null;
			default_value: string | null;
		}>;
	}
}
