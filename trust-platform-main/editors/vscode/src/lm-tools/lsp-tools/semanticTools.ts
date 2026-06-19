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

export class STSemanticTokensFullTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<DiagnosticsParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const uri = uriFromFilePath(options.input.filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		await ensureDocument(uri);
		const params = { textDocument: { uri: uri.toString() } };
		const result = await this.request(
			"textDocument/semanticTokens/full",
			params,
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		return textResult(
			JSON.stringify(summarizeSemanticTokens(result.response), null, 2),
		);
	}
}

export class STSemanticTokensDeltaTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<SemanticTokensDeltaParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, previousResultId } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		if (!previousResultId.trim()) {
			return errorResult("previousResultId must be a non-empty string.");
		}
		await ensureDocument(uri);
		const params = {
			textDocument: { uri: uri.toString() },
			previousResultId,
		};
		const result = await this.request(
			"textDocument/semanticTokens/full/delta",
			params,
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		return textResult(
			JSON.stringify(summarizeSemanticTokens(result.response), null, 2),
		);
	}
}

export class STSemanticTokensRangeTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<SemanticTokensRangeParams>,
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
		const doc = await ensureDocument(uri);
		const range = resolveRange(
			doc,
			startLine,
			startCharacter,
			endLine,
			endCharacter,
		);
		const params = {
			textDocument: { uri: uri.toString() },
			range: resolveLspRange(range),
		};
		const result = await this.request(
			"textDocument/semanticTokens/range",
			params,
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		return textResult(
			JSON.stringify(summarizeSemanticTokens(result.response), null, 2),
		);
	}
}

export class STInlayHintsTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<InlayHintsParams>,
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
		const doc = await ensureDocument(uri);
		const range = resolveRange(
			doc,
			startLine,
			startCharacter,
			endLine,
			endCharacter,
		);
		const params = {
			textDocument: { uri: uri.toString() },
			range: resolveLspRange(range),
		};
		const result = await this.request("textDocument/inlayHint", params, token);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const hints = Array.isArray(result.response) ? result.response : [];
		const { items, truncated } = truncateItems(hints);
		const payload = items.map((hint) => ({
			position: hint.position
				? `${hint.position.line + 1}:${hint.position.character + 1}`
				: undefined,
			label: hint.label ? inlayHintLabel(hint.label) : "",
			kind:
				typeof hint.kind === "number"
					? vscode.InlayHintKind[hint.kind]
					: undefined,
			tooltip: hint.tooltip ? renderMarkup(hint.tooltip) : undefined,
			paddingLeft: hint.paddingLeft ?? false,
			paddingRight: hint.paddingRight ?? false,
		}));
		return textResult(JSON.stringify({ hints: payload, truncated }, null, 2));
	}
}

export class STLinkedEditingTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<LinkedEditingParams>,
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
		const doc = await ensureDocument(uri);
		const position = resolvePosition(doc, line, character);
		const params = {
			textDocument: { uri: uri.toString() },
			position: resolveLspPosition(position),
		};
		const result = await this.request(
			"textDocument/linkedEditingRange",
			params,
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const linked = result.response as {
			ranges?: any[];
			wordPattern?: string;
		} | null;
		if (!linked || !Array.isArray(linked.ranges)) {
			return textResult("No linked editing ranges returned.");
		}
		const ranges = linked.ranges.map((range) => formatLspRange(range));
		return textResult(
			JSON.stringify({ ranges, wordPattern: linked.wordPattern }, null, 2),
		);
	}
}

export class STDocumentLinksTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<DocumentLinksParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, resolve } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		await ensureDocument(uri);
		const params = { textDocument: { uri: uri.toString() } };
		const result = await this.request(
			"textDocument/documentLink",
			params,
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const links = Array.isArray(result.response) ? result.response : [];
		const { items, truncated } = truncateItems(links);
		const payload: Array<{
			range: string;
			target?: string;
			tooltip?: string;
		}> = [];
		for (const link of items) {
			let resolvedLink = link;
			if (resolve) {
				const resolved = await this.request(
					"documentLink/resolve",
					link,
					token,
				);
				if (!("error" in resolved)) {
					resolvedLink = resolved.response;
				}
			}
			payload.push({
				range: resolvedLink.range ? formatLspRange(resolvedLink.range) : "",
				target: resolvedLink.target
					? formatUriString(resolvedLink.target)
					: undefined,
				tooltip: resolvedLink.tooltip
					? renderMarkup(resolvedLink.tooltip)
					: undefined,
			});
		}
		return textResult(JSON.stringify({ links: payload, truncated }, null, 2));
	}
}

export class STCodeLensTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<CodeLensParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, resolve } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		await ensureDocument(uri);
		const params = { textDocument: { uri: uri.toString() } };
		const result = await this.request("textDocument/codeLens", params, token);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const lenses = Array.isArray(result.response) ? result.response : [];
		const { items, truncated } = truncateItems(lenses);
		const payload = [];
		for (const lens of items) {
			let resolvedLens = lens;
			if (resolve) {
				const resolved = await this.request("codeLens/resolve", lens, token);
				if (!("error" in resolved)) {
					resolvedLens = resolved.response;
				}
			}
			payload.push({
				range: resolvedLens.range ? formatLspRange(resolvedLens.range) : "",
				command: resolvedLens.command?.title ?? undefined,
			});
		}
		return textResult(JSON.stringify({ lenses: payload, truncated }, null, 2));
	}
}

export class STSelectionRangeTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<RangePositionsParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { filePath, positions } = options.input;
		const uri = uriFromFilePath(filePath);
		if (!uri) {
			return errorResult("filePath must be an absolute path or URI.");
		}
		if (!Array.isArray(positions) || positions.length === 0) {
			return errorResult("positions must be a non-empty array.");
		}
		const doc = await ensureDocument(uri);
		const lspPositions = positions.map((pos) =>
			resolveLspPosition(resolvePosition(doc, pos.line, pos.character)),
		);
		const params = {
			textDocument: { uri: uri.toString() },
			positions: lspPositions,
		};
		const result = await this.request(
			"textDocument/selectionRange",
			params,
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const ranges = Array.isArray(result.response) ? result.response : [];
		const payload = ranges.map((range) => {
			const chain: string[] = [];
			let current = range;
			while (current) {
				chain.push(formatLspRange(current.range));
				current = current.parent;
			}
			return chain;
		});
		return textResult(JSON.stringify({ ranges: payload }, null, 2));
	}
}

export class STOnTypeFormattingTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<OnTypeFormattingParams>,
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
		if (!triggerCharacter) {
			return errorResult("triggerCharacter must be provided.");
		}
		const doc = await ensureDocument(uri);
		const position = resolvePosition(doc, line, character);
		const editorConfig = vscode.workspace.getConfiguration("editor", uri);
		const formattingOptions = {
			insertSpaces: editorConfig.get<boolean>("insertSpaces", true),
			tabSize: editorConfig.get<number>("tabSize", 2),
		};
		const params = {
			textDocument: { uri: uri.toString() },
			position: resolveLspPosition(position),
			ch: triggerCharacter,
			options: formattingOptions,
		};
		const result = await this.request(
			"textDocument/onTypeFormatting",
			params,
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const edits = Array.isArray(result.response) ? result.response : [];
		const summary = summarizeLspTextEdits(edits);
		return textResult(JSON.stringify(summary, null, 2));
	}
}
