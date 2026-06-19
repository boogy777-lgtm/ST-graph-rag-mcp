// Responsibility: focused LM tools module with a single concern.
import { TextDecoder } from "util";
import type * as vscode from "vscode";
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

export class LspToolBase {
	constructor(protected readonly getClient?: LspClientProvider) {}

	protected async request(
		method: string,
		params: unknown,
		token: vscode.CancellationToken,
		options?: {
			requestTimeoutMs?: number;
			captureNotifications?: string[];
			notificationTimeoutMs?: number;
		},
	): Promise<
		| {
				response: unknown;
				notifications: Array<{ method: string; params: unknown }>;
		  }
		| { error: string }
	> {
		return sendLspRequest(this.getClient, method, params, token, options);
	}
}

export class STCodeActionsTool extends LspToolBase {
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
		try {
			const doc = await ensureDocument(uri);
			const range = resolveRange(
				doc,
				startLine,
				startCharacter,
				endLine,
				endCharacter,
			);
			const diagnostics = diagnosticsForRange(uri, range).map(toLspDiagnostic);
			const params = {
				textDocument: { uri: uri.toString() },
				range: resolveLspRange(range),
				context: {
					diagnostics,
					triggerKind: 1,
				},
			};
			const result = await this.request(
				"textDocument/codeAction",
				params,
				token,
			);
			if ("error" in result) {
				return errorResult(result.error);
			}
			const actions = Array.isArray(result.response) ? result.response : [];
			if (actions.length === 0) {
				return textResult("No code actions found.");
			}
			const payload = actions.map((action) => {
				const isCodeAction =
					action &&
					typeof action === "object" &&
					("edit" in action ||
						"kind" in action ||
						"isPreferred" in action ||
						"disabled" in action);
				if (!isCodeAction) {
					const cmd = action as vscode.Command;
					return {
						title: cmd.title,
						command: cmd.command,
						arguments: cmd.arguments,
					};
				}
				const codeAction = action as vscode.CodeAction;
				const kind =
					typeof codeAction.kind === "string"
						? codeAction.kind
						: codeAction.kind?.value;
				return {
					title: codeAction.title,
					kind,
					isPreferred: codeAction.isPreferred ?? false,
					command: codeAction.command?.command,
					arguments: codeAction.command?.arguments,
				};
			});
			return textResult(JSON.stringify({ actions: payload }, null, 2));
		} catch (error) {
			return errorResult(`Failed to get code actions: ${String(error)}`);
		}
	}
}

export class STLspRequestTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<LspRequestParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const {
			method,
			params,
			requestTimeoutMs,
			captureNotifications,
			notificationTimeoutMs,
			captureProgress,
			capturePartialResults,
			workDoneToken,
			partialResultToken,
		} = options.input;
		if (!method || !method.trim()) {
			return errorResult("method must be a non-empty string.");
		}
		const notificationSet = new Set(captureNotifications ?? []);
		let nextParams = params;
		let usedWorkDoneToken = workDoneToken;
		let usedPartialResultToken = partialResultToken;
		const wantsProgress =
			captureProgress ||
			capturePartialResults ||
			!!workDoneToken ||
			!!partialResultToken;
		if (wantsProgress) {
			if (!params || typeof params !== "object" || Array.isArray(params)) {
				return errorResult(
					"params must be an object when progress/partial tokens are requested.",
				);
			}
			const paramRecord = { ...(params as Record<string, unknown>) };
			if (typeof paramRecord.workDoneToken === "string") {
				usedWorkDoneToken = paramRecord.workDoneToken;
			}
			if (typeof paramRecord.partialResultToken === "string") {
				usedPartialResultToken = paramRecord.partialResultToken;
			}
			if (!usedWorkDoneToken && captureProgress) {
				usedWorkDoneToken = makeProgressToken("trustlsp-work");
			}
			if (!usedPartialResultToken && capturePartialResults) {
				usedPartialResultToken = makeProgressToken("trustlsp-partial");
			}
			if (usedWorkDoneToken && paramRecord.workDoneToken === undefined) {
				paramRecord.workDoneToken = usedWorkDoneToken;
			}
			if (
				usedPartialResultToken &&
				paramRecord.partialResultToken === undefined
			) {
				paramRecord.partialResultToken = usedPartialResultToken;
			}
			notificationSet.add("$/progress");
			nextParams = paramRecord;
		}
		const result = await this.request(method, nextParams, token, {
			requestTimeoutMs,
			captureNotifications: Array.from(notificationSet),
			notificationTimeoutMs,
		});
		if ("error" in result) {
			return errorResult(result.error);
		}
		return textResult(
			JSON.stringify(
				{
					response: result.response,
					notifications: result.notifications,
					workDoneToken: usedWorkDoneToken ?? undefined,
					partialResultToken: usedPartialResultToken ?? undefined,
				},
				null,
				2,
			),
		);
	}
}

export class STLspNotificationTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<LspNotificationParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const { method, params } = options.input;
		if (!method || !method.trim()) {
			return errorResult("method must be a non-empty string.");
		}
		const client = this.getClient?.();
		if (!client) {
			return clientUnavailableResult();
		}
		try {
			await client.sendNotification(method, params);
			return textResult("Notification sent.");
		} catch (error) {
			return errorResult(`Failed to send notification: ${String(error)}`);
		}
	}
}
