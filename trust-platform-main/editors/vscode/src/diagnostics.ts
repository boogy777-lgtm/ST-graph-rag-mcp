import * as fs from "fs";
import * as vscode from "vscode";

type CodeDescriptionLike = { href: vscode.Uri };
type DiagnosticWithExplain = vscode.Diagnostic & {
	data?: any;
	codeDescription?: CodeDescriptionLike;
};

export function resolveSpecDoc(
	specPath?: unknown,
): CodeDescriptionLike | undefined {
	if (typeof specPath !== "string") {
		return undefined;
	}
	const folders = vscode.workspace.workspaceFolders ?? [];
	for (const folder of folders) {
		const candidate = vscode.Uri.joinPath(folder.uri, specPath);
		if (fs.existsSync(candidate.fsPath)) {
			return { href: candidate };
		}
	}
	return undefined;
}

export function augmentDiagnostic(
	diagnostic: vscode.Diagnostic,
	enabled: boolean,
): vscode.Diagnostic {
	if (!enabled) {
		return diagnostic;
	}
	const data = (diagnostic as DiagnosticWithExplain).data;
	const explain = data?.explain;
	if (!explain || typeof explain.iec !== "string") {
		return diagnostic;
	}

	const message = diagnostic.message.includes(explain.iec)
		? diagnostic.message
		: `${diagnostic.message} (${explain.iec})`;
	const updated = new vscode.Diagnostic(
		diagnostic.range,
		message,
		diagnostic.severity,
	) as DiagnosticWithExplain;
	updated.code = diagnostic.code;
	updated.source = diagnostic.source;
	updated.relatedInformation = diagnostic.relatedInformation;
	updated.tags = diagnostic.tags;
	updated.data = data;
	updated.codeDescription =
		(diagnostic as DiagnosticWithExplain).codeDescription ??
		resolveSpecDoc(explain.spec);
	return updated;
}
