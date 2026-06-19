/**
 * Diagnostic Repository
 *
 * CRUD and query operations for st_diagnostics table.
 */

import type { Statement } from "bun:sqlite";
import type { STDiagnostic } from "../st/sqlite-manager";
import type { IDatabase, IDiagnosticRepository } from "./interfaces";

export class DiagnosticRepository implements IDiagnosticRepository {
	private insertStmt: Statement;
	private deleteByFileStmt: Statement;
	private getByFileStmt: Statement;
	private getBySeverityStmt: Statement;

	constructor(private db: IDatabase) {
		this.insertStmt = db.raw.query(`
			INSERT INTO st_diagnostics (id, file_path, line, column, severity, code, message, source, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				severity = excluded.severity,
				message = excluded.message,
				created_at = excluded.created_at
		`);
		this.deleteByFileStmt = db.raw.query(
			`DELETE FROM st_diagnostics WHERE file_path = ?`,
		);
		this.getByFileStmt = db.raw.query(
			`SELECT * FROM st_diagnostics WHERE file_path = ? ORDER BY severity, line`,
		);
		this.getBySeverityStmt = db.raw.query(
			`SELECT * FROM st_diagnostics WHERE severity = ? ORDER BY file_path, line`,
		);
	}

	insert(diag: STDiagnostic): void {
		this.insertStmt.run(
			diag.id,
			diag.file_path,
			diag.line,
			diag.column ?? null,
			diag.severity ?? null,
			diag.code ?? null,
			diag.message,
			diag.source ?? null,
			diag.created_at ?? Date.now(),
		);
	}

	deleteByFile(filePath: string): void {
		this.deleteByFileStmt.run(filePath);
	}

	getByFile(filePath: string): STDiagnostic[] {
		return this.getByFileStmt.all(filePath) as STDiagnostic[];
	}

	getBySeverity(severity: number): STDiagnostic[] {
		return this.getBySeverityStmt.all(severity) as STDiagnostic[];
	}
}
