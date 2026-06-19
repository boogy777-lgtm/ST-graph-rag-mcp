/**
 * POU Repository
 *
 * CRUD and query operations for st_pous table.
 */

import type { Statement } from "bun:sqlite";
import type { STPOU } from "../st/sqlite-manager";
import type { IDatabase, IPOURepository } from "./interfaces";

export class POURepository implements IPOURepository {
	private insertStmt: Statement;
	private updateStmt: Statement;
	private deleteByFileStmt: Statement;
	private searchByNameStmt: Statement;
	private searchByTypeStmt: Statement;
	private searchByNameAndTypeStmt: Statement;
	private getByIdStmt: Statement;
	private getAllStmt: Statement;
	private countByTypeStmt: Statement;

	constructor(private db: IDatabase) {
		this.insertStmt = db.raw.query(`
			INSERT INTO st_pous (id, name, pou_type, file_path, start_line, end_line, namespace, extends, implements, signature, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);
		this.updateStmt = db.raw.query(`
			UPDATE st_pous SET name = ?, pou_type = ?, start_line = ?, end_line = ?,
				namespace = ?, extends = ?, implements = ?, signature = ?, updated_at = ?
			WHERE id = ?
		`);
		this.deleteByFileStmt = db.raw.query(
			`DELETE FROM st_pous WHERE file_path = ?`,
		);
		this.searchByNameStmt = db.raw.query(
			`SELECT * FROM st_pous WHERE name LIKE ? ORDER BY pou_type, file_path LIMIT ?`,
		);
		this.searchByTypeStmt = db.raw.query(
			`SELECT * FROM st_pous WHERE pou_type = ? ORDER BY name LIMIT ?`,
		);
		this.searchByNameAndTypeStmt = db.raw.query(
			`SELECT * FROM st_pous WHERE name LIKE ? AND pou_type = ? ORDER BY file_path LIMIT ?`,
		);
		this.getByIdStmt = db.raw.query(`SELECT * FROM st_pous WHERE id = ?`);
		this.getAllStmt = db.raw.query(
			`SELECT * FROM st_pous ORDER BY file_path, start_line`,
		);
		this.countByTypeStmt = db.raw.query(
			`SELECT pou_type, COUNT(*) as count FROM st_pous GROUP BY pou_type`,
		);
	}

	insert(pou: STPOU): void {
		this.insertStmt.run(
			pou.id,
			pou.name,
			pou.pou_type,
			pou.file_path,
			pou.start_line,
			pou.end_line ?? null,
			pou.namespace ?? null,
			pou.extends ?? null,
			pou.implements ?? null,
			pou.signature ?? null,
			pou.created_at,
			pou.updated_at,
		);
	}

	update(pou: STPOU): void {
		this.updateStmt.run(
			pou.name,
			pou.pou_type,
			pou.start_line,
			pou.end_line ?? null,
			pou.namespace ?? null,
			pou.extends ?? null,
			pou.implements ?? null,
			pou.signature ?? null,
			pou.updated_at,
			pou.id,
		);
	}

	deleteByFile(filePath: string): void {
		this.deleteByFileStmt.run(filePath);
	}

	getById(id: string): STPOU | undefined {
		// Bun: get() returns null when no row; convert to undefined for API compat.
		const row = this.getByIdStmt.get(id) as STPOU | null;
		return row ?? undefined;
	}

	getAll(): STPOU[] {
		return this.getAllStmt.all() as STPOU[];
	}

	searchByName(query: string, type?: string, limit = 100): STPOU[] {
		const searchTerm =
			query.includes("%") || query.includes("_") ? query : `%${query}%`;
		if (type) {
			return this.searchByNameAndTypeStmt.all(
				searchTerm,
				type,
				limit,
			) as STPOU[];
		}
		return this.searchByNameStmt.all(searchTerm, limit) as STPOU[];
	}

	getByNameExact(name: string): STPOU | undefined {
		const results = this.db.raw
			.query<STPOU, [string]>(`SELECT * FROM st_pous WHERE name = ? LIMIT 1`)
			.all(name);
		return results[0];
	}

	countByType(): Record<string, number> {
		const rows = this.countByTypeStmt.all() as Array<{
			pou_type: string;
			count: number;
		}>;
		const map: Record<string, number> = {};
		for (const row of rows) {
			map[row.pou_type] = row.count;
		}
		return map;
	}

	getAllNames(): Set<string> {
		const rows = this.db.raw
			.query<{ name: string }, []>(`SELECT DISTINCT name FROM st_pous`)
			.all();
		return new Set(rows.map((r) => r.name));
	}
}
