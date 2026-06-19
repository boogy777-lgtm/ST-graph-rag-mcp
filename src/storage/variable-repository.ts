/**
 * Variable Repository
 *
 * CRUD and query operations for st_variables and st_variable_lists tables.
 */

import type { Statement } from "bun:sqlite";
import type { STVariable, STVariableList } from "../st/sqlite-manager";
import type { IDatabase, IVariableRepository } from "./interfaces";

export class VariableRepository implements IVariableRepository {
	private insertStmt: Statement;
	private insertListStmt: Statement;
	private deleteByPOUStmt: Statement;
	private deleteListsByFileStmt: Statement;
	private getByPOUStmt: Statement;
	private countStmt: Statement;
	private getByDirectionStmt: Statement;
	private getByTypeStmt: Statement;
	private getGlobalStmt: Statement;
	private searchGlobalByNameStmt: Statement;
	private searchByVarTypeStmt: Statement;
	private getListsByFileStmt: Statement;

	constructor(private db: IDatabase) {
		this.insertStmt = db.raw.query(`
			INSERT INTO st_variables (id, pou_id, name, direction, var_type, default_value, start_line, end_line)
			VALUES ($id, $pou_id, $name, $direction, $var_type, $default_value, $start_line, $end_line)
		`);
		this.insertListStmt = db.raw.query(`
			INSERT INTO st_variable_lists (id, file_path, name, direction, start_line, end_line)
			VALUES ($id, $file_path, $name, $direction, $start_line, $end_line)
		`);
		this.deleteByPOUStmt = db.raw.query(
			`DELETE FROM st_variables WHERE pou_id = ?`,
		);
		this.deleteListsByFileStmt = db.raw.query(
			`DELETE FROM st_variable_lists WHERE file_path = ?`,
		);
		this.getByPOUStmt = db.raw.query(
			`SELECT * FROM st_variables WHERE pou_id = ? ORDER BY direction, name`,
		);
		this.countStmt = db.raw.query(`SELECT COUNT(*) as count FROM st_variables`);
		this.getByDirectionStmt = db.raw.query(
			`SELECT * FROM st_variables WHERE direction = ? ORDER BY pou_id, name`,
		);
		this.getByTypeStmt = db.raw.query(
			`SELECT * FROM st_variables WHERE var_type = ? ORDER BY pou_id, name`,
		);
		this.getGlobalStmt = db.raw.query(
			`SELECT * FROM st_variable_lists WHERE direction = 'VAR_GLOBAL' ORDER BY name`,
		);
		this.searchGlobalByNameStmt = db.raw.query(
			`SELECT * FROM st_variable_lists WHERE direction = 'VAR_GLOBAL' AND name LIKE ? ORDER BY name`,
		);
		this.searchByVarTypeStmt = db.raw.query(
			`SELECT * FROM st_variables WHERE var_type = ? ORDER BY pou_id, name`,
		);
		this.getListsByFileStmt = db.raw.query(
			`SELECT * FROM st_variable_lists WHERE file_path = ? ORDER BY name`,
		);
	}

	insertVariable(variable: STVariable): void {
		this.insertStmt.run(
			variable.id,
			variable.pou_id,
			variable.name,
			variable.direction,
			variable.var_type,
			variable.default_value ?? null,
			variable.start_line ?? null,
			variable.end_line ?? null,
		);
	}

	insertList(list: STVariableList): void {
		this.insertListStmt.run(
			list.id,
			list.file_path,
			list.name,
			list.direction,
			list.start_line ?? null,
			list.end_line ?? null,
		);
	}

	deleteByPOU(pouId: string): void {
		this.deleteByPOUStmt.run(pouId);
	}

	deleteByFile(filePath: string): void {
		// Variables are linked to POU via FK; delete via pou_id for POU in this file
		this.db.raw
			.query(
				`DELETE FROM st_variables WHERE pou_id IN (SELECT id FROM st_pous WHERE file_path = ?)`,
			)
			.run(filePath);
	}

	deleteListsByFile(filePath: string): void {
		this.deleteListsByFileStmt.run(filePath);
	}

	getByPOU(pouId: string): STVariable[] {
		return this.getByPOUStmt.all(pouId) as STVariable[];
	}

	getByDirection(direction: string): STVariable[] {
		return this.getByDirectionStmt.all(direction) as STVariable[];
	}

	getByType(varType: string): STVariable[] {
		return this.getByTypeStmt.all(varType) as STVariable[];
	}

	getGlobalVariables(): STVariableList[] {
		return this.getGlobalStmt.all() as STVariableList[];
	}

	searchGlobalVariablesByName(name: string): STVariableList[] {
		const searchTerm =
			name.includes("%") || name.includes("_") ? name : `%${name}%`;
		return this.searchGlobalByNameStmt.all(searchTerm) as STVariableList[];
	}

	count(): number {
		const row = this.countStmt.get() as { count: number } | null;
		return row?.count ?? 0;
	}

	findVariablesUsingType(typeName: string): STVariable[] {
		return this.searchByVarTypeStmt.all(typeName) as STVariable[];
	}

	getListsByFile(filePath: string): STVariableList[] {
		return this.getListsByFileStmt.all(filePath) as STVariableList[];
	}
}
