import * as assert from "assert";
import * as vscode from "vscode";
import { LadderEditorProvider } from "../../ladder/ladderEditor";
import type { LadderProgram } from "../../ladder/ladderEngine.types";
import { boolToDisplay } from "../../visual/runtime/runtimePanelBridge";

function createContext(): vscode.ExtensionContext {
	return {
		subscriptions: [],
		extensionPath: "/tmp",
	} as unknown as vscode.ExtensionContext;
}

function createDocument(path: string): vscode.TextDocument {
	return {
		uri: vscode.Uri.file(path),
		getText: () => "",
		lineCount: 1,
	} as unknown as vscode.TextDocument;
}

function createProgram(): LadderProgram {
	return {
		schemaVersion: 2,
		metadata: {
			name: "simple-start-stop",
			description: "runtime I/O mapping test",
		},
		variables: [
			{
				name: "StartPB",
				type: "BOOL",
				scope: "global",
				address: "%IX0.0",
				initialValue: false,
			},
			{
				name: "dfg",
				type: "BOOL",
				scope: "local",
				initialValue: false,
			},
			{
				name: "MotorRun",
				type: "BOOL",
				scope: "global",
				address: "%QX0.0",
				initialValue: false,
			},
		],
		networks: [
			{
				id: "rung_1",
				order: 0,
				layout: { y: 100 },
				nodes: [
					{
						id: "contact_start",
						type: "contact",
						contactType: "NO",
						variable: "StartPB",
						position: { x: 100, y: 100 },
					},
					{
						id: "contact_local",
						type: "contact",
						contactType: "NO",
						variable: "dfg",
						position: { x: 180, y: 100 },
					},
					{
						id: "coil_1",
						type: "coil",
						coilType: "NORMAL",
						variable: "MotorRun",
						position: { x: 320, y: 100 },
					},
				],
				edges: [],
			},
		],
	};
}

suite("Ladder runtime I/O panel mapping", () => {
	test("maps local symbols to FB-qualified write targets", () => {
		const provider = new LadderEditorProvider(createContext());
		const docId = "doc-local-mapping";
		const document = createDocument("/tmp/simple-start-stop.ladder.json");
		const program = createProgram();

		(
			provider as unknown as { latestPrograms: Map<string, LadderProgram> }
		).latestPrograms.set(docId, program);

		const state = (
			provider as unknown as {
				buildRuntimePanelIoState: (
					docId: string,
					document?: vscode.TextDocument,
				) => {
					inputs: Array<{ address: string; writeTarget?: string }>;
					outputs: Array<{ address: string; writeTarget?: string }>;
					memory: Array<{ address: string; writeTarget?: string }>;
				};
			}
		).buildRuntimePanelIoState(docId, document);

		const localMemory = state.memory.find((entry) => entry.address === "dfg");
		assert.ok(localMemory, "expected local symbol row in memory bucket");
		assert.strictEqual(localMemory?.writeTarget, "fb_simple_start_stop.dfg");

		const input = state.inputs.find((entry) => entry.address === "%IX0.0");
		assert.ok(input, "expected mapped input row");
		assert.strictEqual(input?.writeTarget, "%IX0.0");

		const output = state.outputs.find((entry) => entry.address === "%QX0.0");
		assert.ok(output, "expected mapped output row");
		assert.strictEqual(output?.writeTarget, "%QX0.0");
	});

	test("updates existing symbolic row by write target without duplicates", () => {
		const provider = new LadderEditorProvider(createContext());
		const docId = "doc-write-target";
		const document = createDocument("/tmp/simple-start-stop.ladder.json");
		const program = createProgram();

		const typed = provider as unknown as {
			latestPrograms: Map<string, LadderProgram>;
			runtimeIoState: Map<
				string,
				{
					inputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
					}>;
					outputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
					}>;
					memory: Array<{
						address: string;
						writeTarget?: string;
						value: string;
					}>;
				}
			>;
			buildRuntimePanelIoState: (
				docId: string,
				document?: vscode.TextDocument,
			) => {
				inputs: Array<{ address: string; writeTarget?: string; value: string }>;
				outputs: Array<{
					address: string;
					writeTarget?: string;
					value: string;
				}>;
				memory: Array<{ address: string; writeTarget?: string; value: string }>;
			};
			upsertRuntimeIoEntry: (
				docId: string,
				document: vscode.TextDocument,
				targetRaw: string,
				value: string,
				forced?: boolean,
			) => void;
		};

		typed.latestPrograms.set(docId, program);
		const initial = typed.buildRuntimePanelIoState(docId, document);
		typed.runtimeIoState.set(docId, initial);

		const localEntry = initial.memory.find((entry) => entry.address === "dfg");
		assert.ok(localEntry?.writeTarget, "expected local write target");

		typed.upsertRuntimeIoEntry(
			docId,
			document,
			localEntry!.writeTarget!,
			boolToDisplay(true),
		);

		const updated = typed.runtimeIoState.get(docId)!;
		const rows = updated.memory.filter(
			(entry) => entry.writeTarget === localEntry!.writeTarget,
		);
		assert.strictEqual(rows.length, 1, "symbolic row should not duplicate");
		assert.strictEqual(rows[0].value, "BOOL(TRUE)");
	});

	test("keeps symbolic debug addresses case-preserved while canonicalizing direct I/O", () => {
		const provider = new LadderEditorProvider(createContext()) as unknown as {
			normalizeDebugIoEntry: (
				value: unknown,
			) => { address: string } | undefined;
		};

		const symbol = provider.normalizeDebugIoEntry({
			address: "dfg",
			value: true,
		});
		assert.strictEqual(symbol?.address, "dfg");

		const io = provider.normalizeDebugIoEntry({
			address: "%ix0.1",
			value: true,
		});
		assert.strictEqual(io?.address, "%IX0.1");
	});

	test("marks write operations pending until matching runtime I/O confirmation arrives", () => {
		const provider = new LadderEditorProvider(createContext());
		const docId = "doc-operation-status";
		const document = createDocument("/tmp/simple-start-stop.ladder.json");
		const program = createProgram();

		const typed = provider as unknown as {
			latestPrograms: Map<string, LadderProgram>;
			runtimeIoState: Map<
				string,
				{
					inputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						operationStatus?: "pending" | "error";
					}>;
					outputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						operationStatus?: "pending" | "error";
					}>;
					memory: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						operationStatus?: "pending" | "error";
					}>;
				}
			>;
			buildRuntimePanelIoState: (
				docId: string,
				document?: vscode.TextDocument,
			) => {
				inputs: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					operationStatus?: "pending" | "error";
				}>;
				outputs: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					operationStatus?: "pending" | "error";
				}>;
				memory: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					operationStatus?: "pending" | "error";
				}>;
			};
			setPendingRuntimeIoOperation: (docId: string, targetRaw: string) => void;
			clearConfirmedRuntimeIoOperations: (
				docId: string,
				update: {
					inputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
					}>;
					outputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
					}>;
					memory: Array<{
						address: string;
						writeTarget?: string;
						value: string;
					}>;
				},
			) => void;
			annotateRuntimeIoStateWithOperations: (
				docId: string,
				source: {
					inputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						operationStatus?: "pending" | "error";
					}>;
					outputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						operationStatus?: "pending" | "error";
					}>;
					memory: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						operationStatus?: "pending" | "error";
					}>;
				},
			) => {
				inputs: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					operationStatus?: "pending" | "error";
				}>;
				outputs: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					operationStatus?: "pending" | "error";
				}>;
				memory: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					operationStatus?: "pending" | "error";
				}>;
			};
			clearRuntimeIoOperations: (docId: string) => void;
		};

		typed.latestPrograms.set(docId, program);
		typed.runtimeIoState.set(
			docId,
			typed.buildRuntimePanelIoState(docId, document),
		);

		typed.setPendingRuntimeIoOperation(docId, "%IX0.0");
		const pendingState = typed.annotateRuntimeIoStateWithOperations(
			docId,
			typed.runtimeIoState.get(docId)!,
		);
		assert.strictEqual(
			pendingState.inputs.find((entry) => entry.address === "%IX0.0")
				?.operationStatus,
			"pending",
		);

		typed.clearConfirmedRuntimeIoOperations(docId, {
			inputs: [{ address: "%IX0.0", value: "BOOL(TRUE)" }],
			outputs: [],
			memory: [],
		});
		const confirmedState = typed.annotateRuntimeIoStateWithOperations(
			docId,
			typed.runtimeIoState.get(docId)!,
		);
		assert.strictEqual(
			confirmedState.inputs.find((entry) => entry.address === "%IX0.0")
				?.operationStatus,
			undefined,
		);

		typed.clearRuntimeIoOperations(docId);
	});

	test("confirms symbolic memory force immediately without stIoState roundtrip", () => {
		const provider = new LadderEditorProvider(createContext());
		const docId = "doc-symbolic-force";
		const document = createDocument("/tmp/simple-start-stop.ladder.json");
		const program = createProgram();

		const typed = provider as unknown as {
			latestPrograms: Map<string, LadderProgram>;
			runtimeIoState: Map<
				string,
				{
					inputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						forced?: boolean;
						operationStatus?: "pending" | "error";
					}>;
					outputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						forced?: boolean;
						operationStatus?: "pending" | "error";
					}>;
					memory: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						forced?: boolean;
						operationStatus?: "pending" | "error";
					}>;
				}
			>;
			buildRuntimePanelIoState: (
				docId: string,
				document?: vscode.TextDocument,
			) => {
				inputs: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					forced?: boolean;
					operationStatus?: "pending" | "error";
				}>;
				outputs: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					forced?: boolean;
					operationStatus?: "pending" | "error";
				}>;
				memory: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					forced?: boolean;
					operationStatus?: "pending" | "error";
				}>;
			};
			setPendingRuntimeIoOperation: (docId: string, targetRaw: string) => void;
			applyRuntimeIoOperationSuccess: (
				docId: string,
				document: vscode.TextDocument,
				targetRaw: string,
				operation: "write" | "force" | "release",
				boolValue?: boolean,
			) => void;
			annotateRuntimeIoStateWithOperations: (
				docId: string,
				source: {
					inputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						forced?: boolean;
						operationStatus?: "pending" | "error";
					}>;
					outputs: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						forced?: boolean;
						operationStatus?: "pending" | "error";
					}>;
					memory: Array<{
						address: string;
						writeTarget?: string;
						value: string;
						forced?: boolean;
						operationStatus?: "pending" | "error";
					}>;
				},
			) => {
				inputs: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					forced?: boolean;
					operationStatus?: "pending" | "error";
				}>;
				outputs: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					forced?: boolean;
					operationStatus?: "pending" | "error";
				}>;
				memory: Array<{
					address: string;
					writeTarget?: string;
					value: string;
					forced?: boolean;
					operationStatus?: "pending" | "error";
				}>;
			};
			clearRuntimeIoOperations: (docId: string) => void;
		};

		typed.latestPrograms.set(docId, program);
		typed.runtimeIoState.set(
			docId,
			typed.buildRuntimePanelIoState(docId, document),
		);

		const row = typed.runtimeIoState
			.get(docId)!
			.memory.find((entry) => entry.address === "dfg");
		assert.ok(row?.writeTarget, "expected symbolic local write target");

		typed.setPendingRuntimeIoOperation(docId, row!.writeTarget!);
		typed.applyRuntimeIoOperationSuccess(
			docId,
			document,
			row!.writeTarget!,
			"force",
			true,
		);

		const updated = typed.annotateRuntimeIoStateWithOperations(
			docId,
			typed.runtimeIoState.get(docId)!,
		);
		const localRow = updated.memory.find(
			(entry) => entry.writeTarget === row!.writeTarget,
		);
		assert.strictEqual(localRow?.operationStatus, undefined);
		assert.strictEqual(localRow?.value, "BOOL(TRUE)");
		assert.strictEqual(localRow?.forced, true);

		typed.applyRuntimeIoOperationSuccess(
			docId,
			document,
			row!.writeTarget!,
			"release",
		);
		const released = typed.runtimeIoState
			.get(docId)!
			.memory.find((entry) => entry.writeTarget === row!.writeTarget);
		assert.strictEqual(released?.forced, false);

		typed.clearRuntimeIoOperations(docId);
	});

	test("syncs in-memory ladder program to disk before runtime start", async () => {
		const provider = new LadderEditorProvider(createContext());
		const docId = "doc-runtime-sync";
		const program = createProgram();
		let saved = false;
		const document = {
			uri: vscode.Uri.file("/tmp/simple-start-stop.ladder.json"),
			getText: () => "",
			lineCount: 1,
			save: async () => {
				saved = true;
				return true;
			},
		} as unknown as vscode.TextDocument;

		const typed = provider as unknown as {
			latestPrograms: Map<string, LadderProgram>;
			syncLatestProgramForRuntime: (
				docId: string,
				document: vscode.TextDocument,
			) => Promise<void>;
			clearRuntimeIoOperations: (docId: string) => void;
		};
		typed.latestPrograms.set(docId, program);

		const originalApplyEdit = vscode.workspace.applyEdit;
		let applyEditCalls = 0;
		(
			vscode.workspace as unknown as {
				applyEdit: typeof vscode.workspace.applyEdit;
			}
		).applyEdit = async () => {
			applyEditCalls += 1;
			return true;
		};

		try {
			await typed.syncLatestProgramForRuntime(docId, document);
		} finally {
			(
				vscode.workspace as unknown as {
					applyEdit: typeof vscode.workspace.applyEdit;
				}
			).applyEdit = originalApplyEdit;
			typed.clearRuntimeIoOperations(docId);
		}

		assert.ok(
			applyEditCalls > 0,
			"expected runtime sync to write latest program",
		);
		assert.strictEqual(
			saved,
			true,
			"expected runtime sync to save updated document",
		);
	});
});
