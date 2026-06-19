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

export class STCallHierarchyPrepareTool extends LspToolBase {
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
		const doc = await ensureDocument(uri);
		const position = resolvePosition(doc, line, character);
		const params = {
			textDocument: { uri: uri.toString() },
			position: resolveLspPosition(position),
		};
		const result = await this.request(
			"textDocument/prepareCallHierarchy",
			params,
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const items = Array.isArray(result.response) ? result.response : [];
		const payload = items.map((item) => ({
			name: item.name,
			kind: item.kind ? vscode.SymbolKind[item.kind] : undefined,
			uri: formatUriString(item.uri),
			range: item.range ? formatLspRange(item.range) : undefined,
			selectionRange: item.selectionRange
				? formatLspRange(item.selectionRange)
				: undefined,
			detail: item.detail ?? undefined,
			item,
		}));
		return textResult(JSON.stringify({ items: payload }, null, 2));
	}
}

export class STCallHierarchyIncomingTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<{ item: unknown }>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { item } = options.input;
		if (!item) {
			return errorResult("item is required.");
		}
		const result = await this.request(
			"callHierarchy/incomingCalls",
			{ item },
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const calls = Array.isArray(result.response) ? result.response : [];
		const payload = calls.map((call) => ({
			from: call.from?.name,
			fromUri: call.from?.uri ? formatUriString(call.from.uri) : undefined,
			fromRange: call.from?.range ? formatLspRange(call.from.range) : undefined,
			fromRanges: Array.isArray(call.fromRanges)
				? call.fromRanges.map(
						(range: {
							start: { line: number; character: number };
							end: { line: number; character: number };
						}) => formatLspRange(range),
					)
				: [],
			call,
		}));
		return textResult(JSON.stringify({ calls: payload }, null, 2));
	}
}

export class STCallHierarchyOutgoingTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<{ item: unknown }>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { item } = options.input;
		if (!item) {
			return errorResult("item is required.");
		}
		const result = await this.request(
			"callHierarchy/outgoingCalls",
			{ item },
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const calls = Array.isArray(result.response) ? result.response : [];
		const payload = calls.map((call) => ({
			to: call.to?.name,
			toUri: call.to?.uri ? formatUriString(call.to.uri) : undefined,
			toRange: call.to?.range ? formatLspRange(call.to.range) : undefined,
			fromRanges: Array.isArray(call.fromRanges)
				? call.fromRanges.map(
						(range: {
							start: { line: number; character: number };
							end: { line: number; character: number };
						}) => formatLspRange(range),
					)
				: [],
			call,
		}));
		return textResult(JSON.stringify({ calls: payload }, null, 2));
	}
}

export class STTypeHierarchyPrepareTool extends LspToolBase {
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
		const doc = await ensureDocument(uri);
		const position = resolvePosition(doc, line, character);
		const params = {
			textDocument: { uri: uri.toString() },
			position: resolveLspPosition(position),
		};
		const result = await this.request(
			"textDocument/prepareTypeHierarchy",
			params,
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const items = Array.isArray(result.response) ? result.response : [];
		const payload = items.map((item) => ({
			name: item.name,
			kind: item.kind ? vscode.SymbolKind[item.kind] : undefined,
			uri: formatUriString(item.uri),
			range: item.range ? formatLspRange(item.range) : undefined,
			selectionRange: item.selectionRange
				? formatLspRange(item.selectionRange)
				: undefined,
			detail: item.detail ?? undefined,
			item,
		}));
		return textResult(JSON.stringify({ items: payload }, null, 2));
	}
}

export class STTypeHierarchySupertypesTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<{ item: unknown }>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { item } = options.input;
		if (!item) {
			return errorResult("item is required.");
		}
		const result = await this.request(
			"typeHierarchy/supertypes",
			{ item },
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const items = Array.isArray(result.response) ? result.response : [];
		const payload = items.map((entry) => ({
			name: entry.name,
			kind: entry.kind ? vscode.SymbolKind[entry.kind] : undefined,
			uri: formatUriString(entry.uri),
			range: entry.range ? formatLspRange(entry.range) : undefined,
			selectionRange: entry.selectionRange
				? formatLspRange(entry.selectionRange)
				: undefined,
			detail: entry.detail ?? undefined,
			item: entry,
		}));
		return textResult(JSON.stringify({ items: payload }, null, 2));
	}
}

export class STTypeHierarchySubtypesTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<{ item: unknown }>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { item } = options.input;
		if (!item) {
			return errorResult("item is required.");
		}
		const result = await this.request(
			"typeHierarchy/subtypes",
			{ item },
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const items = Array.isArray(result.response) ? result.response : [];
		const payload = items.map((entry) => ({
			name: entry.name,
			kind: entry.kind ? vscode.SymbolKind[entry.kind] : undefined,
			uri: formatUriString(entry.uri),
			range: entry.range ? formatLspRange(entry.range) : undefined,
			selectionRange: entry.selectionRange
				? formatLspRange(entry.selectionRange)
				: undefined,
			detail: entry.detail ?? undefined,
			item: entry,
		}));
		return textResult(JSON.stringify({ items: payload }, null, 2));
	}
}
