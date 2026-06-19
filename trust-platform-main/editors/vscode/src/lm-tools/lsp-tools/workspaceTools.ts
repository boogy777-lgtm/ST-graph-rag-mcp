// Responsibility: focused LM tools module with a single concern.
import { TextDecoder } from "util";
import * as vscode from "vscode";
import * as shared from "../shared";

const {
	MAX_ITEMS,
	clientUnavailableResult,
	completionDocumentation,
	completionInsertText,
	completionKindName,
	completionLabel,
	diagnosticsForRange,
	diagnosticsPayload,
	documentSymbolsToList,
	ensureDocument,
	ensureWorkspaceUri,
	errorResult,
	formatLocationLike,
	formatLspRange,
	formatUriString,
	inlayHintLabel,
	truncateItems,
	makeProgressToken,
	renderMarkup,
	resolveLspPosition,
	resolveLspRange,
	resolvePosition,
	resolveRange,
	sendLspRequest,
	summarizeLspTextEdits,
	summarizeSemanticTokens,
	summarizeWorkspaceEdit,
	symbolKindName,
	textResult,
	toLspDiagnostic,
	uriFromFilePath,
	waitForDiagnostics,
} = shared;

type InvocationOptions<T> = shared.InvocationOptions<T>;
type PositionParams = shared.PositionParams;
type DiagnosticsParams = shared.DiagnosticsParams;
type ReferencesParams = shared.ReferencesParams;
type CompletionParams = shared.CompletionParams;
type WorkspaceSymbolsParams = shared.WorkspaceSymbolsParams;
type RenameParams = shared.RenameParams;
type RangeParams = shared.RangeParams;
type RangePositionsParams = shared.RangePositionsParams;
type SemanticTokensDeltaParams = shared.SemanticTokensDeltaParams;
type SemanticTokensRangeParams = shared.SemanticTokensRangeParams;
type InlayHintsParams = shared.InlayHintsParams;
type LinkedEditingParams = shared.LinkedEditingParams;
type DocumentLinksParams = shared.DocumentLinksParams;
type CodeLensParams = shared.CodeLensParams;
type OnTypeFormattingParams = shared.OnTypeFormattingParams;
type LspRequestParams = shared.LspRequestParams;
type LspNotificationParams = shared.LspNotificationParams;
type WorkspaceFileRenameParams = shared.WorkspaceFileRenameParams;
type SettingsToggleParams = shared.SettingsToggleParams;
type TelemetryReadParams = shared.TelemetryReadParams;
type InlineValuesParams = shared.InlineValuesParams;
type ProjectInfoParams = shared.ProjectInfoParams;
type WorkspaceSymbolsTimedParams = shared.WorkspaceSymbolsTimedParams;
type LspClientProvider = shared.LspClientProvider;

import { LspToolBase } from "./requestTools";

export class STWorkspaceRenameFileTool {
	async invoke(
		options: InvocationOptions<WorkspaceFileRenameParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { oldPath, newPath, overwrite, useWorkspaceEdit } = options.input;
		const oldUri = uriFromFilePath(oldPath);
		const newUri = uriFromFilePath(newPath);
		if (!oldUri || !newUri) {
			return errorResult("oldPath/newPath must be absolute paths.");
		}
		const oldWorkspaceError = ensureWorkspaceUri(oldUri);
		if (oldWorkspaceError) {
			return errorResult(oldWorkspaceError);
		}
		const newWorkspaceError = ensureWorkspaceUri(newUri);
		if (newWorkspaceError) {
			return errorResult(newWorkspaceError);
		}
		try {
			if (useWorkspaceEdit ?? true) {
				const edit = new vscode.WorkspaceEdit();
				edit.renameFile(oldUri, newUri, { overwrite: overwrite ?? false });
				await vscode.workspace.applyEdit(edit);
			} else {
				await vscode.workspace.fs.rename(oldUri, newUri, {
					overwrite: overwrite ?? false,
				});
			}
			return textResult("File rename/move applied.");
		} catch (error) {
			return errorResult(`Failed to rename/move file: ${String(error)}`);
		}
	}
}

export class STSettingsUpdateTool extends LspToolBase {
	constructor(getClient?: LspClientProvider) {
		super(getClient);
	}

	async invoke(
		options: InvocationOptions<SettingsToggleParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { key, value, scope, filePath, timeoutMs, forceRefresh } =
			options.input;
		if (!key.trim()) {
			return errorResult("key must be a non-empty string.");
		}
		const split = key.split(".");
		const section = split.length > 1 ? split[0] : "trust-lsp";
		const setting = split.length > 1 ? split.slice(1).join(".") : key;
		const target =
			scope === "global"
				? vscode.ConfigurationTarget.Global
				: scope === "workspaceFolder"
					? vscode.ConfigurationTarget.WorkspaceFolder
					: vscode.ConfigurationTarget.Workspace;
		const configurationTarget: vscode.ConfigurationTarget | undefined = target;
		let scopeUri: vscode.Uri | undefined;
		if (target === vscode.ConfigurationTarget.WorkspaceFolder) {
			if (!filePath) {
				return errorResult("filePath is required for workspaceFolder scope.");
			}
			scopeUri = uriFromFilePath(filePath);
			if (!scopeUri) {
				return errorResult("filePath must be an absolute path or URI.");
			}
		}
		try {
			const config = vscode.workspace.getConfiguration(section, scopeUri);
			await config.update(setting, value, configurationTarget);
			const effectiveTimeoutMs =
				typeof timeoutMs === "number" ? timeoutMs : forceRefresh ? 3000 : 1000;
			let targetUri: vscode.Uri | undefined;
			if (filePath) {
				targetUri = uriFromFilePath(filePath);
				if (!targetUri) {
					return errorResult("filePath must be an absolute path or URI.");
				}
			} else {
				targetUri = vscode.window.activeTextEditor?.document.uri;
			}
			if (!targetUri) {
				return textResult(
					JSON.stringify(
						{
							setting: `${section}.${setting}`,
							diagnosticsRefreshed: false,
							reason: "No active document available for diagnostics refresh.",
						},
						null,
						2,
					),
				);
			}
			await ensureDocument(targetUri);
			let diagnosticsRefreshed = false;
			let pullDiagnostics: unknown | undefined;
			let refreshError: string | undefined;
			if (forceRefresh) {
				const result = await this.request(
					"textDocument/diagnostic",
					{ textDocument: { uri: targetUri.toString() } },
					token,
					{ requestTimeoutMs: effectiveTimeoutMs },
				);
				if ("error" in result) {
					refreshError = result.error;
				} else {
					pullDiagnostics = result.response;
					diagnosticsRefreshed = true;
				}
			}
			const waited = await waitForDiagnostics(
				targetUri,
				token,
				effectiveTimeoutMs,
			);
			diagnosticsRefreshed = diagnosticsRefreshed || waited;
			const diagnostics = vscode.languages.getDiagnostics(targetUri);
			return textResult(
				JSON.stringify(
					{
						setting: `${section}.${setting}`,
						diagnosticsRefreshed,
						diagnostics: diagnosticsPayload(diagnostics).diagnostics,
						pullDiagnostics: pullDiagnostics ?? undefined,
						refreshError: refreshError ?? undefined,
					},
					null,
					2,
				),
			);
		} catch (error) {
			return errorResult(`Failed to update setting: ${String(error)}`);
		}
	}
}

export class STTelemetryReadTool {
	async invoke(
		options: InvocationOptions<TelemetryReadParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, limit, tail } = options.input;
		const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
		let uri: vscode.Uri | undefined;
		if (filePath) {
			uri = uriFromFilePath(filePath);
			if (!uri) {
				return errorResult("filePath must be an absolute path or URI.");
			}
		} else {
			for (const folder of workspaceFolders) {
				const candidate = vscode.Uri.joinPath(
					folder.uri,
					".trust-lsp",
					"telemetry.jsonl",
				);
				try {
					await vscode.workspace.fs.stat(candidate);
					uri = candidate;
					break;
				} catch {}
			}
		}
		if (!uri) {
			return errorResult("Telemetry file not found.");
		}
		const workspaceError = ensureWorkspaceUri(uri);
		if (workspaceError) {
			return errorResult(workspaceError);
		}
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = new TextDecoder().decode(bytes);
			const lines = text
				.split(/\r?\n/)
				.filter((line) => line.trim().length > 0);
			const maxItems = limit ?? 100;
			const slice = tail ? lines.slice(-maxItems) : lines.slice(0, maxItems);
			const items = slice.map((line) => {
				try {
					return JSON.parse(line);
				} catch {
					return { parseError: true, line };
				}
			});
			return textResult(
				JSON.stringify(
					{
						filePath: uri.fsPath,
						totalLines: lines.length,
						items,
						truncated: lines.length > slice.length,
					},
					null,
					2,
				),
			);
		} catch (error) {
			return errorResult(`Failed to read telemetry: ${String(error)}`);
		}
	}
}

export class STInlineValuesTool {
	async invoke(
		options: InvocationOptions<InlineValuesParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const {
			frameId,
			startLine,
			startCharacter,
			endLine,
			endCharacter,
			context,
		} = options.input;
		if (!Number.isInteger(frameId)) {
			return errorResult("frameId must be an integer.");
		}
		const session = vscode.debug.activeDebugSession;
		if (!session) {
			return errorResult("No active debug session.");
		}
		const range = {
			start: { line: startLine + 1, column: startCharacter + 1 },
			end: { line: endLine + 1, column: endCharacter + 1 },
		};
		try {
			const inlineValues = await session.customRequest("inlineValues", {
				frameId,
				range,
				context,
			});
			return textResult(
				JSON.stringify({ inlineValues, session: session.name }, null, 2),
			);
		} catch (error) {
			return errorResult(`Failed to fetch inline values: ${String(error)}`);
		}
	}
}

export class STProjectInfoTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<ProjectInfoParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const args = Array.isArray(options.input.arguments)
			? options.input.arguments
			: [];
		const result = await this.request(
			"workspace/executeCommand",
			{ command: "trust-lsp.projectInfo", arguments: args },
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		return textResult(
			JSON.stringify(
				{
					command: "trust-lsp.projectInfo",
					result: result.response,
				},
				null,
				2,
			),
		);
	}
}

export class STWorkspaceSymbolsTimedTool {
	async invoke(
		options: InvocationOptions<WorkspaceSymbolsTimedParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { query, limit, pathIncludes } = options.input;
		if (!query.trim()) {
			return errorResult("query must be a non-empty string.");
		}
		const start = Date.now();
		try {
			const symbols = await vscode.commands.executeCommand<
				vscode.SymbolInformation[]
			>("vscode.executeWorkspaceSymbolProvider", query);
			const durationMs = Date.now() - start;
			if (!symbols || symbols.length === 0) {
				return textResult(JSON.stringify({ durationMs, symbols: [] }, null, 2));
			}
			let filtered = symbols;
			if (Array.isArray(pathIncludes) && pathIncludes.length > 0) {
				filtered = symbols.filter((symbol) =>
					pathIncludes.some((part) =>
						formatLocationLike(symbol.location).includes(part),
					),
				);
			}
			const { items, truncated } = truncateItems(filtered, limit ?? MAX_ITEMS);
			const payload = items.map((symbol) => ({
				name: symbol.name,
				kind: symbolKindName(symbol.kind),
				containerName: symbol.containerName || undefined,
				location: formatLocationLike(symbol.location),
			}));
			return textResult(
				JSON.stringify({ durationMs, symbols: payload, truncated }, null, 2),
			);
		} catch (error) {
			return errorResult(`Failed to get workspace symbols: ${String(error)}`);
		}
	}
}
