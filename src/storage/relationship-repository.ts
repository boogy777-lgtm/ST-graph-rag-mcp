/**
 * Relationship Repository
 *
 * CRUD and query operations for st_relationships table.
 */

import type { Statement } from "bun:sqlite";
import type { STRelationship } from "../st/sqlite-manager";
import type { IDatabase, IRelationshipRepository } from "./interfaces";

export class RelationshipRepository implements IRelationshipRepository {
	private insertStmt: Statement;
	private deleteByFileStmt: Statement;
	private getByFromIdStmt: Statement;
	private getByToIdStmt: Statement;
	private getByTypeStmt: Statement;
	private getCallsByFromIdStmt: Statement;
	private getCallsByToIdStmt: Statement;
	private countByTypeStmt: Statement;
	private getRecursiveCallChainStmt: Statement;
	private getAncestorsStmt: Statement;
	private getDescendantsStmt: Statement;
	private getInterfaceImplementersStmt: Statement;
	private getDirectDependentsStmt: Statement;
	private getTransitiveDependentsStmt: Statement;

	constructor(private db: IDatabase) {
		this.insertStmt = db.raw.query(`
			INSERT INTO st_relationships (id, from_id, to_id, type, file_path, line, metadata)
			VALUES ($id, $from_id, $to_id, $type, $file_path, $line, $metadata)
		`);
		this.deleteByFileStmt = db.raw.query(
			`DELETE FROM st_relationships WHERE file_path = ?`,
		);
		this.getByFromIdStmt = db.raw.query(
			`SELECT * FROM st_relationships WHERE from_id = ?`,
		);
		this.getByToIdStmt = db.raw.query(
			`SELECT * FROM st_relationships WHERE to_id = ?`,
		);
		this.getByTypeStmt = db.raw.query(
			`SELECT * FROM st_relationships WHERE type = ?`,
		);
		this.getCallsByFromIdStmt = db.raw.query(
			`SELECT * FROM st_relationships WHERE type = 'CALLS' AND from_id = ?`,
		);
		this.getCallsByToIdStmt = db.raw.query(
			`SELECT * FROM st_relationships WHERE type = 'CALLS' AND to_id = ?`,
		);
		this.countByTypeStmt = db.raw.query(
			`SELECT type, COUNT(*) as count FROM st_relationships GROUP BY type`,
		);
		this.getRecursiveCallChainStmt = db.raw.query(`
			WITH RECURSIVE call_chain AS (
				SELECT from_id, to_id, file_path, line, 1 as depth
				FROM st_relationships
				WHERE type = 'CALLS' AND from_id = ?
				UNION ALL
				SELECT r.from_id, r.to_id, r.file_path, r.line, cc.depth + 1
				FROM st_relationships r
				INNER JOIN call_chain cc ON r.from_id = cc.to_id
				WHERE r.type = 'CALLS' AND cc.depth < ?
			)
			SELECT * FROM call_chain ORDER BY depth, from_id
		`);
		this.getAncestorsStmt = db.raw.query(`
			WITH RECURSIVE ancestors AS (
				SELECT p.id, p.name, p.file_path, p.extends, 1 as depth
				FROM st_pous p
				INNER JOIN st_relationships r ON r.from_id = p.id
				WHERE r.to_id = ? AND r.type = 'EXTENDS'
				UNION ALL
				SELECT p.id, p.name, p.file_path, p.extends, a.depth + 1
				FROM st_pous p
				INNER JOIN st_relationships r ON r.from_id = p.id
				INNER JOIN ancestors a ON r.to_id = a.id
				WHERE r.type = 'EXTENDS' AND a.depth < ?
			)
			SELECT id, name, file_path, depth FROM ancestors ORDER BY depth
		`);
		this.getDescendantsStmt = db.raw.query(`
			WITH RECURSIVE descendants AS (
				SELECT p.id, p.name, p.file_path, 1 as depth
				FROM st_pous p
				INNER JOIN st_relationships r ON r.from_id = p.id
				WHERE r.to_id = ? AND r.type = 'EXTENDS'
				UNION ALL
				SELECT p.id, p.name, p.file_path, d.depth + 1
				FROM st_pous p
				INNER JOIN st_relationships r ON r.from_id = p.id
				INNER JOIN descendants d ON r.to_id = d.id
				WHERE r.type = 'EXTENDS' AND d.depth < ?
			)
			SELECT id, name, file_path, depth FROM descendants ORDER BY depth
		`);
		this.getInterfaceImplementersStmt = db.raw.query(`
			SELECT p.id, p.name, p.file_path, p.pou_type
			FROM st_pous p
			INNER JOIN st_relationships r ON r.from_id = p.id
			WHERE r.type = 'IMPLEMENTS' AND r.to_id = ?
			ORDER BY p.name
		`);
		this.getDirectDependentsStmt = db.raw.query(`
			SELECT p.id, p.name, p.pou_type, p.file_path, r.type as rel_type
			FROM st_pous p
			INNER JOIN st_relationships r ON r.from_id = p.id
			WHERE r.to_id = ?
			ORDER BY r.type, p.name
		`);
		this.getTransitiveDependentsStmt = db.raw.query(`
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
		`);
	}

	insert(rel: STRelationship): void {
		this.insertStmt.run(
			rel.id,
			rel.from_id,
			rel.to_id,
			rel.type,
			rel.file_path,
			rel.line ?? null,
			rel.metadata ?? null,
		);
	}

	deleteByFile(filePath: string): void {
		this.deleteByFileStmt.run(filePath);
	}

	getByEntityId(entityId: string): STRelationship[] {
		const fromRels = this.getByFromIdStmt.all(entityId) as STRelationship[];
		const toRels = this.getByToIdStmt.all(entityId) as STRelationship[];
		return [...fromRels, ...toRels];
	}

	getIncomingCalls(pouId: string): STRelationship[] {
		return this.getCallsByToIdStmt.all(pouId) as STRelationship[];
	}

	getOutgoingCalls(pouId: string): STRelationship[] {
		return this.getCallsByFromIdStmt.all(pouId) as STRelationship[];
	}

	getRecursiveCallChain(pouId: string, maxDepth: number): STRelationship[] {
		return this.getRecursiveCallChainStmt.all(
			pouId,
			maxDepth,
		) as STRelationship[];
	}

	getAncestors(
		entityId: string,
		maxDepth: number,
	): Array<{ id: string; name: string; file_path: string; depth: number }> {
		return this.getAncestorsStmt.all(entityId, maxDepth) as Array<{
			id: string;
			name: string;
			file_path: string;
			depth: number;
		}>;
	}

	getDescendants(
		entityId: string,
		maxDepth: number,
	): Array<{ id: string; name: string; file_path: string; depth: number }> {
		return this.getDescendantsStmt.all(entityId, maxDepth) as Array<{
			id: string;
			name: string;
			file_path: string;
			depth: number;
		}>;
	}

	getInterfaceImplementers(
		typeId: string,
	): Array<{ id: string; name: string; file_path: string; pou_type: string }> {
		return this.getInterfaceImplementersStmt.all(typeId) as Array<{
			id: string;
			name: string;
			file_path: string;
			pou_type: string;
		}>;
	}

	getDirectDependents(entityId: string): Array<{
		id: string;
		name: string;
		pou_type: string;
		file_path: string;
		rel_type: string;
	}> {
		return this.getDirectDependentsStmt.all(entityId) as Array<{
			id: string;
			name: string;
			pou_type: string;
			file_path: string;
			rel_type: string;
		}>;
	}

	getTransitiveDependents(
		entityId: string,
		maxDepth: number,
	): Array<{
		id: string;
		name: string;
		pou_type: string;
		file_path: string;
		rel_type: string;
		depth: number;
	}> {
		return this.getTransitiveDependentsStmt.all(entityId, maxDepth) as Array<{
			id: string;
			name: string;
			pou_type: string;
			file_path: string;
			rel_type: string;
			depth: number;
		}>;
	}

	countByType(): Record<string, number> {
		const rows = this.countByTypeStmt.all() as Array<{
			type: string;
			count: number;
		}>;
		const map: Record<string, number> = {};
		for (const row of rows) {
			map[row.type] = row.count;
		}
		return map;
	}
}
