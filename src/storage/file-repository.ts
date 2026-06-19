/**
 * File Repository
 *
 * CRUD and query operations for st_files table.
 */

import type { Statement } from "bun:sqlite";
import type { STFile } from "../st/sqlite-manager";
import type { IDatabase, IFileRepository } from "./interfaces";

export class FileRepository implements IFileRepository {
	private insertOrUpdateStmt: Statement;
	private getByPathStmt: Statement;
	private getAllStmt: Statement;
	private deleteStmt: Statement;
	private countStmt: Statement;

	constructor(private db: IDatabase) {
		this.insertOrUpdateStmt = db.raw.query(`
			INSERT INTO st_files (path, hash, last_indexed, pou_count, var_count)
			VALUES ($path, $hash, $last_indexed, $pou_count, $var_count)
			ON CONFLICT(path) DO UPDATE SET hash = $hash, last_indexed = $last_indexed, pou_count = $pou_count, var_count = $var_count
		`);
		this.getByPathStmt = db.raw.query(`SELECT * FROM st_files WHERE path = ?`);
		this.getAllStmt = db.raw.query(`SELECT * FROM st_files ORDER BY path`);
		this.deleteStmt = db.raw.query(`DELETE FROM st_files WHERE path = ?`);
		this.countStmt = db.raw.query(`SELECT COUNT(*) as count FROM st_files`);
	}

	insertOrUpdate(file: STFile): void {
		this.insertOrUpdateStmt.run(
			file.path,
			file.hash,
			file.last_indexed,
			file.pou_count,
			file.var_count,
		);
	}

	getByPath(path: string): STFile | undefined {
		const row = this.getByPathStmt.get(path) as STFile | null;
		return row ?? undefined;
	}

	getAll(): STFile[] {
		return this.getAllStmt.all() as STFile[];
	}

	delete(path: string): void {
		this.deleteStmt.run(path);
	}

	count(): number {
		const row = this.countStmt.get() as { count: number } | null;
		return row?.count ?? 0;
	}
}
