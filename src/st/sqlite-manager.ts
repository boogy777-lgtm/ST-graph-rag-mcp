/**
 * ST SQLite Manager — Backward-compatible thin wrapper
 *
 * All implementation has been moved to the storage/ module (Repository Pattern).
 * This file preserves the public API so that existing imports do not break.
 */

import type { Database as BunSQLiteDatabase } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import type { STField } from "../storage/field-repository.js";
import { SQLiteDatabase } from "../storage/sqlite-database";
import { UnitOfWork } from "../storage/unit-of-work";

// === Types (preserved for backward-compatible imports) ===

export interface STPOU {
	id: string;
	name: string;
	pou_type: string;
	file_path: string;
	start_line: number;
	end_line?: number;
	namespace?: string;
	extends?: string;
	implements?: string;
	signature?: string;
	created_at: number;
	updated_at: number;
}

export interface STVariable {
	id: string;
	pou_id: string;
	name: string;
	direction: string;
	var_type: string;
	default_value?: string;
	start_line?: number;
	end_line?: number;
}

export interface STType {
	id: string;
	name: string;
	type_kind: string;
	file_path: string;
	start_line: number;
	end_line?: number;
	definition?: string;
	created_at: number;
}

export interface STRelationship {
	id: string;
	from_id: string;
	to_id: string;
	type: string;
	file_path: string;
	line?: number;
	metadata?: string;
}

export interface STDiagnostic {
	id: string;
	file_path: string;
	line: number;
	column?: number;
	severity?: number;
	code?: string;
	message: string;
	source?: string;
	created_at?: number;
}

export interface STVariableList {
	id: string;
	file_path: string;
	name: string;
	direction: string;
	start_line?: number;
	end_line?: number;
}

export interface STFile {
	path: string;
	hash: string;
	last_indexed: number;
	pou_count: number;
	var_count: number;
}

export interface STGraphHealth {
	status: string;
	entities: {
		total: number;
		byType: Record<string, number>;
	};
	edges: {
		total: number;
		byType: Record<string, number>;
	};
	files: {
		total: number;
		lastIndexed?: number;
	};
}

export interface StateMachineResult {
	pouName: string;
	pouId: string;
	filePath: string;
	states: string[];
	transitions: { from: string; to: string; condition: string; line?: number }[];
	sourceSnippet: string;
}

export interface TaskConfig {
	name: string;
	pouList: string[];
	metadata?: Record<string, unknown>;
}

export interface STGraphHealthExtended extends STGraphHealth {
	orphanEntities: {
		id: string;
		type: string;
		name: string;
		filePath: string;
	}[];
	staleFiles: { path: string; lastIndexed: number }[];
	stats: {
		avgVarsPerPOU: number;
		avgCallsPerPOU: number;
		maxCallDepth: number;
	};
}

export interface CrossFileDep {
	fromFile: string;
	toFile: string;
	type: string;
	count: number;
}

export interface DataFlowEdge {
	fromPou: string;
	fromVar: string;
	toPou: string;
	toVar: string;
}

export interface FileEntity {
	id: string;
	name: string;
	type: string;
	line: number;
}

export interface GraphNode {
	id: string;
	name: string;
	type: string;
	file: string;
}

export interface GraphEdge {
	source: string;
	target: string;
	type: string;
}

export interface EntitySource {
	name: string;
	type: string;
	file: string;
	line: number;
}

export interface EntitySourceResult {
	entity: EntitySource;
	source: string;
	startLine: number;
	endLine: number;
}

export interface ModuleImporter {
	name: string;
	type: string;
	file: string;
	line: number;
}

export interface CodeClone {
	signature: string;
	entities: { name: string; type: string; file: string }[];
}

export interface ResolvedEntity {
	id: string;
	name: string;
	type: string;
	file: string;
	line: number;
	description?: string;
}

export interface HotspotEntity {
	name: string;
	type: string;
	file: string;
	score: number;
	dependents: number;
	variables: number;
}

export interface CodeMetrics {
	totalFiles: number;
	totalPous: number;
	totalTypes: number;
	totalVariables: number;
	totalRelationships: number;
	avgVariablesPerPou: number;
}

export interface GraphStats {
	entityTypes: { type: string; count: number }[];
	relationshipTypes: { type: string; count: number }[];
	mostConnected: { name: string; connections: number }[];
}

// === Manager Class ===

export class STSQLiteManager {
	private db: SQLiteDatabase | null = null;
	private uow: UnitOfWork | null = null;

	constructor(private dbPath: string) {}

	initialize(): void {
		if (this.db) {
			console.warn("[ST SQLite] Database already initialized");
			return;
		}
		this.db = new SQLiteDatabase(this.dbPath);
		this.db.initialize();
		this.uow = new UnitOfWork(this.db);
		console.log(`[ST SQLite] Database initialized at ${this.dbPath}`);
	}

	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
			this.uow = null;
			console.log("[ST SQLite] Database connection closed");
		}
	}

	getDatabase(): BunSQLiteDatabase | null {
		return this.db?.raw ?? null;
	}

	transaction(fn: () => void): void {
		if (!this.db) throw new Error("Database not initialized");
		this.db.transaction(fn);
	}

	// === Meta ===

	setMeta(key: string, value: string): void {
		if (!this.db) throw new Error("Database not initialized");
		this.db.setMeta(key, value);
	}

	getMeta(key: string): string | null {
		if (!this.db) throw new Error("Database not initialized");
		return this.db.getMeta(key);
	}

	// === POU Operations ===

	insertPOU(pou: STPOU): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.pou.insert(pou);
	}

	updatePOU(pou: STPOU): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.pou.update(pou);
	}

	deletePOUsByFile(filePath: string): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.pou.deleteByFile(filePath);
	}

	getPOUById(id: string): STPOU | undefined {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.pou.getById(id);
	}

	getAllPOUs(): STPOU[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.pou.getAll();
	}

	searchPOUs(query: string, type?: string, limit = 100): STPOU[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.pou.searchByName(query, type, limit);
	}

	getPOUByNameExact(name: string): STPOU | undefined {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.pou.getByNameExact(name);
	}

	countPOUsByType(): Record<string, number> {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.pou.countByType();
	}

	getAllPOUNames(): Set<string> {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.pou.getAllNames();
	}

	// === Variable Operations ===

	insertVariable(variable: STVariable): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.variable.insertVariable(variable);
	}

	deleteVariablesByPOU(pouId: string): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.variable.deleteByPOU(pouId);
	}

	getVariablesByPOU(pouId: string): STVariable[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.variable.getByPOU(pouId);
	}

	getVariablesByDirection(direction: string): STVariable[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.variable.getByDirection(direction);
	}

	getVariablesByType(varType: string): STVariable[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.variable.getByType(varType);
	}

	getFBInstancesWithPOU(fbName: string): Array<{
		pouName: string;
		pouType: string;
		file: string;
		varName: string;
		direction: string;
		line: number | null;
	}> {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.graph.getFBInstancesWithPOU(fbName);
	}

	getGlobalVariables(): STVariableList[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.variable.getGlobalVariables();
	}

	searchGlobalVariablesByName(name: string): STVariableList[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.variable.searchGlobalVariablesByName(name);
	}

	findVariablesUsingType(typeName: string): STVariable[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.variable.findVariablesUsingType(typeName);
	}

	// === Type Operations ===

	insertType(type: STType): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.type.insert(type);
	}

	deleteTypesByFile(filePath: string): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.type.deleteByFile(filePath);
	}

	searchTypes(query: string, limit = 100): STType[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.type.searchByName(query, limit);
	}

	getTypeById(id: string): STType | undefined {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.type.getById(id);
	}

	getAllTypes(): STType[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.type.getAll();
	}

	getTypeByName(name: string): STType | undefined {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.type.getByNameExact(name);
	}

	searchTypesByDefinition(searchTerm: string): STType[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.type.searchByDefinition(searchTerm);
	}

	// === Relationship Operations ===

	insertRelationship(rel: STRelationship): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.relationship.insert(rel);
	}

	deleteRelationshipsByFile(filePath: string): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.relationship.deleteByFile(filePath);
	}

	getRelationshipsByEntityId(entityId: string): STRelationship[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.relationship.getByEntityId(entityId);
	}

	getOutgoingCalls(entityId: string): STRelationship[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.relationship.getOutgoingCalls(entityId);
	}

	getIncomingCalls(entityId: string): STRelationship[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.relationship.getIncomingCalls(entityId);
	}

	getRecursiveCallChain(fromId: string, maxDepth = 10): STRelationship[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.relationship.getRecursiveCallChain(fromId, maxDepth);
	}

	getAncestors(
		entityId: string,
		maxDepth = 20,
	): Array<{ id: string; name: string; file_path: string; depth: number }> {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.relationship.getAncestors(entityId, maxDepth);
	}

	getDescendants(
		entityId: string,
		maxDepth = 20,
	): Array<{ id: string; name: string; file_path: string; depth: number }> {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.relationship.getDescendants(entityId, maxDepth);
	}

	getInterfaceImplementers(
		interfaceName: string,
	): Array<{ id: string; name: string; file_path: string; pou_type: string }> {
		if (!this.uow) throw new Error("Database not initialized");
		const ifaceType = this.uow.type.getByNameExact(interfaceName);
		if (!ifaceType) {
			return this.db!.raw.prepare(`
					SELECT p.id, p.name, p.file_path, p.pou_type
					FROM st_pous p
					INNER JOIN st_relationships r ON r.from_id = p.id
					INNER JOIN st_types t ON r.to_id = t.id
					WHERE r.type = 'IMPLEMENTS' AND t.name = ?
					ORDER BY p.name
				`).all(interfaceName) as Array<{
				id: string;
				name: string;
				file_path: string;
				pou_type: string;
			}>;
		}
		return this.uow.relationship.getInterfaceImplementers(ifaceType.id);
	}

	getDirectDependents(entityName: string): Array<{
		id: string;
		name: string;
		pou_type: string;
		file_path: string;
		rel_type: string;
	}> {
		if (!this.uow) throw new Error("Database not initialized");
		const pou = this.uow.pou.getByNameExact(entityName);
		if (!pou) {
			const type = this.uow.type.getByNameExact(entityName);
			if (!type) return [];
			return this.db!.raw.prepare(`
					SELECT p.id, p.name, p.pou_type, p.file_path, r.type as rel_type
					FROM st_pous p
					INNER JOIN st_relationships r ON r.from_id = p.id
					WHERE r.to_id = ?
					ORDER BY r.type, p.name
				`).all(type.id) as Array<{
				id: string;
				name: string;
				pou_type: string;
				file_path: string;
				rel_type: string;
			}>;
		}
		return this.uow.relationship.getDirectDependents(pou.id);
	}

	getTransitiveDependents(
		entityName: string,
		maxDepth = 20,
	): Array<{
		id: string;
		name: string;
		pou_type: string;
		file_path: string;
		rel_type: string;
		depth: number;
	}> {
		if (!this.uow) throw new Error("Database not initialized");
		const pou = this.uow.pou.getByNameExact(entityName);
		if (!pou) {
			const type = this.uow.type.getByNameExact(entityName);
			if (!type) return [];
			return this.db!.raw.prepare(`
					WITH RECURSIVE dependents AS (
						SELECT p.id, p.name, p.pou_type, p.file_path, r.type as rel_type, 1 as depth, ',' || p.id || ',' as visited
						FROM st_pous p
						INNER JOIN st_relationships r ON r.from_id = p.id
						WHERE r.to_id = ?
						UNION ALL
						SELECT p.id, p.name, p.pou_type, p.file_path, r.type, d.depth + 1, d.visited || p.id || ','
						FROM st_pous p
						INNER JOIN st_relationships r ON r.from_id = p.id
						INNER JOIN dependents d ON r.to_id = d.id
						WHERE r.type != 'CONTAINS'
							AND d.depth < ?
							AND d.visited NOT LIKE '%,' || p.id || ',%'
					)
					SELECT DISTINCT id, name, pou_type, file_path, rel_type, depth
					FROM dependents
					ORDER BY depth, name
				`).all(type.id, maxDepth) as Array<{
				id: string;
				name: string;
				pou_type: string;
				file_path: string;
				rel_type: string;
				depth: number;
			}>;
		}
		return this.uow.relationship.getTransitiveDependents(pou.id, maxDepth);
	}

	// === File Operations ===

	upsertFile(file: STFile): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.file.insertOrUpdate(file);
	}

	getFileByPath(path: string): STFile | undefined {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.file.getByPath(path);
	}

	getAllFiles(): STFile[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.file.getAll();
	}

	deleteFile(path: string): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.file.delete(path);
	}

	countFiles(): number {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.file.count();
	}

	// === Diagnostic Operations ===

	insertDiagnostic(diag: STDiagnostic): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.diagnostic.insert(diag);
	}

	deleteDiagnosticsByFile(filePath: string): void {
		if (!this.uow) throw new Error("Database not initialized");
		this.uow.diagnostic.deleteByFile(filePath);
	}

	getDiagnosticsByFile(filePath: string): STDiagnostic[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.diagnostic.getByFile(filePath);
	}

	getDiagnosticsBySeverity(severity: number): STDiagnostic[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.diagnostic.getBySeverity(severity);
	}

	// === Graph Health ===

	getGraphHealth(): STGraphHealth {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.metrics.getGraphHealth(
			() => this.uow!.pou.countByType(),
			() => this.uow!.relationship.countByType(),
			() => this.uow!.file.count(),
		);
	}

	getGraphHealthExtended(): STGraphHealthExtended {
		if (!this.uow) throw new Error("Database not initialized");
		const base = this.getGraphHealth();
		return this.uow.metrics.getGraphHealthExtended(
			base,
			(name) => this.uow!.type.getByNameExact(name),
			(name) => this.uow!.pou.getByNameExact(name),
		);
	}

	// === Phase 2: Code Metrics ===

	getPOUMetrics(pouName: string):
		| {
				id: string;
				name: string;
				pou_type: string;
				file_path: string;
				lines: number;
				input_vars: number;
				output_vars: number;
				internal_vars: number;
				total_vars: number;
				calls: number;
		  }
		| undefined {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.metrics.getPOUMetrics(pouName);
	}

	getAllPOUMetrics(filePath?: string): Array<{
		id: string;
		name: string;
		pou_type: string;
		file_path: string;
		lines: number;
		input_vars: number;
		output_vars: number;
		internal_vars: number;
		total_vars: number;
		calls: number;
	}> {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.metrics.getAllPOUMetrics(filePath);
	}

	// === Phase 2: Advanced Search ===

	searchAdvanced(params: {
		varType?: string;
		direction?: string;
		pouType?: string;
		query?: string;
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
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.graph.searchAdvanced(params);
	}

	// === Bulk Insert ===

	bulkInsertFileData(
		filePath: string,
		hash: string,
		pous: STPOU[],
		variableLists: STVariableList[],
		variables: STVariable[],
		types: STType[],
		relationships: STRelationship[],
		fields: STField[],
	): { skippedVars: number; skippedRels: number; skippedFields: number } {
		if (!this.uow) throw new Error("Database not initialized");
		const skipped = this.uow.bulkInsertFileData(
			filePath,
			hash,
			pous,
			variableLists,
			variables,
			types,
			relationships,
			fields,
		);
		if (
			skipped.skippedVars > 0 ||
			skipped.skippedRels > 0 ||
			skipped.skippedFields > 0
		) {
			console.error(
				`[ST SQLite] ${filePath}: skipped ${skipped.skippedVars} vars, ${skipped.skippedRels} rels, ${skipped.skippedFields} fields`,
			);
		}
		return skipped;
	}

	// === Complex Operations ===

	resetGraph(): { deletedEntities: number; deletedRelationships: number } {
		if (!this.db) throw new Error("Database not initialized");

		const entityCount =
			(
				this.db.raw.prepare(`SELECT COUNT(*) as cnt FROM st_pous`).get() as {
					cnt: number;
				}
			).cnt +
			(
				this.db.raw.prepare(`SELECT COUNT(*) as cnt FROM st_types`).get() as {
					cnt: number;
				}
			).cnt +
			(
				this.db.raw
					.prepare(`SELECT COUNT(*) as cnt FROM st_variables`)
					.get() as {
					cnt: number;
				}
			).cnt;

		const relCount = (
			this.db.raw
				.prepare(`SELECT COUNT(*) as cnt FROM st_relationships`)
				.get() as { cnt: number }
		).cnt;

		this.db.raw.exec("DELETE FROM st_relationships");
		this.db.raw.exec("DELETE FROM st_variables");
		this.db.raw.exec("DELETE FROM st_pous");
		this.db.raw.exec("DELETE FROM st_types");
		this.db.raw.exec("DELETE FROM st_files");
		this.db.raw.exec("DELETE FROM st_diagnostics");

		return {
			deletedEntities: entityCount,
			deletedRelationships: relCount,
		};
	}

	cleanStaleEntries(): {
		removedEntities: number;
		removedRelationships: number;
		removedFiles: string[];
	} {
		if (!this.db || !this.uow) throw new Error("Database not initialized");

		const allFiles = this.uow.file.getAll();
		const removedFiles: string[] = [];
		let totalRemovedEntities = 0;
		let totalRemovedRelationships = 0;

		for (const file of allFiles) {
			if (!existsSync(file.path)) {
				const relCount = (
					this.db.raw
						.prepare(
							`SELECT COUNT(*) as cnt FROM st_relationships WHERE file_path = ?`,
						)
						.get(file.path) as { cnt: number }
				).cnt;
				totalRemovedRelationships += relCount;

				const pouCount = (
					this.db.raw
						.prepare(`SELECT COUNT(*) as cnt FROM st_pous WHERE file_path = ?`)
						.get(file.path) as { cnt: number }
				).cnt;
				const typeCount = (
					this.db.raw
						.prepare(`SELECT COUNT(*) as cnt FROM st_types WHERE file_path = ?`)
						.get(file.path) as { cnt: number }
				).cnt;
				const varCount = (
					this.db.raw
						.prepare(
							`SELECT COUNT(*) as cnt FROM st_variables WHERE pou_id IN (SELECT id FROM st_pous WHERE file_path = ?)`,
						)
						.get(file.path) as { cnt: number }
				).cnt;
				totalRemovedEntities += pouCount + typeCount + varCount;

				this.uow.relationship.deleteByFile(file.path);
				this.uow.pou.deleteByFile(file.path);
				this.uow.type.deleteByFile(file.path);
				this.uow.file.delete(file.path);

				removedFiles.push(file.path);
			}
		}

		return {
			removedEntities: totalRemovedEntities,
			removedRelationships: totalRemovedRelationships,
			removedFiles,
		};
	}

	// === Group 2 (SQL): File Entities, Graph, Source, Importers, Clones ===

	getFileEntities(filePath: string, entityTypes?: string[]): FileEntity[] {
		if (!this.uow) throw new Error("Database not initialized");

		const results: FileEntity[] = [];
		const types = entityTypes || ["POU", "TYPE", "VAR_GLOBAL"];

		if (types.includes("POU")) {
			const pous = this.uow.graph.getFilePous(filePath);
			results.push(...pous);
		}
		if (types.includes("TYPE")) {
			const typeEntities = this.uow.graph.getFileTypes(filePath);
			results.push(...typeEntities);
		}
		if (types.includes("VAR_GLOBAL")) {
			const globals = this.uow.graph.getFileGlobalVars(filePath);
			results.push(...globals);
		}

		return results.sort((a, b) => a.line - b.line);
	}

	getGraphNodes(
		limit: number,
		offset: number,
		includeTypes?: string[],
	): { nodes: GraphNode[]; total: number } {
		if (!this.db || !this.uow) throw new Error("Database not initialized");

		const types = includeTypes || ["POU", "TYPE"];
		const nodes: GraphNode[] = [];

		if (types.includes("POU")) {
			const pous = this.uow.graph.getGraphNodesPous(limit, offset);
			nodes.push(...pous);
		}
		if (types.includes("TYPE")) {
			const typeNodes = this.uow.graph.getGraphNodesTypes(limit, offset);
			nodes.push(...typeNodes);
		}

		let total = 0;
		if (types.includes("POU")) {
			const pouCount = (
				this.db.raw.prepare(`SELECT COUNT(*) as cnt FROM st_pous`).get() as {
					cnt: number;
				}
			).cnt;
			total += pouCount;
		}
		if (types.includes("TYPE")) {
			const typeCount = (
				this.db.raw.prepare(`SELECT COUNT(*) as cnt FROM st_types`).get() as {
					cnt: number;
				}
			).cnt;
			total += typeCount;
		}

		return { nodes, total };
	}

	getGraphEdges(sourceIds: string[]): GraphEdge[] {
		if (!this.uow || sourceIds.length === 0) return [];
		return this.uow.graph.getGraphEdgesBySourceIds(sourceIds);
	}

	getEntitySource(
		entityName: string,
		entityType?: string,
		contextLines = 5,
	): EntitySourceResult | null {
		if (!this.db) throw new Error("Database not initialized");

		let entity:
			| {
					id: string;
					name: string;
					type: string;
					file_path: string;
					start_line: number;
					end_line: number | null;
			  }
			| undefined;

		if (!entityType || entityType === "POU") {
			const pou = this.getPOUByNameExact(entityName);
			if (pou) {
				entity = {
					id: pou.id,
					name: pou.name,
					type: pou.pou_type,
					file_path: pou.file_path,
					start_line: pou.start_line,
					end_line: pou.end_line ?? null,
				};
			}
		}

		if (!entity && (!entityType || entityType === "TYPE")) {
			const type = this.getTypeByName(entityName);
			if (type) {
				entity = {
					id: type.id,
					name: type.name,
					type: type.type_kind,
					file_path: type.file_path,
					start_line: type.start_line,
					end_line: type.end_line ?? null,
				};
			}
		}

		if (!entity) {
			return null;
		}

		if (!existsSync(entity.file_path)) {
			return {
				entity: {
					name: entity.name,
					type: entity.type,
					file: entity.file_path,
					line: entity.start_line,
				},
				source: `// File not found: ${entity.file_path}`,
				startLine: entity.start_line,
				endLine: entity.end_line ?? entity.start_line,
			};
		}

		const fileContent = readFileSync(entity.file_path, "utf-8");
		const lines = fileContent.split("\n");

		const startLine = Math.max(1, entity.start_line - contextLines);
		const endLine = entity.end_line
			? Math.min(lines.length, entity.end_line + contextLines)
			: Math.min(lines.length, entity.start_line + contextLines);

		const sourceLines = lines.slice(startLine - 1, endLine);
		const source = sourceLines.join("\n");

		return {
			entity: {
				name: entity.name,
				type: entity.type,
				file: entity.file_path,
				line: entity.start_line,
			},
			source,
			startLine,
			endLine,
		};
	}

	getModuleImporters(moduleName: string, limit = 100): ModuleImporter[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.db!.raw.prepare(`
				SELECT DISTINCT p.name, p.pou_type as type, p.file_path as file, v.start_line as line
				FROM st_pous p
				INNER JOIN st_variables v ON v.pou_id = p.id
				WHERE v.var_type = ?
				ORDER BY p.name
				LIMIT ?
			`).all(moduleName, limit) as ModuleImporter[];
	}

	detectCodeClones(minVariables = 3, scope = "all"): CodeClone[] {
		if (!this.db) throw new Error("Database not initialized");

		if (scope === "type") {
			return this._detectTypeClones(minVariables);
		}

		let typeFilter = "";
		if (scope === "pou") {
			typeFilter =
				"AND p.pou_type IN ('FUNCTION_BLOCK', 'PROGRAM', 'FUNCTION')";
		}

		const rows = this.db.raw
			.prepare(`
				SELECT
					p.id,
					p.name,
					p.pou_type as type,
					p.file_path as file,
					GROUP_CONCAT(v.name || ':' || v.var_type, ';') as signature,
					COUNT(*) as var_count
				FROM st_pous p
				INNER JOIN st_variables v ON v.pou_id = p.id
				WHERE v.direction IN ('VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT')
					${typeFilter}
				GROUP BY p.id
				HAVING var_count >= ?
				ORDER BY signature, p.name
			`)
			.all(minVariables) as Array<{
			id: string;
			name: string;
			type: string;
			file: string;
			signature: string;
		}>;

		const sigMap = new Map<
			string,
			{ name: string; type: string; file: string }[]
		>();
		for (const row of rows) {
			if (!sigMap.has(row.signature)) {
				sigMap.set(row.signature, []);
			}
			sigMap.get(row.signature)!.push({
				name: row.name,
				type: row.type,
				file: row.file,
			});
		}

		const clones: CodeClone[] = [];
		for (const [signature, entities] of sigMap) {
			if (entities.length >= 2) {
				clones.push({ signature, entities });
			}
		}

		return clones.sort((a, b) => b.entities.length - a.entities.length);
	}

	private _detectTypeClones(minFields: number): CodeClone[] {
		if (!this.db) throw new Error("Database not initialized");

		const rows = this.db.raw
			.prepare(`
				SELECT id, name, file_path as file, definition
				FROM st_types
				WHERE type_kind = 'STRUCT' AND definition IS NOT NULL
			`)
			.all() as Array<{
			id: string;
			name: string;
			file: string;
			definition: string;
		}>;

		const sigMap = new Map<
			string,
			{ name: string; type: string; file: string }[]
		>();

		for (const row of rows) {
			try {
				const def = JSON.parse(row.definition);
				if (
					def.fields &&
					Array.isArray(def.fields) &&
					def.fields.length >= minFields
				) {
					const signature = def.fields
						.map((f: any) => `${f.name}:${f.type}`)
						.sort()
						.join(";");

					if (!sigMap.has(signature)) {
						sigMap.set(signature, []);
					}
					sigMap.get(signature)!.push({
						name: row.name,
						type: "STRUCT",
						file: row.file,
					});
				}
			} catch {
				// Skip invalid JSON
			}
		}

		const clones: CodeClone[] = [];
		for (const [signature, entities] of sigMap) {
			if (entities.length >= 2) {
				clones.push({ signature, entities });
			}
		}

		return clones.sort((a, b) => b.entities.length - a.entities.length);
	}

	// === Phase 3: State Machine Analysis ===

	getStateMachines(pouName?: string): Array<{
		pouName: string;
		pouId: string;
		filePath: string;
		pouType: string;
		startLine: number;
		endLine: number | null;
	}> {
		if (!this.db) throw new Error("Database not initialized");

		let query = `SELECT name, id, file_path, pou_type, start_line, end_line FROM st_pous WHERE pou_type IN ('FUNCTION_BLOCK', 'PROGRAM')`;
		const params: any[] = [];

		if (pouName) {
			query += ` AND name = ?`;
			params.push(pouName);
		}

		query += ` ORDER BY file_path, start_line`;

		return this.db.raw.prepare(query).all(...params) as Array<{
			pouName: string;
			pouId: string;
			filePath: string;
			pouType: string;
			startLine: number;
			endLine: number | null;
		}>;
	}

	// === Phase 3: Task Configuration ===

	getTaskConfigs(taskName?: string): TaskConfig[] {
		console.warn(
			"[ST SQLite] getTaskConfigs: Task data not yet indexed. Returning stub.",
		);
		return [];
	}

	// === Phase 3: Cross-File Dependencies ===

	getCrossFileDeps(filePath?: string): CrossFileDep[] {
		if (!this.db) throw new Error("Database not initialized");

		let query = `
			SELECT
				p_from.file_path as fromFile,
				p_to.file_path as toFile,
				r.type as type,
				COUNT(*) as count
			FROM st_relationships r
			INNER JOIN st_pous p_from ON r.from_id = p_from.id
			INNER JOIN st_pous p_to ON r.to_id = p_to.id
			WHERE p_from.file_path != p_to.file_path
		`;
		const params: any[] = [];

		if (filePath) {
			query += ` AND (p_from.file_path = ? OR p_to.file_path = ?)`;
			params.push(filePath, filePath);
		}

		query += ` GROUP BY p_from.file_path, p_to.file_path, r.type ORDER BY count DESC`;

		return this.db.raw.prepare(query).all(...params) as CrossFileDep[];
	}

	// === Phase 3: Data Flow Graph ===

	getDataFlowGraph(startPou: string): DataFlowEdge[] {
		if (!this.db) throw new Error("Database not initialized");

		const startPOU = this.db.raw
			.prepare(`SELECT id, name FROM st_pous WHERE name = ? LIMIT 1`)
			.get(startPou) as { id: string; name: string } | undefined;
		if (!startPOU) {
			return [];
		}

		return this.db.raw
			.prepare(`
				SELECT
					p_caller.name as fromPou,
					v_out.name as fromVar,
					p_callee.name as toPou,
					v_in.name as toVar
				FROM st_pous p_caller
				INNER JOIN st_variables v_out ON v_out.pou_id = p_caller.id AND v_out.direction = 'VAR_OUTPUT'
				INNER JOIN st_relationships r ON r.from_id = p_caller.id AND r.type = 'CALLS'
				INNER JOIN st_pous p_callee ON r.to_id = p_callee.id
				INNER JOIN st_variables v_in ON v_in.pou_id = p_callee.id AND v_in.direction = 'VAR_INPUT'
				WHERE p_caller.name = ?
				ORDER BY p_callee.name, v_out.name, v_in.name
			`)
			.all(startPou) as DataFlowEdge[];
	}

	// === Group 5 (EXTEND): Resolve Entity ===

	resolveEntity(
		name: string,
		entityType?: string,
		limit = 10,
	): ResolvedEntity[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.graph.resolveEntity(name, entityType, limit);
	}

	// === Group 5 (EXTEND): Analyze Hotspots ===

	analyzeHotspots(metric = "combined", limit = 10): HotspotEntity[] {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.metrics.analyzeHotspots(metric, limit);
	}

	// === Group 5 (EXTEND): Get Metrics ===

	getMetrics(): CodeMetrics {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.metrics.getMetrics();
	}

	// === Group 5 (EXTEND): Get Graph Stats ===

	getGraphStats(): GraphStats {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.metrics.getGraphStats();
	}

	// === Stubs for methods referenced by handlers but not in original code ===

	searchFieldsByName(
		query: string,
		limit = 50,
	): Array<{
		id: string;
		name: string;
		parent_type_id: string;
		field_type: string;
		file_path: string;
		start_line: number;
	}> {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.field.searchByName(query, limit) as Array<{
			id: string;
			name: string;
			parent_type_id: string;
			field_type: string;
			file_path: string;
			start_line: number;
		}>;
	}

	getVariableListsByFile(filePath: string): Array<{
		id: string;
		file_path: string;
		name: string;
		direction: string;
		start_line?: number;
		end_line?: number;
	}> {
		if (!this.uow) throw new Error("Database not initialized");
		return this.uow.variable.getListsByFile(filePath) as Array<{
			id: string;
			file_path: string;
			name: string;
			direction: string;
			start_line?: number;
			end_line?: number;
		}>;
	}
}
