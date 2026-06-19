import * as path from "path";
import * as vscode from "vscode";
import {
	ExecuteCommandRequest,
	type LanguageClient,
} from "vscode-languageclient/node";

type PositionLike = vscode.Position | { line: number; character: number };

type MoveNamespaceArgs = {
	uri?: vscode.Uri | string;
	textDocument?: { uri: string };
	position?: PositionLike;
	newPath?: string;
	new_path?: string;
	targetUri?: vscode.Uri | string;
	target_uri?: string;
};

const NAMESPACE_CONTEXT_KEY = "trust-lsp.namespaceContext";
const MOVE_NAMESPACE_UI_COMMAND = "trust-lsp.moveNamespace.ui";
const LAST_TARGET_KEY = "trust-lsp.lastNamespaceMoveTarget";

function asUri(value?: vscode.Uri | string): vscode.Uri | undefined {
	if (!value) {
		return undefined;
	}
	if (value instanceof vscode.Uri) {
		return value;
	}
	try {
		if (value.includes("://")) {
			return vscode.Uri.parse(value);
		}
		return vscode.Uri.file(value);
	} catch {
		return undefined;
	}
}

function asPosition(value?: PositionLike): vscode.Position | undefined {
	if (!value) {
		return undefined;
	}
	if (value instanceof vscode.Position) {
		return value;
	}
	if (
		typeof value.line === "number" &&
		typeof value.character === "number" &&
		Number.isFinite(value.line) &&
		Number.isFinite(value.character)
	) {
		return new vscode.Position(value.line, value.character);
	}
	return undefined;
}

function isStructuredTextEditor(
	editor?: vscode.TextEditor,
): editor is vscode.TextEditor {
	return !!editor && editor.document.languageId === "structured-text";
}

function isNamespaceOrUsingLine(lineText: string): boolean {
	const trimmed = lineText.trimStart();
	if (!trimmed) {
		return false;
	}
	const upper = trimmed.toUpperCase();
	return (
		upper === "NAMESPACE" ||
		upper.startsWith("NAMESPACE ") ||
		upper === "USING" ||
		upper.startsWith("USING ")
	);
}

function namespaceTargetFromLine(
	lineText: string,
	cursorChar: number,
): number | undefined {
	const trimmed = lineText.trimStart();
	if (!trimmed) {
		return undefined;
	}
	const upper = trimmed.toUpperCase();
	let keyword: string | undefined;
	if (upper.startsWith("NAMESPACE")) {
		keyword = "NAMESPACE";
	} else if (upper.startsWith("USING")) {
		keyword = "USING";
	}
	if (!keyword) {
		return undefined;
	}
	const indent = lineText.length - trimmed.length;
	let offset = indent + keyword.length;
	let rest = trimmed.slice(keyword.length);
	const wsMatch = rest.match(/^\s+/);
	if (!wsMatch) {
		return undefined;
	}
	offset += wsMatch[0].length;
	rest = rest.slice(wsMatch[0].length);

	const nameRegex = /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g;
	let fallback: number | undefined;
	let match: RegExpExecArray | null;
	while ((match = nameRegex.exec(rest))) {
		const start = offset + match.index;
		const end = start + match[0].length;
		if (fallback === undefined) {
			fallback = start;
		}
		if (cursorChar >= start && cursorChar <= end) {
			return start;
		}
	}
	return fallback;
}

async function updateNamespaceContext(
	editor: vscode.TextEditor | undefined,
): Promise<void> {
	if (!isStructuredTextEditor(editor)) {
		await vscode.commands.executeCommand(
			"setContext",
			NAMESPACE_CONTEXT_KEY,
			false,
		);
		return;
	}
	const lineText = editor.document.lineAt(editor.selection.active.line).text;
	const isMatch = isNamespaceOrUsingLine(lineText);
	await vscode.commands.executeCommand(
		"setContext",
		NAMESPACE_CONTEXT_KEY,
		isMatch,
	);
}

function defaultTargetUri(newPath: string): vscode.Uri | undefined {
	const root = vscode.workspace.workspaceFolders?.[0];
	if (!root) {
		return undefined;
	}
	const parts = newPath.split(".").filter((part) => part.length > 0);
	if (parts.length === 0) {
		return undefined;
	}
	let uri = root.uri;
	for (let idx = 0; idx < parts.length - 1; idx += 1) {
		uri = vscode.Uri.joinPath(uri, parts[idx]);
	}
	const fileName = `${parts[parts.length - 1]}.st`;
	return vscode.Uri.joinPath(uri, fileName);
}

async function promptForNewPath(): Promise<string | undefined> {
	return vscode.window.showInputBox({
		prompt: "Enter the new namespace path",
		placeHolder: "Company.Library.Namespace",
		validateInput(value) {
			const trimmed = value.trim();
			if (!trimmed) {
				return "Namespace path is required.";
			}
			if (
				trimmed.startsWith(".") ||
				trimmed.endsWith(".") ||
				trimmed.includes("..")
			) {
				return "Namespace path must use dot-separated identifiers.";
			}
			return undefined;
		},
	});
}

type TargetChoice = vscode.QuickPickItem & {
	target?: vscode.Uri;
	choiceKind: "default" | "last" | "pick";
};

async function promptForTarget(
	newPath: string,
	lastTarget?: vscode.Uri,
): Promise<vscode.Uri | undefined> {
	const suggested = defaultTargetUri(newPath);
	const choices: TargetChoice[] = [
		{
			label: "Use default mapping",
			description: suggested?.fsPath ?? "Workspace-based mapping",
			target: suggested,
			choiceKind: "default",
		},
	];
	if (lastTarget) {
		choices.push({
			label: "Use last target",
			description: lastTarget.fsPath,
			target: lastTarget,
			choiceKind: "last",
		});
	}
	choices.push({
		label: "Choose target file...",
		description: "Pick or create a .st file for the moved namespace",
		choiceKind: "pick",
	});

	const choice = await vscode.window.showQuickPick<TargetChoice>(choices, {
		placeHolder: "Select a target file for the namespace relocation",
	});
	if (!choice) {
		return undefined;
	}
	if (choice.choiceKind === "default" || choice.choiceKind === "last") {
		return choice.target;
	}
	return vscode.window.showSaveDialog({
		defaultUri: suggested,
		filters: { "Structured Text": ["st", "ST"] },
		saveLabel: "Move namespace here",
	});
}

async function ensureTargetFile(uri: vscode.Uri): Promise<boolean> {
	await vscode.workspace.fs.createDirectory(
		vscode.Uri.file(path.dirname(uri.fsPath)),
	);
	try {
		await vscode.workspace.fs.stat(uri);
		return false;
	} catch {
		await vscode.workspace.fs.writeFile(uri, Buffer.from(""));
		return true;
	}
}

export function registerNamespaceMoveCommand(
	context: vscode.ExtensionContext,
	client: LanguageClient,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			MOVE_NAMESPACE_UI_COMMAND,
			async (args?: MoveNamespaceArgs) => {
				const editor = vscode.window.activeTextEditor;
				const uri =
					asUri(args?.uri) ??
					asUri(args?.textDocument?.uri) ??
					editor?.document.uri;
				if (!uri) {
					vscode.window.showErrorMessage(
						"Move namespace requires an active Structured Text file.",
					);
					return false;
				}

				const position = asPosition(args?.position) ?? editor?.selection.active;
				if (!position) {
					vscode.window.showErrorMessage(
						"Move namespace requires a cursor position in a namespace.",
					);
					return false;
				}

				let newPath = args?.newPath ?? args?.new_path;
				if (!newPath) {
					newPath = await promptForNewPath();
				}
				if (!newPath) {
					return false;
				}

				let targetUri =
					asUri(args?.targetUri) ?? asUri(args?.target_uri ?? undefined);
				if (!args?.targetUri && !args?.target_uri) {
					const lastTarget = context.globalState.get<string>(LAST_TARGET_KEY);
					const lastTargetUri = lastTarget ? asUri(lastTarget) : undefined;
					const target = await promptForTarget(newPath, lastTargetUri);
					if (!target) {
						return false;
					}
					targetUri = target;
				}
				let createdTarget = false;
				if (targetUri) {
					createdTarget = await ensureTargetFile(targetUri);
				}

				await client.start();
				const result = await client.sendRequest(ExecuteCommandRequest.type, {
					command: "trust-lsp.moveNamespace",
					arguments: [
						{
							text_document: { uri: uri.toString() },
							position: { line: position.line, character: position.character },
							new_path: newPath,
							...(targetUri ? { target_uri: targetUri.toString() } : {}),
						},
					],
				});

				if (result === true) {
					if (targetUri) {
						await context.globalState.update(
							LAST_TARGET_KEY,
							targetUri.toString(),
						);
					}
					vscode.window.showInformationMessage("Namespace move applied.");
				} else {
					if (createdTarget && targetUri) {
						try {
							await vscode.workspace.fs.delete(targetUri, {
								useTrash: false,
								recursive: false,
							});
						} catch {
							// Ignore cleanup failures on failed moves.
						}
					}
					vscode.window.showWarningMessage(
						"Namespace move did not apply. Ensure the cursor is inside a namespace declaration.",
					);
				}
				return result === true;
			},
		),
	);
}

export function registerNamespaceMoveContext(
	context: vscode.ExtensionContext,
): void {
	const updateForEditor = (editor: vscode.TextEditor | undefined) => {
		void updateNamespaceContext(editor);
	};
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(updateForEditor),
		vscode.window.onDidChangeTextEditorSelection((event) =>
			updateForEditor(event.textEditor),
		),
	);
	updateForEditor(vscode.window.activeTextEditor);
}

export function registerNamespaceMoveCodeActions(
	context: vscode.ExtensionContext,
): void {
	const provider: vscode.CodeActionProvider = {
		provideCodeActions(document, range) {
			if (document.languageId !== "structured-text") {
				return undefined;
			}
			const line = document.lineAt(range.start.line);
			if (!isNamespaceOrUsingLine(line.text)) {
				return undefined;
			}
			const targetChar = namespaceTargetFromLine(
				line.text,
				range.start.character,
			);
			if (targetChar === undefined) {
				return undefined;
			}
			const action = new vscode.CodeAction(
				"Move Namespace",
				vscode.CodeActionKind.QuickFix,
			);
			action.command = {
				command: MOVE_NAMESPACE_UI_COMMAND,
				title: "Move Namespace",
				arguments: [
					{
						uri: document.uri,
						position: {
							line: range.start.line,
							character: targetChar,
						},
					},
				],
			};
			return [action];
		},
	};
	const selector: vscode.DocumentSelector = {
		language: "structured-text",
		scheme: "file",
	};
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(selector, provider, {
			providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
		}),
	);
}
