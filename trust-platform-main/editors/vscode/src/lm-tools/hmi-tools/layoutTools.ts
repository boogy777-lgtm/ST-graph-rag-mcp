// Responsibility: focused LM tools module with a single concern.
import * as path from "path";
import * as vscode from "vscode";
import { LspToolBase } from "../lspTools";
import { requestRuntimeControl } from "../runtimeControl";
import * as shared from "../shared";

const {
	asRecord,
	buildHmiLockEntries,
	coerceInt,
	collectHmiDiagnosticsForFiles,
	ensureWorkspaceUri,
	errorCodeMatches,
	errorResult,
	evidenceRunId,
	extractErrorCode,
	extractLayoutBindingRefs,
	generateHmiCandidates,
	hashContent,
	HMI_CANDIDATE_STRATEGIES,
	hmiDescriptorFileFromPointer,
	hmiSeverityRank,
	layoutDescriptorPages,
	normalizeErrorCode,
	normalizeEvidenceRunId,
	normalizeHmiBindingsCatalog,
	normalizeScenario,
	normalizeSnapshotViewports,
	normalizeStringList,
	normalizeTraceIds,
	parseHmiSchemaPayload,
	parseHmiValuesPayload,
	parseQuotedArrayFromToml,
	parseWritePolicyFromConfigToml,
	pruneEvidenceRuns,
	readHmiLayoutSnapshot,
	renderIntentToml,
	renderSnapshotSvg,
	resolveWorkspaceFolder,
	sleepWithCancellation,
	stableComponent,
	stableJsonString,
	textResult,
	uriFromFilePath,
	writeUtf8File,
} = shared;

type InvocationOptions<T> = shared.InvocationOptions<T>;
type HmiBindingsParams = shared.HmiBindingsParams;
type HmiGetLayoutParams = shared.HmiGetLayoutParams;
type HmiApplyPatchParams = shared.HmiApplyPatchParams;
type HmiPlanIntentParams = shared.HmiPlanIntentParams;
type HmiValidateParams = shared.HmiValidateParams;
type HmiTraceCaptureParams = shared.HmiTraceCaptureParams;
type HmiGenerateCandidatesParams = shared.HmiGenerateCandidatesParams;
type HmiPreviewSnapshotParams = shared.HmiPreviewSnapshotParams;
type HmiRunJourneyParams = shared.HmiRunJourneyParams;
type HmiExplainWidgetParams = shared.HmiExplainWidgetParams;
type HmiInitParams = shared.HmiInitParams;
type HmiValidationCheck = shared.HmiValidationCheck;
type HmiSchemaResult = shared.HmiSchemaResult;
type HmiCandidate = shared.HmiCandidate;
type HmiJourneyAction = shared.HmiJourneyAction;
type SnapshotViewport = shared.SnapshotViewport;

export class STHmiGetBindingsTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<HmiBindingsParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}

		const args: Record<string, unknown> = {};
		if (options.input.rootPath && options.input.rootPath.trim()) {
			const uri = uriFromFilePath(options.input.rootPath.trim());
			if (!uri) {
				return errorResult("rootPath must be an absolute path or URI.");
			}
			const workspaceError = ensureWorkspaceUri(uri);
			if (workspaceError) {
				return errorResult(workspaceError);
			}
			args.root_uri = uri.toString();
		}
		if (options.input.filePath && options.input.filePath.trim()) {
			const uri = uriFromFilePath(options.input.filePath.trim());
			if (!uri) {
				return errorResult("filePath must be an absolute path or URI.");
			}
			const workspaceError = ensureWorkspaceUri(uri);
			if (workspaceError) {
				return errorResult(workspaceError);
			}
			args.text_document = { uri: uri.toString() };
		}

		const result = await this.request(
			"workspace/executeCommand",
			{
				command: "trust-lsp.hmiBindings",
				arguments: Object.keys(args).length > 0 ? [args] : [],
			},
			token,
		);
		if ("error" in result) {
			return errorResult(result.error);
		}
		const response = result.response as {
			ok?: boolean;
			error?: unknown;
		} | null;
		if (response && typeof response === "object" && response.ok === false) {
			const message =
				typeof response.error === "string"
					? response.error
					: "trust-lsp.hmiBindings failed.";
			return errorResult(message);
		}
		return textResult(
			JSON.stringify(
				{
					command: "trust-lsp.hmiBindings",
					result: result.response,
				},
				null,
				2,
			),
		);
	}
}

export class STHmiGetLayoutTool {
	async invoke(
		options: InvocationOptions<HmiGetLayoutParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const layout = await readHmiLayoutSnapshot(options.input.rootPath, token);
		if (layout.error) {
			if (layout.error === "Cancelled.") {
				return textResult("Cancelled.");
			}
			return errorResult(layout.error);
		}
		const snapshot = layout.snapshot;
		if (!snapshot) {
			return errorResult("Unable to read HMI layout.");
		}
		return textResult(
			JSON.stringify(
				snapshot.exists
					? snapshot
					: {
							exists: false,
							rootPath: snapshot.rootPath,
							hmiPath: snapshot.hmiPath,
						},
				null,
				2,
			),
		);
	}
}

export class STHmiApplyPatchTool {
	async invoke(
		options: InvocationOptions<HmiApplyPatchParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		if (
			!Array.isArray(options.input.operations) ||
			options.input.operations.length === 0
		) {
			return errorResult("operations must be a non-empty array.");
		}

		const resolved = resolveWorkspaceFolder(options.input.rootPath);
		if (resolved.error || !resolved.folder) {
			return errorResult(
				resolved.error ?? "Unable to resolve workspace folder.",
			);
		}
		const dryRun = options.input.dry_run === true;
		const hmiRoot = vscode.Uri.joinPath(resolved.folder.uri, "hmi");

		const currentFiles = new Map<string, string>();
		try {
			const entries = await vscode.workspace.fs.readDirectory(hmiRoot);
			for (const [name, kind] of entries) {
				if (
					kind !== vscode.FileType.File ||
					!name.toLowerCase().endsWith(".toml")
				) {
					continue;
				}
				const content = await vscode.workspace.fs.readFile(
					vscode.Uri.joinPath(hmiRoot, name),
				);
				currentFiles.set(name, Buffer.from(content).toString("utf8"));
			}
		} catch {
			// hmi/ may not exist yet; this is valid for patch application.
		}

		const nextFiles = new Map(currentFiles);
		const conflicts: Array<{
			code: string;
			index: number;
			path?: string;
			message: string;
		}> = [];

		for (const [index, operation] of options.input.operations.entries()) {
			if (token.isCancellationRequested) {
				return textResult("Cancelled.");
			}
			const op = operation?.op;
			if (!op || !["add", "remove", "replace", "move"].includes(op)) {
				conflicts.push({
					code: "HMI_PATCH_INVALID_OP",
					index,
					message: "operation.op must be one of add/remove/replace/move",
				});
				continue;
			}
			const target = hmiDescriptorFileFromPointer(String(operation.path ?? ""));
			if (!target) {
				conflicts.push({
					code: "HMI_PATCH_INVALID_PATH",
					index,
					path: String(operation.path ?? ""),
					message:
						"path must target /files/<name>.toml or /files/<name>.toml/content",
				});
				continue;
			}

			if (op === "add" || op === "replace") {
				if (typeof operation.value !== "string") {
					conflicts.push({
						code: "HMI_PATCH_TYPE_MISMATCH",
						index,
						path: String(operation.path ?? ""),
						message:
							"add/replace requires a string value containing TOML content",
					});
					continue;
				}
				if (op === "add" && nextFiles.has(target)) {
					conflicts.push({
						code: "HMI_PATCH_CONFLICT_EXISTS",
						index,
						path: String(operation.path ?? ""),
						message: `target file '${target}' already exists`,
					});
					continue;
				}
				if (op === "replace" && !nextFiles.has(target)) {
					conflicts.push({
						code: "HMI_PATCH_NOT_FOUND",
						index,
						path: String(operation.path ?? ""),
						message: `target file '${target}' does not exist`,
					});
					continue;
				}
				nextFiles.set(target, operation.value);
				continue;
			}

			if (op === "remove") {
				if (!nextFiles.has(target)) {
					conflicts.push({
						code: "HMI_PATCH_NOT_FOUND",
						index,
						path: String(operation.path ?? ""),
						message: `target file '${target}' does not exist`,
					});
					continue;
				}
				nextFiles.delete(target);
				continue;
			}

			const from = hmiDescriptorFileFromPointer(String(operation.from ?? ""));
			if (!from) {
				conflicts.push({
					code: "HMI_PATCH_INVALID_FROM",
					index,
					path: String(operation.from ?? ""),
					message: "move requires a valid from pointer",
				});
				continue;
			}
			const sourceText = nextFiles.get(from);
			if (sourceText === undefined) {
				conflicts.push({
					code: "HMI_PATCH_NOT_FOUND",
					index,
					path: String(operation.from ?? ""),
					message: `source file '${from}' does not exist`,
				});
				continue;
			}
			if (nextFiles.has(target)) {
				conflicts.push({
					code: "HMI_PATCH_CONFLICT_EXISTS",
					index,
					path: String(operation.path ?? ""),
					message: `target file '${target}' already exists`,
				});
				continue;
			}
			nextFiles.delete(from);
			nextFiles.set(target, sourceText);
		}

		const changedFiles: Array<{
			file: string;
			action: "add" | "replace" | "remove";
		}> = [];
		const names = new Set<string>([
			...currentFiles.keys(),
			...nextFiles.keys(),
		]);
		for (const name of Array.from(names.values()).sort((left, right) =>
			left.localeCompare(right),
		)) {
			const before = currentFiles.get(name);
			const after = nextFiles.get(name);
			if (before === undefined && after !== undefined) {
				changedFiles.push({
					file: path.posix.join("hmi", name),
					action: "add",
				});
			} else if (before !== undefined && after === undefined) {
				changedFiles.push({
					file: path.posix.join("hmi", name),
					action: "remove",
				});
			} else if (
				before !== undefined &&
				after !== undefined &&
				before !== after
			) {
				changedFiles.push({
					file: path.posix.join("hmi", name),
					action: "replace",
				});
			}
		}

		if (dryRun || conflicts.length > 0) {
			return textResult(
				JSON.stringify(
					{
						ok: conflicts.length === 0,
						dry_run: dryRun,
						rootPath: resolved.folder.uri.fsPath,
						conflicts,
						changes: changedFiles,
					},
					null,
					2,
				),
			);
		}

		await vscode.workspace.fs.createDirectory(hmiRoot);
		for (const change of changedFiles) {
			if (token.isCancellationRequested) {
				return textResult("Cancelled.");
			}
			const fileName = change.file.slice("hmi/".length);
			const fileUri = vscode.Uri.joinPath(hmiRoot, fileName);
			if (change.action === "remove") {
				try {
					await vscode.workspace.fs.delete(fileUri, { useTrash: false });
				} catch {
					// Ignore missing files during remove reconciliation.
				}
				continue;
			}
			const text = nextFiles.get(fileName) ?? "";
			await vscode.workspace.fs.writeFile(fileUri, Buffer.from(text, "utf8"));
		}

		try {
			await vscode.commands.executeCommand(
				"trust-lsp.hmi.refreshFromDescriptor",
			);
		} catch {
			// Optional refresh command; ignore failures.
		}

		return textResult(
			JSON.stringify(
				{
					ok: true,
					dry_run: false,
					rootPath: resolved.folder.uri.fsPath,
					conflicts: [],
					changes: changedFiles,
				},
				null,
				2,
			),
		);
	}
}

export class STHmiPlanIntentTool {
	async invoke(
		options: InvocationOptions<HmiPlanIntentParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const layout = await readHmiLayoutSnapshot(options.input.rootPath, token);
		if (layout.error) {
			if (layout.error === "Cancelled.") {
				return textResult("Cancelled.");
			}
			return errorResult(layout.error);
		}
		const snapshot = layout.snapshot;
		if (!snapshot) {
			return errorResult("Unable to resolve HMI workspace.");
		}
		const dryRun = options.input.dry_run === true;
		const hmiRoot = vscode.Uri.file(snapshot.hmiPath);
		const intentUri = vscode.Uri.joinPath(hmiRoot, "_intent.toml");
		const content = renderIntentToml(options.input);

		let previous = "";
		let existed = false;
		try {
			const bytes = await vscode.workspace.fs.readFile(intentUri);
			previous = Buffer.from(bytes).toString("utf8");
			existed = true;
		} catch {
			existed = false;
		}

		const changed = previous !== content;
		if (!dryRun && changed) {
			await vscode.workspace.fs.createDirectory(hmiRoot);
			await writeUtf8File(intentUri, content);
		}

		return textResult(
			JSON.stringify(
				{
					ok: true,
					dry_run: dryRun,
					rootPath: snapshot.rootPath,
					intentPath: path.posix.join("hmi", "_intent.toml"),
					existed,
					changed,
					content,
				},
				null,
				2,
			),
		);
	}
}
