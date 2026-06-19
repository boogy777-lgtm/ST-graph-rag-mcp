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

export class STHmiTraceCaptureTool {
	async invoke(
		options: InvocationOptions<HmiTraceCaptureParams>,
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
		let schemaPayload: HmiSchemaResult;
		try {
			const schemaRaw = await requestRuntimeControl(
				snapshot.rootPath,
				token,
				"hmi.schema.get",
				undefined,
			);
			const parsed = parseHmiSchemaPayload(schemaRaw);
			if (!parsed) {
				return errorResult(
					"runtime returned an invalid hmi.schema.get payload.",
				);
			}
			schemaPayload = parsed;
		} catch (error) {
			return errorResult(`Failed to capture trace schema: ${String(error)}`);
		}

		const dryRun = options.input.dry_run === true;
		const scenario = normalizeScenario(options.input.scenario);
		const sampleCount = coerceInt(options.input.samples, 4, 1, 50);
		const sampleIntervalMs = coerceInt(
			options.input.sample_interval_ms,
			200,
			10,
			5000,
		);
		const ids = normalizeTraceIds(options.input.ids, schemaPayload);
		if (ids.length === 0) {
			return errorResult("No widget IDs available for trace capture.");
		}

		const startedAt = new Date();
		const samples: Array<{
			index: number;
			timestamp_ms: number;
			connected: boolean;
			values: Record<string, unknown>;
			qualities: Record<string, string>;
			error?: string;
		}> = [];
		for (let index = 0; index < sampleCount; index += 1) {
			if (token.isCancellationRequested) {
				return textResult("Cancelled.");
			}
			try {
				const valuesRaw = await requestRuntimeControl(
					snapshot.rootPath,
					token,
					"hmi.values.get",
					{ ids },
				);
				const parsedValues = parseHmiValuesPayload(valuesRaw);
				if (!parsedValues) {
					throw new Error(
						"runtime returned an invalid hmi.values.get payload.",
					);
				}
				const valueSnapshot: Record<string, unknown> = {};
				const qualitySnapshot: Record<string, string> = {};
				for (const widgetId of ids) {
					const entry = parsedValues.values[widgetId];
					if (!entry) {
						continue;
					}
					valueSnapshot[widgetId] = entry.v;
					qualitySnapshot[widgetId] = entry.q;
				}
				samples.push({
					index: index + 1,
					timestamp_ms: parsedValues.timestamp_ms,
					connected: parsedValues.connected,
					values: valueSnapshot,
					qualities: qualitySnapshot,
				});
			} catch (error) {
				samples.push({
					index: index + 1,
					timestamp_ms: Date.now(),
					connected: false,
					values: {},
					qualities: {},
					error: String(error),
				});
			}

			if (index + 1 < sampleCount) {
				const slept = await sleepWithCancellation(sampleIntervalMs, token);
				if (!slept) {
					return textResult("Cancelled.");
				}
			}
		}

		const runId =
			normalizeEvidenceRunId(options.input.run_id) ?? evidenceRunId(startedAt);
		const traceDocument = {
			version: 1,
			generated_at: startedAt.toISOString(),
			scenario,
			ids,
			sample_interval_ms: sampleIntervalMs,
			samples,
		};

		let evidencePath: string | null = null;
		let tracePath: string | null = null;
		if (!dryRun) {
			const hmiRoot = vscode.Uri.file(snapshot.hmiPath);
			const runRoot = vscode.Uri.joinPath(hmiRoot, "_evidence", runId);
			await vscode.workspace.fs.createDirectory(runRoot);
			const fileName = `trace-${scenario}.json`;
			await writeUtf8File(
				vscode.Uri.joinPath(runRoot, fileName),
				`${stableJsonString(traceDocument)}\n`,
			);
			evidencePath = path.posix.join("hmi", "_evidence", runId);
			tracePath = path.posix.join(evidencePath, fileName);
		}

		return textResult(
			JSON.stringify(
				{
					ok: true,
					dry_run: dryRun,
					rootPath: snapshot.rootPath,
					scenario,
					run_id: runId,
					evidencePath,
					tracePath,
					counts: {
						requested_samples: sampleCount,
						captured_samples: samples.length,
						error_samples: samples.filter((sample) => !!sample.error).length,
					},
					ids,
					samples,
				},
				null,
				2,
			),
		);
	}
}

export class STHmiGenerateCandidatesTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<HmiGenerateCandidatesParams>,
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

		const intentContent = snapshot.files.find(
			(file) => file.name === "_intent.toml",
		)?.content;
		const candidateCount = coerceInt(
			options.input.candidate_count,
			3,
			1,
			HMI_CANDIDATE_STRATEGIES.length,
		);
		const candidates = generateHmiCandidates(
			refs,
			catalog,
			intentContent,
			candidateCount,
		);
		const generatedAt = new Date();
		const runId =
			normalizeEvidenceRunId(options.input.run_id) ??
			evidenceRunId(generatedAt);
		const dryRun = options.input.dry_run === true;
		const candidateDocument = {
			version: 1,
			generated_at: generatedAt.toISOString(),
			intent_priorities: intentContent
				? parseQuotedArrayFromToml(intentContent, "priorities")
				: [],
			candidates,
		};

		let evidencePath: string | null = null;
		let candidatesPath: string | null = null;
		if (!dryRun) {
			const hmiRoot = vscode.Uri.file(snapshot.hmiPath);
			const runRoot = vscode.Uri.joinPath(hmiRoot, "_evidence", runId);
			await vscode.workspace.fs.createDirectory(runRoot);
			await writeUtf8File(
				vscode.Uri.joinPath(runRoot, "candidates.json"),
				`${stableJsonString(candidateDocument)}\n`,
			);
			evidencePath = path.posix.join("hmi", "_evidence", runId);
			candidatesPath = path.posix.join(evidencePath, "candidates.json");
		}

		return textResult(
			JSON.stringify(
				{
					ok: true,
					dry_run: dryRun,
					rootPath: snapshot.rootPath,
					run_id: runId,
					evidencePath,
					candidatesPath,
					catalogAvailable,
					catalogError,
					candidates,
				},
				null,
				2,
			),
		);
	}
}

export class STHmiPreviewSnapshotTool extends LspToolBase {
	async invoke(
		options: InvocationOptions<HmiPreviewSnapshotParams>,
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

		const dryRun = options.input.dry_run === true;
		const requestedRunId = normalizeEvidenceRunId(options.input.run_id);
		let runId = requestedRunId;
		let candidates: HmiCandidate[] = [];
		if (requestedRunId) {
			const candidatesUri = vscode.Uri.joinPath(
				vscode.Uri.file(snapshot.hmiPath),
				"_evidence",
				requestedRunId,
				"candidates.json",
			);
			try {
				const bytes = await vscode.workspace.fs.readFile(candidatesUri);
				const payload = JSON.parse(Buffer.from(bytes).toString("utf8")) as {
					candidates?: unknown[];
				};
				if (Array.isArray(payload.candidates)) {
					candidates = payload.candidates
						.map((entry) => {
							const record = asRecord(entry);
							if (!record || typeof record.id !== "string") {
								return undefined;
							}
							const strategy = asRecord(record.strategy);
							const metrics = asRecord(record.metrics);
							const preview = asRecord(record.preview);
							if (
								!strategy ||
								!metrics ||
								!preview ||
								!Array.isArray(preview.sections)
							) {
								return undefined;
							}
							return {
								id: record.id,
								rank:
									typeof record.rank === "number" &&
									Number.isFinite(record.rank)
										? record.rank
										: 0,
								strategy: {
									id: typeof strategy.id === "string" ? strategy.id : "loaded",
									grouping:
										strategy.grouping === "qualifier" ||
										strategy.grouping === "path"
											? strategy.grouping
											: "program",
									density:
										strategy.density === "compact" ||
										strategy.density === "spacious"
											? strategy.density
											: "balanced",
									widget_bias:
										strategy.widget_bias === "status_first" ||
										strategy.widget_bias === "trend_first"
											? strategy.widget_bias
											: "balanced",
									alarm_emphasis: strategy.alarm_emphasis === true,
								},
								metrics: {
									readability:
										typeof metrics.readability === "number"
											? metrics.readability
											: 0,
									action_latency:
										typeof metrics.action_latency === "number"
											? metrics.action_latency
											: 0,
									alarm_salience:
										typeof metrics.alarm_salience === "number"
											? metrics.alarm_salience
											: 0,
									overall:
										typeof metrics.overall === "number" ? metrics.overall : 0,
								},
								summary: {
									bindings:
										typeof asRecord(record.summary)?.bindings === "number"
											? (asRecord(record.summary)?.bindings as number)
											: 0,
									sections:
										typeof asRecord(record.summary)?.sections === "number"
											? (asRecord(record.summary)?.sections as number)
											: 0,
								},
								preview: {
									title:
										typeof preview.title === "string"
											? preview.title
											: "Candidate",
									sections: preview.sections
										.map((section) => {
											const sectionRecord = asRecord(section);
											if (
												!sectionRecord ||
												typeof sectionRecord.title !== "string"
											) {
												return undefined;
											}
											const widgetIds = Array.isArray(sectionRecord.widget_ids)
												? sectionRecord.widget_ids.filter(
														(value): value is string =>
															typeof value === "string",
													)
												: [];
											return {
												title: sectionRecord.title,
												widget_ids: widgetIds.sort((left, right) =>
													left.localeCompare(right),
												),
											};
										})
										.filter(
											(
												section,
											): section is { title: string; widget_ids: string[] } =>
												!!section,
										),
								},
							} as HmiCandidate;
						})
						.filter((entry): entry is HmiCandidate => !!entry)
						.sort((left, right) => left.rank - right.rank);
				}
			} catch {
				candidates = [];
			}
		}

		if (candidates.length === 0) {
			const descriptorPages = layoutDescriptorPages(snapshot.files);
			const refs = extractLayoutBindingRefs(descriptorPages);
			let catalog = normalizeHmiBindingsCatalog({});
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
			if (!("error" in bindingsRequest)) {
				const payload =
					bindingsRequest.response &&
					typeof bindingsRequest.response === "object"
						? (bindingsRequest.response as Record<string, unknown>)
						: {};
				if (payload.ok !== false) {
					catalog = normalizeHmiBindingsCatalog(payload);
				}
			}
			const intentContent = snapshot.files.find(
				(file) => file.name === "_intent.toml",
			)?.content;
			candidates = generateHmiCandidates(refs, catalog, intentContent, 3);
		}

		if (candidates.length === 0) {
			return errorResult(
				"No candidate layouts are available for snapshot rendering.",
			);
		}
		const selectedCandidate =
			(options.input.candidate_id
				? candidates.find(
						(candidate) => candidate.id === options.input.candidate_id,
					)
				: undefined) ?? candidates[0];
		const viewports = normalizeSnapshotViewports(options.input.viewports);
		const generatedAt = new Date();
		runId = runId ?? evidenceRunId(generatedAt);

		const snapshots = viewports.map((viewport) => {
			const svg = renderSnapshotSvg(viewport, selectedCandidate);
			return {
				viewport,
				fileName: `${viewport}-overview.svg`,
				content: svg,
				hash: hashContent(svg),
				bytes: Buffer.byteLength(svg, "utf8"),
			};
		});

		let evidencePath: string | null = null;
		const files: Array<{
			viewport: SnapshotViewport;
			path: string;
			hash: string;
			bytes: number;
		}> = [];
		if (!dryRun) {
			const hmiRoot = vscode.Uri.file(snapshot.hmiPath);
			const screenshotRoot = vscode.Uri.joinPath(
				hmiRoot,
				"_evidence",
				runId,
				"screenshots",
			);
			await vscode.workspace.fs.createDirectory(screenshotRoot);
			for (const snapshotEntry of snapshots) {
				await writeUtf8File(
					vscode.Uri.joinPath(screenshotRoot, snapshotEntry.fileName),
					snapshotEntry.content,
				);
				files.push({
					viewport: snapshotEntry.viewport,
					path: path.posix.join(
						"hmi",
						"_evidence",
						runId,
						"screenshots",
						snapshotEntry.fileName,
					),
					hash: snapshotEntry.hash,
					bytes: snapshotEntry.bytes,
				});
			}
			evidencePath = path.posix.join("hmi", "_evidence", runId);
		} else {
			for (const snapshotEntry of snapshots) {
				files.push({
					viewport: snapshotEntry.viewport,
					path: path.posix.join(
						"hmi",
						"_evidence",
						runId,
						"screenshots",
						snapshotEntry.fileName,
					),
					hash: snapshotEntry.hash,
					bytes: snapshotEntry.bytes,
				});
			}
		}

		return textResult(
			JSON.stringify(
				{
					ok: true,
					dry_run: dryRun,
					rootPath: snapshot.rootPath,
					run_id: runId,
					evidencePath,
					candidate_id: selectedCandidate.id,
					files,
				},
				null,
				2,
			),
		);
	}
}
