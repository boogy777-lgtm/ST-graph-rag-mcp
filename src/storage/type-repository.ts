/**
 * Type Repository
 *
 * CRUD and query operations for st_types table.
 */

import type { Statement } from "bun:sqlite";
import type { STType } from "../st/sqlite-manager";
import type { IDatabase, ITypeRepository } from "./interfaces";

export class TypeRepository implements ITypeRepository {
	private insertStmt: Statement;
	private deleteByFileStmt: Statement;
	private searchByNameStmt: Statement;
	private getByIdStmt: Statement;
	private getAllStmt: Statement;
	private countByKindStmt: Statement;
	private getByNameStmt: Statement;
	private searchDefinitionStmt: Statement;

	constructor(private db: IDatabase) {
		this.insertStmt = db.raw.query(`
			INSERT INTO st_types (id, name, type_kind, file_path, start_line, end_line, definition, created_at)
			VALUES ($id, $name, $type_kind, $file_path, $start_line, $end_line, $definition, $created_at)
		`);
		this.deleteByFileStmt = db.raw.query(
			`DELETE FROM st_types WHERE file_path = ?`,
		);
		this.searchByNameStmt = db.raw.query(
			`SELECT * FROM st_types WHERE name LIKE ? ORDER BY type_kind, file_path LIMIT ?`,
		);
		this.getByIdStmt = db.raw.query(`SELECT * FROM st_types WHERE id = ?`);
		this.getAllStmt = db.raw.query(
			`SELECT * FROM st_types ORDER BY file_path, start_line`,
		);
		this.countByKindStmt = db.raw.query(
			`SELECT type_kind, COUNT(*) as count FROM st_types GROUP BY type_kind`,
		);
		this.getByNameStmt = db.raw.query(
			`SELECT * FROM st_types WHERE name = ? LIMIT 1`,
		);
		this.searchDefinitionStmt = db.raw.query(
			`SELECT * FROM st_types WHERE definition LIKE ?`,
		);
	}

	insert(type: STType): void {
		this.insertStmt.run(
			type.id,
			type.name,
			type.type_kind,
			type.file_path,
			type.start_line,
			type.end_line ?? null,
			type.definition ?? null,
			type.created_at,
		);
	}

	deleteByFile(filePath: string): void {
		this.deleteByFileStmt.run(filePath);
	}

	searchByName(query: string, limit = 100): STType[] {
		const searchTerm =
			query.includes("%") || query.includes("_") ? query : `%${query}%`;
		return this.searchByNameStmt.all(searchTerm, limit) as STType[];
	}

	getById(id: string): STType | undefined {
		const row = this.getByIdStmt.get(id) as STType | null;
		return row ?? undefined;
	}

	getAll(): STType[] {
		return this.getAllStmt.all() as STType[];
	}

	getByNameExact(name: string): STType | undefined {
		const row = this.getByNameStmt.get(name) as STType | null;
		return row ?? undefined;
	}

	searchByDefinition(searchTerm: string): STType[] {
		const likeTerm =
			searchTerm.includes("%") || searchTerm.includes("_")
				? searchTerm
				: `%${searchTerm}%`;
		return this.searchDefinitionStmt.all(likeTerm) as STType[];
	}

	countByKind(): Record<string, number> {
		const rows = this.countByKindStmt.all() as Array<{
			type_kind: string;
			count: number;
		}>;
		const map: Record<string, number> = {};
		for (const row of rows) {
			map[row.type_kind] = row.count;
		}
		return map;
	}
}
