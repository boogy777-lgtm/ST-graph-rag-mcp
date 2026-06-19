import type { LSPClient } from "../../lsp/client";
import type { STSQLiteManager } from "../sqlite-manager";

export async function saveDiagnostics(
	lspClient: LSPClient,
	uri: string,
	filePath: string,
	sqliteManager: STSQLiteManager,
): Promise<void> {
	// Ждём diagnostics через polling
	const start = Date.now();
	const maxDiagnosticsWait = 1000;
	let diagnostics = lspClient.getDiagnostics(uri);
	while (
		(!diagnostics || diagnostics.length === 0) &&
		Date.now() - start < maxDiagnosticsWait
	) {
		await new Promise((r) => setTimeout(r, 100));
		diagnostics = lspClient.getDiagnostics(uri);
	}

	const lspDiagnostics = diagnostics;
	if (!lspDiagnostics || lspDiagnostics.length === 0) {
		console.error(`[ST Index] No diagnostics for ${filePath}`);
		return;
	}

	// Delete old diagnostics for this file
	sqliteManager.deleteDiagnosticsByFile(filePath);

	let savedCount = 0;
	for (const diag of lspDiagnostics) {
		const id = `st:diag:${filePath}:${diag.range.start.line}:${diag.range.start.character}:${diag.message.substring(0, 50)}`;
		sqliteManager.insertDiagnostic({
			id,
			file_path: filePath,
			line: diag.range.start.line + 1,
			column: diag.range.start.character + 1,
			severity: diag.severity,
			code: diag.code?.toString(),
			message: diag.message,
			source: diag.source,
			created_at: Date.now(),
		});
		savedCount++;
	}

	console.error(`[ST Index] Saved ${savedCount} diagnostics for ${filePath}`);
}
