/**
 * Field Repository
 *
 * CRUD and query operations for st_fields table.
 */

import type { Statement } from "bun:sqlite";
import type { IDatabase, IFieldRepository } from "./interfaces";

export interface STField {
	id: string;
	parent_type_id: string;
	name: string;
	field_type: string;
	default_value?: string;
	start_line?: number;
	end_line?: number;
	file_path: string;
}

export class FieldRepository implements IFieldRepository {
	private insertStmt: Statement;
	private deleteByFileStmt: Statement;
	private getByParentStmt: Statement;
	private searchByNameStmt: Statement;

	constructor(private db: IDatabase) {
		this.insertStmt = db.raw.query(`
			INSERT INTO st_fields (id, parent_type_id, name, field_type, default_value, start_line, end_line, file_path)
			VALUES ($id, $parent_type_id, $name, $field_type, $default_value, $start_line, $end_line, $file_path)
		`);
		this.deleteByFileStmt = db.raw.query(
			`DELETE FROM st_fields WHERE file_path = ?`,
		);
		this.getByParentStmt = db.raw.query(
			`SELECT * FROM st_fields WHERE parent_type_id = ?`,
		);
		this.searchByNameStmt = db.raw.query(
			`SELECT * FROM st_fields WHERE name LIKE ? LIMIT ?`,
		);
	}

	insert(field: STField): void {
		this.insertStmt.run(
			field.id,
			field.parent_type_id,
			field.name,
			field.field_type,
			field.default_value ?? null,
			field.start_line ?? null,
			field.end_line ?? null,
			field.file_path,
		);
	}

	deleteByFile(filePath: string): void {
		this.deleteByFileStmt.run(filePath);
	}

	getByParent(parentId: string): STField[] {
		return this.getByParentStmt.all(parentId) as STField[];
	}

	searchByName(query: string, limit = 50): STField[] {
		const searchTerm =
			query.includes("%") || query.includes("_") ? query : `%${query}%`;
		return this.searchByNameStmt.all(searchTerm, limit) as STField[];
	}
}
