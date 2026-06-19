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

export class STHoverTool {
	async invoke(
		options: InvocationOptions<PositionParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, line, character } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		try {
			const doc = await ensureDocument(uri);
			const position = resolvePosition(doc, line, character);
			const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
				"vscode.executeHoverProvider",
				uri,
				position,
			);
			if (!hovers || hovers.length === 0) {
				return textResult("No hover information available at this position.");
			}
			const content = hovers
				.flatMap((hover) => hover.contents)
				.map((item) => renderMarkup(item))
				.filter((item) => item.length > 0)
				.join("\n\n");
			return textResult(
				content || "No hover information available at this position.",
			);
		} catch (error) {
			return errorResult(`Failed to get hover info: ${String(error)}`);
		}
	}
}

export class STDiagnosticsTool {
	async invoke(
		options: InvocationOptions<DiagnosticsParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		const alreadyOpen = vscode.workspace.textDocuments.some(
			(doc) => doc.uri.toString() === uri.toString(),
		);
		try {
			await ensureDocument(uri);
			if (!alreadyOpen) {
				await waitForDiagnostics(uri, token);
			}
			const diagnostics = vscode.languages.getDiagnostics(uri);
			if (diagnostics.length === 0) {
				return textResult("No diagnostics (errors or warnings) found.");
			}
			return textResult(
				JSON.stringify(diagnosticsPayload(diagnostics), null, 2),
			);
		} catch (error) {
			return errorResult(`Failed to get diagnostics: ${String(error)}`);
		}
	}
}

export class STDefinitionTool {
	async invoke(
		options: InvocationOptions<PositionParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, line, character } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		try {
			const doc = await ensureDocument(uri);
			const position = resolvePosition(doc, line, character);
			const definitions = await vscode.commands.executeCommand<
				vscode.Location[] | vscode.LocationLink[]
			>("vscode.executeDefinitionProvider", uri, position);
			if (!definitions || definitions.length === 0) {
				return textResult("No definition found.");
			}
			const locations = definitions.map(formatLocationLike);
			return textResult(JSON.stringify({ locations }, null, 2));
		} catch (error) {
			return errorResult(`Failed to find definition: ${String(error)}`);
		}
	}
}

export class STDeclarationTool {
	async invoke(
		options: InvocationOptions<PositionParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, line, character } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		try {
			const doc = await ensureDocument(uri);
			const position = resolvePosition(doc, line, character);
			const locations = await vscode.commands.executeCommand<
				vscode.Location[] | vscode.LocationLink[]
			>("vscode.executeDeclarationProvider", uri, position);
			if (!locations || locations.length === 0) {
				return textResult("No declaration found.");
			}
			const formatted = locations.map(formatLocationLike);
			return textResult(JSON.stringify({ locations: formatted }, null, 2));
		} catch (error) {
			return errorResult(`Failed to find declaration: ${String(error)}`);
		}
	}
}

export class STTypeDefinitionTool {
	async invoke(
		options: InvocationOptions<PositionParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, line, character } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		try {
			const doc = await ensureDocument(uri);
			const position = resolvePosition(doc, line, character);
			const locations = await vscode.commands.executeCommand<
				vscode.Location[] | vscode.LocationLink[]
			>("vscode.executeTypeDefinitionProvider", uri, position);
			if (!locations || locations.length === 0) {
				return textResult("No type definition found.");
			}
			const formatted = locations.map(formatLocationLike);
			return textResult(JSON.stringify({ locations: formatted }, null, 2));
		} catch (error) {
			return errorResult(`Failed to find type definition: ${String(error)}`);
		}
	}
}

export class STImplementationTool {
	async invoke(
		options: InvocationOptions<PositionParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, line, character } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		try {
			const doc = await ensureDocument(uri);
			const position = resolvePosition(doc, line, character);
			const implementations = await vscode.commands.executeCommand<
				vscode.Location[] | vscode.LocationLink[]
			>("vscode.executeImplementationProvider", uri, position);
			if (!implementations || implementations.length === 0) {
				return textResult("No implementations found.");
			}
			const locations = implementations.map(formatLocationLike);
			return textResult(JSON.stringify({ locations }, null, 2));
		} catch (error) {
			return errorResult(`Failed to find implementations: ${String(error)}`);
		}
	}
}

export class STReferencesTool {
	async invoke(
		options: InvocationOptions<ReferencesParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, line, character, includeDeclaration } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		try {
			const doc = await ensureDocument(uri);
			const position = resolvePosition(doc, line, character);
			const references = await vscode.commands.executeCommand<
				vscode.Location[]
			>("vscode.executeReferenceProvider", uri, position, {
				includeDeclaration: includeDeclaration ?? true,
			});
			if (!references || references.length === 0) {
				return textResult("No references found.");
			}
			const locations = references.map((ref) => formatLocationLike(ref));
			return textResult(JSON.stringify({ locations }, null, 2));
		} catch (error) {
			return errorResult(`Failed to find references: ${String(error)}`);
		}
	}
}

export class STCompletionTool {
	async invoke(
		options: InvocationOptions<CompletionParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, line, character, triggerCharacter } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		try {
			const doc = await ensureDocument(uri);
			const position = resolvePosition(doc, line, character);
			const completions = await vscode.commands.executeCommand<
				vscode.CompletionList | vscode.CompletionItem[]
			>(
				"vscode.executeCompletionItemProvider",
				uri,
				position,
				triggerCharacter,
			);
			if (!completions) {
				return textResult("No completion items returned.");
			}
			const items = Array.isArray(completions)
				? completions
				: completions.items;
			const { items: trimmed, truncated } = truncateItems(items);
			const payload = trimmed.map((item) => ({
				label: completionLabel(item.label),
				kind: completionKindName(item.kind),
				detail: item.detail || undefined,
				documentation: completionDocumentation(item.documentation),
				insertText: completionInsertText(item.insertText),
			}));
			return textResult(JSON.stringify({ items: payload, truncated }, null, 2));
		} catch (error) {
			return errorResult(`Failed to get completions: ${String(error)}`);
		}
	}
}

export class STSignatureHelpTool {
	async invoke(
		options: InvocationOptions<PositionParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, line, character } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		try {
			const doc = await ensureDocument(uri);
			const position = resolvePosition(doc, line, character);
			const signatureHelp =
				await vscode.commands.executeCommand<vscode.SignatureHelp>(
					"vscode.executeSignatureHelpProvider",
					uri,
					position,
				);
			if (!signatureHelp || signatureHelp.signatures.length === 0) {
				return textResult("No signature help available.");
			}
			const payload = signatureHelp.signatures.map((sig, index) => ({
				label: sig.label,
				documentation: sig.documentation
					? renderMarkup(sig.documentation as unknown)
					: undefined,
				parameters: sig.parameters?.map((param) => ({
					label: param.label,
					documentation: param.documentation
						? renderMarkup(param.documentation as unknown)
						: undefined,
				})),
				isActiveSignature: index === signatureHelp.activeSignature,
			}));
			return textResult(
				JSON.stringify(
					{
						activeSignature: signatureHelp.activeSignature ?? 0,
						activeParameter: signatureHelp.activeParameter ?? 0,
						signatures: payload,
					},
					null,
					2,
				),
			);
		} catch (error) {
			return errorResult(`Failed to get signature help: ${String(error)}`);
		}
	}
}

export class STDocumentSymbolsTool {
	async invoke(
		options: InvocationOptions<DiagnosticsParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		try {
			await ensureDocument(uri);
			const symbols = await vscode.commands.executeCommand<
				vscode.DocumentSymbol[] | vscode.SymbolInformation[]
			>("vscode.executeDocumentSymbolProvider", uri);
			if (!symbols || symbols.length === 0) {
				return textResult("No document symbols found.");
			}
			if (symbols.length > 0 && "location" in symbols[0]) {
				const infoSymbols = symbols as vscode.SymbolInformation[];
				const { items, truncated } = truncateItems(infoSymbols);
				const payload = items.map((symbol) => ({
					name: symbol.name,
					kind: symbolKindName(symbol.kind),
					containerName: symbol.containerName || undefined,
					location: formatLocationLike(symbol.location),
				}));
				return textResult(
					JSON.stringify({ symbols: payload, truncated }, null, 2),
				);
			}
			const docSymbols = symbols as vscode.DocumentSymbol[];
			const flattened = documentSymbolsToList(docSymbols);
			const { items, truncated } = truncateItems(flattened);
			return textResult(JSON.stringify({ symbols: items, truncated }, null, 2));
		} catch (error) {
			return errorResult(`Failed to get document symbols: ${String(error)}`);
		}
	}
}

export class STWorkspaceSymbolsTool {
	async invoke(
		options: InvocationOptions<WorkspaceSymbolsParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { query, limit } = options.input;
		if (!query.trim()) {
			return errorResult("query must be a non-empty string.");
		}
		try {
			const symbols = await vscode.commands.executeCommand<
				vscode.SymbolInformation[]
			>("vscode.executeWorkspaceSymbolProvider", query);
			if (!symbols || symbols.length === 0) {
				return textResult("No workspace symbols found.");
			}
			const { items, truncated } = truncateItems(symbols, limit ?? MAX_ITEMS);
			const payload = items.map((symbol) => ({
				name: symbol.name,
				kind: symbolKindName(symbol.kind),
				containerName: symbol.containerName || undefined,
				location: formatLocationLike(symbol.location),
			}));
			return textResult(
				JSON.stringify({ symbols: payload, truncated }, null, 2),
			);
		} catch (error) {
			return errorResult(`Failed to get workspace symbols: ${String(error)}`);
		}
	}
}

export class STRenameTool {
	async invoke(
		options: InvocationOptions<RenameParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, line, character, newName } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		if (!newName.trim()) {
			return errorResult("newName must be a non-empty string.");
		}
		try {
			const doc = await ensureDocument(uri);
			const position = resolvePosition(doc, line, character);
			const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
				"vscode.executeDocumentRenameProvider",
				uri,
				position,
				newName,
			);
			if (!edit) {
				return textResult("No rename edits returned.");
			}
			const summary = summarizeWorkspaceEdit(edit);
			return textResult(JSON.stringify({ edit: summary }, null, 2));
		} catch (error) {
			return errorResult(`Failed to rename symbol: ${String(error)}`);
		}
	}
}

export class STFormatTool {
	async invoke(
		options: InvocationOptions<DiagnosticsParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		try {
			await ensureDocument(uri);
			const editorConfig = vscode.workspace.getConfiguration("editor", uri);
			const formattingOptions: vscode.FormattingOptions = {
				insertSpaces: editorConfig.get<boolean>("insertSpaces", true),
				tabSize: editorConfig.get<number>("tabSize", 2),
			};
			const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
				"vscode.executeFormatDocumentProvider",
				uri,
				formattingOptions,
			);
			if (!edits || edits.length === 0) {
				return textResult("No formatting edits returned.");
			}
			const edit = summarizeWorkspaceEdit({
				set: () => {},
				insert: () => {},
				delete: () => {},
				replace: () => {},
				entries: () => [[uri, edits]],
				size: edits.length,
				has: () => true,
			} as unknown as vscode.WorkspaceEdit);
			return textResult(JSON.stringify({ edit }, null, 2));
		} catch (error) {
			return errorResult(`Failed to format document: ${String(error)}`);
		}
	}
}
