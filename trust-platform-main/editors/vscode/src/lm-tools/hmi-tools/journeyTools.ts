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

export class STHmiRunJourneyTool {
	async invoke(
		options: InvocationOptions<HmiRunJourneyParams>,
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
		if (!snapshot || !snapshot.exists) {
			return errorResult("hmi/ directory does not exist.");
		}

		let schema: HmiSchemaResult;
		try {
			const schemaRaw = await requestRuntimeControl(
				snapshot.rootPath,
				token,
				"hmi.schema.get",
				undefined,
			);
			const parsedSchema = parseHmiSchemaPayload(schemaRaw);
			if (!parsedSchema) {
				return errorResult(
					"runtime returned an invalid hmi.schema.get payload.",
				);
			}
			schema = parsedSchema;
		} catch (error) {
			return errorResult(
				`Failed to execute journey schema load: ${String(error)}`,
			);
		}

		const defaultIds = normalizeTraceIds(undefined, schema).slice(0, 5);
		const schemaWidgetById = new Map(
			schema.widgets.map((widget) => [widget.id, widget] as const),
		);
		const writePolicy = parseWritePolicyFromConfigToml(
			snapshot.config?.content,
		);
		const writeAllow = new Set(writePolicy.allow);

		const localWriteGuard = (
			widgetId: string,
		): { code: string; message: string } | undefined => {
			if (schema.read_only) {
				return {
					code: "HMI_JOURNEY_WRITE_READ_ONLY",
					message: "hmi.write is disabled because runtime schema is read-only.",
				};
			}
			if (!writePolicy.enabled) {
				return {
					code: "HMI_JOURNEY_WRITE_DISABLED",
					message: "hmi.write is disabled in hmi/_config.toml.",
				};
			}
			if (writeAllow.size === 0) {
				return {
					code: "HMI_JOURNEY_WRITE_ALLOWLIST_EMPTY",
					message: "hmi.write allowlist is empty in hmi/_config.toml.",
				};
			}
			const widgetPath = schemaWidgetById.get(widgetId)?.path;
			const allowlisted =
				writeAllow.has(widgetId) ||
				(widgetPath ? writeAllow.has(widgetPath) : false);
			if (!allowlisted) {
				return {
					code: "HMI_JOURNEY_WRITE_NOT_ALLOWLISTED",
					message: `write target '${widgetId}' is not in tool-side allowlist checks`,
				};
			}
			return undefined;
		};

		const requestedJourneys = Array.isArray(options.input.journeys)
			? options.input.journeys
			: [];
		const journeys = requestedJourneys
			.map((journey, index) => {
				const id =
					typeof journey.id === "string" && journey.id.trim()
						? stableComponent(journey.id)
						: `journey-${index + 1}`;
				const title =
					typeof journey.title === "string" && journey.title.trim()
						? journey.title.trim()
						: `Journey ${index + 1}`;
				const maxDurationMs = coerceInt(
					journey.max_duration_ms,
					60000,
					100,
					300000,
				);
				const steps =
					Array.isArray(journey.steps) && journey.steps.length > 0
						? journey.steps
						: [{ action: "read_values" as const, ids: defaultIds }];
				return {
					id,
					title,
					max_duration_ms: maxDurationMs,
					steps,
				};
			})
			.filter((journey) => journey.steps.length > 0);
		if (journeys.length === 0) {
			journeys.push({
				id: "default",
				title: "Default value fetch journey",
				max_duration_ms: 60000,
				steps: [{ action: "read_values", ids: defaultIds }],
			});
		}

		const dryRun = options.input.dry_run === true;
		const scenario = normalizeScenario(options.input.scenario);
		const generatedAt = new Date();
		const runId =
			normalizeEvidenceRunId(options.input.run_id) ??
			evidenceRunId(generatedAt);
		const results: Array<{
			id: string;
			title: string;
			status: "passed" | "failed";
			duration_ms: number;
			api_actions: number;
			steps: Array<{
				index: number;
				action: HmiJourneyAction;
				status: "passed" | "failed";
				duration_ms: number;
				code?: string;
				detail?: string;
			}>;
		}> = [];
		for (const journey of journeys) {
			if (token.isCancellationRequested) {
				return textResult("Cancelled.");
			}
			const stepResults: Array<{
				index: number;
				action: HmiJourneyAction;
				status: "passed" | "failed";
				duration_ms: number;
				code?: string;
				detail?: string;
			}> = [];
			let apiActions = 0;
			let failed = false;
			const started = Date.now();
			for (const [stepIndex, step] of journey.steps.entries()) {
				const action = step.action;
				const stepStarted = Date.now();
				let status: "passed" | "failed" = "passed";
				let code: string | undefined;
				let detail: string | undefined;
				if (action === "wait") {
					const durationMs = coerceInt(step.duration_ms, 150, 10, 10000);
					const slept = await sleepWithCancellation(durationMs, token);
					if (!slept) {
						return textResult("Cancelled.");
					}
				} else if (action === "read_values") {
					apiActions += 1;
					const ids = normalizeStringList(step.ids);
					const requestIds = ids.length > 0 ? ids : defaultIds;
					try {
						const valuesRaw = await requestRuntimeControl(
							snapshot.rootPath,
							token,
							"hmi.values.get",
							{ ids: requestIds },
						);
						const parsedValues = parseHmiValuesPayload(valuesRaw);
						if (!parsedValues) {
							throw new Error(
								"runtime returned an invalid hmi.values.get payload.",
							);
						}
						detail = `values=${Object.keys(parsedValues.values).length}`;
					} catch (error) {
						status = "failed";
						code = "HMI_JOURNEY_READ_VALUES_FAILED";
						detail = String(error);
					}
				} else if (action === "write") {
					const widgetId =
						typeof step.widget_id === "string" ? step.widget_id.trim() : "";
					const expectedErrorCode = normalizeErrorCode(step.expect_error_code);
					if (!widgetId) {
						status = "failed";
						code = "HMI_JOURNEY_WRITE_MISSING_TARGET";
						detail = "write step requires widget_id";
					} else {
						const blocked = localWriteGuard(widgetId);
						if (blocked) {
							code = blocked.code;
							detail = blocked.message;
							status = errorCodeMatches(expectedErrorCode, code, detail)
								? "passed"
								: "failed";
						} else {
							apiActions += 1;
							try {
								await requestRuntimeControl(
									snapshot.rootPath,
									token,
									"hmi.write",
									{ id: widgetId, value: step.value },
								);
								if (expectedErrorCode) {
									status = "failed";
									code = "HMI_JOURNEY_EXPECTED_ERROR_MISSING";
									detail = `expected error code '${expectedErrorCode}' but write succeeded`;
								}
							} catch (error) {
								const message = String(error);
								const runtimeCode = extractErrorCode(message);
								code = runtimeCode ?? "HMI_JOURNEY_WRITE_FAILED";
								if (errorCodeMatches(expectedErrorCode, code, message)) {
									status = "passed";
									detail = message;
								} else {
									status = "failed";
									detail = message;
								}
							}
						}
					}
				}
				const durationMs = Date.now() - stepStarted;
				if (status === "failed") {
					failed = true;
				}
				stepResults.push({
					index: stepIndex + 1,
					action,
					status,
					duration_ms: durationMs,
					code,
					detail,
				});
			}
			const durationMs = Date.now() - started;
			if (durationMs > journey.max_duration_ms) {
				failed = true;
			}
			results.push({
				id: journey.id,
				title: journey.title,
				status: failed ? "failed" : "passed",
				duration_ms: durationMs,
				api_actions: apiActions,
				steps: stepResults,
			});
		}

		const ok = results.every((journey) => journey.status === "passed");
		const journeysDocument = {
			version: 1,
			generated_at: generatedAt.toISOString(),
			scenario,
			ok,
			journeys: results,
		};

		let evidencePath: string | null = null;
		let journeysPath: string | null = null;
		if (!dryRun) {
			const hmiRoot = vscode.Uri.file(snapshot.hmiPath);
			const runRoot = vscode.Uri.joinPath(hmiRoot, "_evidence", runId);
			await vscode.workspace.fs.createDirectory(runRoot);
			await writeUtf8File(
				vscode.Uri.joinPath(runRoot, "journeys.json"),
				`${stableJsonString(journeysDocument)}\n`,
			);
			evidencePath = path.posix.join("hmi", "_evidence", runId);
			journeysPath = path.posix.join(evidencePath, "journeys.json");
		}

		return textResult(
			JSON.stringify(
				{
					ok,
					dry_run: dryRun,
					rootPath: snapshot.rootPath,
					run_id: runId,
					scenario,
					evidencePath,
					journeysPath,
					journeys: results,
				},
				null,
				2,
			),
		);
	}
}

export class STHmiExplainWidgetTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<HmiExplainWidgetParams>,
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
		if (!snapshot || !snapshot.exists) {
			return errorResult("hmi/ directory does not exist.");
		}

		const descriptorPages = layoutDescriptorPages(snapshot.files);
		const refs = extractLayoutBindingRefs(descriptorPages);
		let catalog = normalizeHmiBindingsCatalog({});
		let catalogAvailable = false;
		let catalogError: string | undefined;
		const bindingsRequest = await this.request(
			"workspace/executeCommand",
			{
				command: "trust-lsp.hmiBindings",
				arguments: [
					{ root_uri: vscode.Uri.file(snapshot.rootPath).toString() },
				],
			},
			token,
		);
		if ("error" in bindingsRequest) {
			catalogError = bindingsRequest.error;
		} else {
			const payload =
				bindingsRequest.response && typeof bindingsRequest.response === "object"
					? (bindingsRequest.response as Record<string, unknown>)
					: {};
			if (payload.ok === false) {
				catalogError = String(payload.error ?? "unknown error");
			} else {
				catalog = normalizeHmiBindingsCatalog(payload);
				catalogAvailable = true;
			}
		}

		const lock = buildHmiLockEntries(refs, catalog);
		const requestedId = options.input.widget_id?.trim();
		const requestedPath = options.input.path?.trim();
		const selected =
			(requestedId
				? lock.entries.find((entry) => entry.id === requestedId)
				: undefined) ??
			(requestedPath
				? lock.entries.find((entry) => entry.path === requestedPath)
				: undefined) ??
			lock.entries[0];
		if (!selected) {
			return errorResult(
				"No widget/binding metadata available for explanation.",
			);
		}

		const writePolicy = parseWritePolicyFromConfigToml(
			snapshot.config?.content,
		);
		const allowlisted =
			writePolicy.allow.includes(selected.id) ||
			writePolicy.allow.includes(selected.path);
		const bindingCatalogEntry = catalog.byPath.get(selected.path);

		return textResult(
			JSON.stringify(
				{
					ok: true,
					rootPath: snapshot.rootPath,
					requested: {
						widget_id: requestedId ?? null,
						path: requestedPath ?? null,
					},
					widget: selected,
					provenance: {
						canonical_id: selected.id,
						symbol_path: selected.path,
						type: selected.data_type,
						qualifier: selected.qualifier,
						writable: selected.writable,
						write_policy: {
							enabled: writePolicy.enabled,
							allowlisted,
							allow: writePolicy.allow,
						},
						alarm_policy: {
							min: selected.constraints.min,
							max: selected.constraints.max,
							unit: selected.constraints.unit,
						},
						source_files: selected.files.map((file) =>
							path.posix.join("hmi", file),
						),
						contract_endpoints: [
							"hmi.schema.get",
							"hmi.values.get",
							"hmi.write",
						],
						binding_catalog: {
							available: catalogAvailable,
							error: catalogError,
							match: bindingCatalogEntry
								? {
										id: bindingCatalogEntry.id,
										path: bindingCatalogEntry.path,
										dataType: bindingCatalogEntry.dataType,
										qualifier: bindingCatalogEntry.qualifier,
										writable: bindingCatalogEntry.writable,
									}
								: null,
						},
					},
				},
				null,
				2,
			),
		);
	}
}

export class STHmiInitTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<HmiInitParams>,
		token: vscode.CancellationToken,
	): Promise<unknown> {
		if (token.isCancellationRequested) {
			return textResult("Cancelled.");
		}
		const rawStyle =
			typeof options.input.style === "string" ? options.input.style.trim() : "";
		const args = rawStyle.length > 0 ? [{ style: rawStyle.toLowerCase() }] : [];
		const result = await this.request(
			"workspace/executeCommand",
			{ command: "trust-lsp.hmiInit", arguments: args },
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
					: "trust-lsp.hmiInit failed.";
			return errorResult(message);
		}
		return textResult(
			JSON.stringify(
				{
					command: "trust-lsp.hmiInit",
					result: result.response,
				},
				null,
				2,
			),
		);
	}
}
