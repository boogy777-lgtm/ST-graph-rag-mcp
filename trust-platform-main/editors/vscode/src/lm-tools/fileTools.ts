import * as vscode from "vscode";

type LmToolResultCtor = new (parts: unknown[]) => unknown;
type LmTextPartCtor = new (value: string) => unknown;

const languageModelToolResultCtor = (
	vscode as unknown as { LanguageModelToolResult?: LmToolResultCtor }
).LanguageModelToolResult;

const languageModelTextPartCtor = (
	vscode as unknown as { LanguageModelTextPart?: LmTextPartCtor }
).LanguageModelTextPart;

type InvocationOptions<T> = {
	input: T;
};

interface RangeParams {
	filePath: string;
	startLine: number;
	startCharacter: number;
	endLine: number;
	endCharacter: number;
}

interface FileReadParams {
	filePath: string;
	startLine?: number;
	startCharacter?: number;
	endLine?: number;
	endCharacter?: number;
}

interface FileWriteParams {
	filePath: string;
	text: string;
	save?: boolean;
}

interface ApplyEditsParams {
	filePath: string;
	edits: Array<{
		startLine: number;
		startCharacter: number;
		endLine: number;
		endCharacter: number;
		newText: string;
	}>;
	save?: boolean;
}

function textResult(text: string): unknown {
	if (languageModelToolResultCtor && languageModelTextPartCtor) {
		return new languageModelToolResultCtor([
			new languageModelTextPartCtor(text),
		]);
	}
	return text;
}

function errorResult(message: string): unknown {
	return textResult(`Error: ${message}`);
}

function uriFromFilePath(filePath: string): vscode.Uri | undefined {
	const raw = String(filePath ?? "").trim();
	if (!raw) {
		return undefined;
	}
	if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(raw)) {
		try {
			const parsed = vscode.Uri.parse(raw);
			return parsed.scheme ? parsed : undefined;
		} catch {
			return undefined;
		}
	}
	if (/^file:[^/]/i.test(raw)) {
		return undefined;
	}
	if (/^[A-Za-z]:/.test(raw) || raw.startsWith("/") || raw.startsWith("\\")) {
		return vscode.Uri.file(raw);
	}
	return undefined;
}

function isPathInside(base: string, target: string): boolean {
	return target === base || target.startsWith(base + "/");
}

function ensureWorkspaceUri(uri: vscode.Uri): string | undefined {
	const normalized = uri.path.toLowerCase();
	const folders = vscode.workspace.workspaceFolders ?? [];
	for (const folder of folders) {
		const root = folder.uri.path.toLowerCase();
		if (isPathInside(root, normalized)) {
			return undefined;
		}
	}
	return "filePath must point to a file inside the current workspace.";
}

async function ensureDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
	const open = vscode.workspace.textDocuments.find(
		(doc) => doc.uri.toString() === uri.toString(),
	);
	if (open) {
		return open;
	}
	return await vscode.workspace.openTextDocument(uri);
}

function openDocumentIfLoaded(
	uri: vscode.Uri,
): vscode.TextDocument | undefined {
	return vscode.workspace.textDocuments.find(
		(doc) => doc.uri.toString() === uri.toString(),
	);
}

function fullDocumentRange(doc: vscode.TextDocument): vscode.Range {
	const start = new vscode.Position(0, 0);
	const end = doc.lineCount
		? doc.lineAt(doc.lineCount - 1).range.end
		: new vscode.Position(0, 0);
	return new vscode.Range(start, end);
}

function resolveRange(
	doc: vscode.TextDocument,
	startLine: number,
	startCharacter: number,
	endLine: number,
	endCharacter: number,
): vscode.Range {
	const start = new vscode.Position(startLine, startCharacter);
	const end = new vscode.Position(endLine, endCharacter);
	const full = fullDocumentRange(doc);
	if (!full.contains(start) || !full.contains(end) || start.isAfter(end)) {
		throw new Error("range is outside document bounds");
	}
	return new vscode.Range(start, end);
}

function formatRange(range: vscode.Range): string {
	return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}

export class STFileReadTool {
	async invoke(
		options: InvocationOptions<FileReadParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, startLine, startCharacter, endLine, endCharacter } =
			options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		const workspaceError = ensureWorkspaceUri(uri);
		if (workspaceError) {
			return errorResult(workspaceError);
		}
		const hasRangePart =
			startLine !== undefined ||
			startCharacter !== undefined ||
			endLine !== undefined ||
			endCharacter !== undefined;
		const hasFullRange =
			startLine !== undefined &&
			startCharacter !== undefined &&
			endLine !== undefined &&
			endCharacter !== undefined;
		if (hasRangePart && !hasFullRange) {
			return errorResult(
				"Provide all of startLine/startCharacter/endLine/endCharacter for range reads.",
			);
		}
		try {
			const doc = await ensureDocument(uri);
			if (
				startLine !== undefined &&
				startCharacter !== undefined &&
				endLine !== undefined &&
				endCharacter !== undefined
			) {
				const range = resolveRange(
					doc,
					startLine,
					startCharacter,
					endLine,
					endCharacter,
				);
				const text = doc.getText(range);
				return textResult(
					JSON.stringify(
						{
							filePath: uri.fsPath,
							range: formatRange(range),
							text,
						},
						null,
						2,
					),
				);
			}
			const text = doc.getText();
			return textResult(
				JSON.stringify({ filePath: uri.fsPath, text }, null, 2),
			);
		} catch (error) {
			return errorResult(`Failed to read file: ${String(error)}`);
		}
	}
}

export class STReadRangeTool {
	async invoke(
		options: InvocationOptions<RangeParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, startLine, startCharacter, endLine, endCharacter } =
			options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		const workspaceError = ensureWorkspaceUri(uri);
		if (workspaceError) {
			return errorResult(workspaceError);
		}
		try {
			const doc = await ensureDocument(uri);
			const range = resolveRange(
				doc,
				startLine,
				startCharacter,
				endLine,
				endCharacter,
			);
			const text = doc.getText(range);
			return textResult(
				JSON.stringify(
					{
						filePath: uri.fsPath,
						range: formatRange(range),
						text,
					},
					null,
					2,
				),
			);
		} catch (error) {
			return errorResult(`Failed to read range: ${String(error)}`);
		}
	}
}

export class STFileWriteTool {
	async invoke(
		options: InvocationOptions<FileWriteParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, text, save } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		const workspaceError = ensureWorkspaceUri(uri);
		if (workspaceError) {
			return errorResult(workspaceError);
		}
		try {
			const openDoc = openDocumentIfLoaded(uri);
			if (openDoc) {
				const edit = new vscode.WorkspaceEdit();
				edit.replace(uri, fullDocumentRange(openDoc), text);
				await vscode.workspace.applyEdit(edit);
				if (save) {
					await openDoc.save();
				}
				return textResult("File updated.");
			}
			const encoder = new TextEncoder();
			await vscode.workspace.fs.writeFile(uri, encoder.encode(text));
			if (save) {
				const doc = await ensureDocument(uri);
				await doc.save();
			}
			return textResult("File written.");
		} catch (error) {
			return errorResult(`Failed to write file: ${String(error)}`);
		}
	}
}

export class STApplyEditsTool {
	async invoke(
		options: InvocationOptions<ApplyEditsParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, edits, save } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		const workspaceError = ensureWorkspaceUri(uri);
		if (workspaceError) {
			return errorResult(workspaceError);
		}
		if (!Array.isArray(edits) || edits.length === 0) {
			return errorResult("edits must be a non-empty array.");
		}
		try {
			const doc = await ensureDocument(uri);
			const workspaceEdit = new vscode.WorkspaceEdit();
			for (const edit of edits) {
				const range = resolveRange(
					doc,
					edit.startLine,
					edit.startCharacter,
					edit.endLine,
					edit.endCharacter,
				);
				workspaceEdit.replace(uri, range, edit.newText);
			}
			await vscode.workspace.applyEdit(workspaceEdit);
			if (save) {
				await doc.save();
			}
			return textResult("Edits applied.");
		} catch (error) {
			return errorResult(`Failed to apply edits: ${String(error)}`);
		}
	}
}
