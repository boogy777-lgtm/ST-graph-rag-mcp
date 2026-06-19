// Responsibility: focused LM tools module with a single concern.
import * as crypto from "crypto";
import * as path from "path";
import * as vscode from "vscode";
import { ensureDocument, formatRange } from "../lsp";
import type { HmiLayoutFileEntry, HmiValidationCheck } from "../types";
import { hmiSeverityRank } from "./core";

export function hashContent(value: string): string {
	return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function evidenceRunId(date: Date): string {
	const year = date.getUTCFullYear().toString().padStart(4, "0");
	const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
	const day = date.getUTCDate().toString().padStart(2, "0");
	const hours = date.getUTCHours().toString().padStart(2, "0");
	const minutes = date.getUTCMinutes().toString().padStart(2, "0");
	const seconds = date.getUTCSeconds().toString().padStart(2, "0");
	return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}Z`;
}

export async function pruneEvidenceRuns(
	hmiRoot: vscode.Uri,
	retainRuns: number,
): Promise<string[]> {
	const evidenceRoot = vscode.Uri.joinPath(hmiRoot, "_evidence");
	let entries: [string, vscode.FileType][];
	try {
		entries = await vscode.workspace.fs.readDirectory(evidenceRoot);
	} catch {
		return [];
	}
	const dirs = entries
		.filter(([, kind]) => kind === vscode.FileType.Directory)
		.map(([name]) => name)
		.sort((left, right) => left.localeCompare(right));
	const limit = Math.max(1, Math.trunc(retainRuns));
	if (dirs.length <= limit) {
		return [];
	}
	const removable = dirs.slice(0, dirs.length - limit);
	for (const name of removable) {
		await vscode.workspace.fs.delete(vscode.Uri.joinPath(evidenceRoot, name), {
			recursive: true,
			useTrash: false,
		});
	}
	return removable;
}

export async function collectHmiDiagnosticsForFiles(
	rootPath: string,
	files: HmiLayoutFileEntry[],
	token: vscode.CancellationToken,
): Promise<HmiValidationCheck[]> {
	const checks: HmiValidationCheck[] = [];
	for (const file of files) {
		if (token.isCancellationRequested) {
			break;
		}
		const uri = vscode.Uri.joinPath(vscode.Uri.file(rootPath), file.path);
		try {
			await ensureDocument(uri);
		} catch {
			continue;
		}
		const diagnostics = vscode.languages.getDiagnostics(uri);
		for (const diagnostic of diagnostics) {
			const severity: HmiValidationCheck["severity"] =
				diagnostic.severity === vscode.DiagnosticSeverity.Error
					? "error"
					: diagnostic.severity === vscode.DiagnosticSeverity.Warning
						? "warning"
						: "info";
			const code =
				typeof diagnostic.code === "string" ||
				typeof diagnostic.code === "number"
					? String(diagnostic.code)
					: typeof diagnostic.code?.value === "string" ||
							typeof diagnostic.code?.value === "number"
						? String(diagnostic.code.value)
						: "HMI_VALIDATE_DIAGNOSTIC";
			checks.push({
				code,
				severity,
				message: diagnostic.message,
				file: file.path,
				range: formatRange(diagnostic.range),
			});
		}
	}
	checks.sort((left, right) => {
		const rank =
			hmiSeverityRank(left.severity) - hmiSeverityRank(right.severity);
		if (rank !== 0) {
			return rank;
		}
		if ((left.file ?? "") !== (right.file ?? "")) {
			return (left.file ?? "").localeCompare(right.file ?? "");
		}
		if (left.code !== right.code) {
			return left.code.localeCompare(right.code);
		}
		return left.message.localeCompare(right.message);
	});
	return checks;
}
