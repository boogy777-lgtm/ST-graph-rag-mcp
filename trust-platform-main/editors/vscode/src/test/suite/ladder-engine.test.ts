import * as assert from "assert";
import { LadderEngine } from "../../ladder/ladderEngine";
import type { LadderProgram, Network } from "../../ladder/ladderEngine.types";

function createProgram(
	networks: LadderProgram["networks"],
	variables: LadderProgram["variables"] = [],
): LadderProgram {
	return {
		schemaVersion: 2,
		metadata: {
			name: "LadderTest",
			description: "test",
		},
		variables,
		networks,
	};
}

async function scan(engine: LadderEngine): Promise<void> {
	await (engine as any).executeScanCycle();
}

function state(engine: LadderEngine): any {
	return engine.getExecutionState();
}

suite("LadderEngine", () => {
	test("validates deterministic series NO/NC contact semantics", async () => {
		const network: Network = {
			id: "series",
			order: 0,
			layout: { y: 100 },
			edges: [],
			nodes: [
				{
					id: "c_no",
					type: "contact",
					contactType: "NO",
					variable: "%IX0.0",
					position: { x: 200, y: 100 },
				},
				{
					id: "c_nc",
					type: "contact",
					contactType: "NC",
					variable: "%IX0.1",
					position: { x: 320, y: 100 },
				},
				{
					id: "coil",
					type: "coil",
					coilType: "NORMAL",
					variable: "%QX0.0",
					position: { x: 460, y: 100 },
				},
			],
		};

		const engine = new LadderEngine(createProgram([network]), "simulation", {
			scanCycleMs: 10,
		});

		engine.setInput("%IX0.0", true);
		engine.setInput("%IX0.1", false);
		await scan(engine);
		assert.strictEqual(engine.getOutput("%QX0.0"), true);

		engine.setInput("%IX0.1", true);
		await scan(engine);
		assert.strictEqual(engine.getOutput("%QX0.0"), false);
	});

	test("drives outputs correctly for parallel branch + NC rung", async () => {
		const program = createProgram(
			[
				{
					id: "rung_1",
					order: 0,
					layout: { y: 100 },
					nodes: [
						{ id: "split", type: "branchSplit", position: { x: 80, y: 100 } },
						{
							id: "start",
							type: "contact",
							contactType: "NO",
							variable: "StartPB",
							position: { x: 120, y: 100 },
						},
						{
							id: "local",
							type: "contact",
							contactType: "NO",
							variable: "dfg",
							position: { x: 120, y: 160 },
						},
						{ id: "merge", type: "branchMerge", position: { x: 240, y: 100 } },
						{
							id: "motor",
							type: "coil",
							coilType: "NORMAL",
							variable: "MotorRun",
							position: { x: 320, y: 100 },
						},
					],
					edges: [
						{ id: "e1", fromNodeId: "split", toNodeId: "start" },
						{ id: "e2", fromNodeId: "split", toNodeId: "local" },
						{ id: "e3", fromNodeId: "start", toNodeId: "merge" },
						{ id: "e4", fromNodeId: "local", toNodeId: "merge" },
						{ id: "e5", fromNodeId: "merge", toNodeId: "motor" },
					],
				},
				{
					id: "rung_2",
					order: 1,
					layout: { y: 200 },
					nodes: [
						{
							id: "stop",
							type: "contact",
							contactType: "NC",
							variable: "StopPB",
							position: { x: 120, y: 200 },
						},
						{
							id: "alarm",
							type: "coil",
							coilType: "NORMAL",
							variable: "AlarmLamp",
							position: { x: 320, y: 200 },
						},
					],
					edges: [],
				},
			],
			[
				{
					name: "StartPB",
					type: "BOOL",
					scope: "global",
					address: "%IX0.0",
				},
				{
					name: "StopPB",
					type: "BOOL",
					scope: "global",
					address: "%IX0.1",
				},
				{
					name: "MotorRun",
					type: "BOOL",
					scope: "global",
					address: "%QX0.0",
				},
				{
					name: "AlarmLamp",
					type: "BOOL",
					scope: "global",
					address: "%QX0.1",
				},
				{
					name: "dfg",
					type: "BOOL",
					scope: "local",
					initialValue: false,
				},
			],
		);

		const engine = new LadderEngine(program, "simulation", { scanCycleMs: 10 });

		engine.setInput("%IX0.0", false);
		engine.setInput("%IX0.1", false);
		engine.writeInput("dfg", false);
		await scan(engine);
		assert.strictEqual(engine.getOutput("%QX0.0"), false);
		assert.strictEqual(engine.getOutput("%QX0.1"), true);

		engine.setInput("%IX0.0", true);
		await scan(engine);
		assert.strictEqual(engine.getOutput("%QX0.0"), true);

		engine.setInput("%IX0.0", false);
		engine.writeInput("dfg", true);
		await scan(engine);
		assert.strictEqual(engine.getOutput("%QX0.0"), true);

		engine.setInput("%IX0.1", true);
		await scan(engine);
		assert.strictEqual(engine.getOutput("%QX0.1"), false);
	});

	test("supports parallel branch semantics via topology edges", async () => {
		const network: Network = {
			id: "parallel",
			order: 0,
			layout: { y: 100 },
			nodes: [
				{
					id: "split",
					type: "branchSplit",
					position: { x: 160, y: 100 },
				},
				{
					id: "branch_a",
					type: "contact",
					contactType: "NO",
					variable: "%IX0.0",
					position: { x: 260, y: 80 },
				},
				{
					id: "branch_b",
					type: "contact",
					contactType: "NO",
					variable: "%IX0.1",
					position: { x: 260, y: 120 },
				},
				{
					id: "merge",
					type: "branchMerge",
					position: { x: 380, y: 100 },
				},
				{
					id: "q0",
					type: "coil",
					coilType: "NORMAL",
					variable: "%QX0.0",
					position: { x: 500, y: 100 },
				},
			],
			edges: [
				{ id: "e1", fromNodeId: "split", toNodeId: "branch_a" },
				{ id: "e2", fromNodeId: "split", toNodeId: "branch_b" },
				{ id: "e3", fromNodeId: "branch_a", toNodeId: "merge" },
				{ id: "e4", fromNodeId: "branch_b", toNodeId: "merge" },
				{ id: "e5", fromNodeId: "merge", toNodeId: "q0" },
			],
		};

		const engine = new LadderEngine(createProgram([network]), "simulation", {
			scanCycleMs: 10,
		});

		engine.setInput("%IX0.0", true);
		engine.setInput("%IX0.1", false);
		await scan(engine);
		assert.strictEqual(engine.getOutput("%QX0.0"), true);

		engine.setInput("%IX0.0", false);
		engine.setInput("%IX0.1", false);
		await scan(engine);
		assert.strictEqual(engine.getOutput("%QX0.0"), false);

		engine.setInput("%IX0.1", true);
		await scan(engine);
		assert.strictEqual(engine.getOutput("%QX0.0"), true);
	});

	test("keeps buffered write commit semantics across networks", async () => {
		const program = createProgram([
			{
				id: "n1",
				order: 0,
				layout: { y: 100 },
				edges: [],
				nodes: [
					{
						id: "c1",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.0",
						position: { x: 200, y: 100 },
					},
					{
						id: "set_marker",
						type: "coil",
						coilType: "NORMAL",
						variable: "%MX1.0",
						position: { x: 360, y: 100 },
					},
				],
			},
			{
				id: "n2",
				order: 1,
				layout: { y: 200 },
				edges: [],
				nodes: [
					{
						id: "marker_contact",
						type: "contact",
						contactType: "NO",
						variable: "%MX1.0",
						position: { x: 200, y: 200 },
					},
					{
						id: "q0",
						type: "coil",
						coilType: "NORMAL",
						variable: "%QX0.0",
						position: { x: 360, y: 200 },
					},
				],
			},
		]);

		const engine = new LadderEngine(program, "simulation", { scanCycleMs: 10 });

		engine.setInput("%IX0.0", true);
		await scan(engine);

		assert.strictEqual(engine.getOutput("%QX0.0"), false);
		assert.strictEqual(state(engine).markers["%MX1.0"], true);

		await scan(engine);
		assert.strictEqual(engine.getOutput("%QX0.0"), true);
	});

	test("executes all coil modes (NORMAL/SET/RESET/NEGATED)", async () => {
		const program = createProgram([
			{
				id: "normal",
				order: 0,
				layout: { y: 100 },
				edges: [],
				nodes: [
					{
						id: "in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.0",
						position: { x: 100, y: 100 },
					},
					{
						id: "normal",
						type: "coil",
						coilType: "NORMAL",
						variable: "%QX0.0",
						position: { x: 260, y: 100 },
					},
				],
			},
			{
				id: "set",
				order: 1,
				layout: { y: 200 },
				edges: [],
				nodes: [
					{
						id: "set_in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.1",
						position: { x: 100, y: 200 },
					},
					{
						id: "set_coil",
						type: "coil",
						coilType: "SET",
						variable: "%MX0.0",
						position: { x: 260, y: 200 },
					},
				],
			},
			{
				id: "reset",
				order: 2,
				layout: { y: 300 },
				edges: [],
				nodes: [
					{
						id: "reset_in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.2",
						position: { x: 100, y: 300 },
					},
					{
						id: "reset_coil",
						type: "coil",
						coilType: "RESET",
						variable: "%MX0.0",
						position: { x: 260, y: 300 },
					},
				],
			},
			{
				id: "negated",
				order: 3,
				layout: { y: 400 },
				edges: [],
				nodes: [
					{
						id: "neg_in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.3",
						position: { x: 100, y: 400 },
					},
					{
						id: "neg_coil",
						type: "coil",
						coilType: "NEGATED",
						variable: "%QX0.1",
						position: { x: 260, y: 400 },
					},
				],
			},
		]);

		const engine = new LadderEngine(program, "simulation", { scanCycleMs: 10 });

		engine.setInput("%IX0.0", true);
		engine.setInput("%IX0.1", true);
		engine.setInput("%IX0.2", false);
		engine.setInput("%IX0.3", true);
		await scan(engine);

		let current = state(engine);
		assert.strictEqual(current.outputs["%QX0.0"], true);
		assert.strictEqual(current.markers["%MX0.0"], true);
		assert.strictEqual(current.outputs["%QX0.1"], false);

		engine.setInput("%IX0.1", false);
		engine.setInput("%IX0.2", true);
		engine.setInput("%IX0.3", false);
		await scan(engine);

		current = state(engine);
		assert.strictEqual(current.markers["%MX0.0"], false);
		assert.strictEqual(current.outputs["%QX0.1"], true);
	});

	test("rejects unsupported coil symbol types", () => {
		const invalidProgram = createProgram([
			{
				id: "invalid_coil",
				order: 0,
				layout: { y: 100 },
				edges: [],
				nodes: [
					{
						id: "c1",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.0",
						position: { x: 120, y: 100 },
					},
					{
						id: "q1",
						type: "coil",
						coilType: "LATCH" as any,
						variable: "%QX0.0",
						position: { x: 260, y: 100 },
					},
				],
			},
		]);

		assert.throws(
			() => new LadderEngine(invalidProgram, "simulation", { scanCycleMs: 10 }),
			/unsupported coilType/i,
		);
	});

	test("executes compare and math blocks for all configured operations", async () => {
		const program = createProgram([
			{
				id: "cmp_math",
				order: 0,
				layout: { y: 100 },
				edges: [],
				nodes: [
					{
						id: "cmp_gt",
						type: "compare",
						op: "GT",
						left: "5",
						right: "2",
						position: { x: 150, y: 100 },
					},
					{
						id: "cmp_lt",
						type: "compare",
						op: "LT",
						left: "1",
						right: "4",
						position: { x: 240, y: 100 },
					},
					{
						id: "cmp_eq",
						type: "compare",
						op: "EQ",
						left: "7",
						right: "7",
						position: { x: 330, y: 100 },
					},
					{
						id: "add",
						type: "math",
						op: "ADD",
						left: "7",
						right: "3",
						output: "%MW10",
						position: { x: 430, y: 100 },
					},
					{
						id: "sub",
						type: "math",
						op: "SUB",
						left: "9",
						right: "4",
						output: "%MW11",
						position: { x: 520, y: 100 },
					},
					{
						id: "mul",
						type: "math",
						op: "MUL",
						left: "3",
						right: "6",
						output: "%MW12",
						position: { x: 610, y: 100 },
					},
					{
						id: "div",
						type: "math",
						op: "DIV",
						left: "12",
						right: "4",
						output: "%MW13",
						position: { x: 700, y: 100 },
					},
					{
						id: "div0",
						type: "math",
						op: "DIV",
						left: "12",
						right: "0",
						output: "%MW14",
						position: { x: 790, y: 100 },
					},
				],
			},
		]);

		const engine = new LadderEngine(program, "simulation", { scanCycleMs: 10 });
		await scan(engine);

		const current = state(engine);
		assert.strictEqual(current.markers["%MX_LD_COMPARE_cmp_gt_Q"], true);
		assert.strictEqual(current.markers["%MX_LD_COMPARE_cmp_lt_Q"], true);
		assert.strictEqual(current.markers["%MX_LD_COMPARE_cmp_eq_Q"], true);
		assert.strictEqual(current.memoryWords["%MW10"], 10);
		assert.strictEqual(current.memoryWords["%MW11"], 5);
		assert.strictEqual(current.memoryWords["%MW12"], 18);
		assert.strictEqual(current.memoryWords["%MW13"], 3);
		assert.strictEqual(current.memoryWords["%MW14"], 0);
	});

	test("implements TON and TOF timer behaviors", async () => {
		const tonProgram = createProgram([
			{
				id: "ton",
				order: 0,
				layout: { y: 100 },
				edges: [],
				nodes: [
					{
						id: "in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.0",
						position: { x: 100, y: 100 },
					},
					{
						id: "ton",
						type: "timer",
						timerType: "TON",
						instance: "TON_A",
						presetMs: 20,
						qOutput: "%MX10.0",
						etOutput: "%MW10",
						position: { x: 260, y: 100 },
					},
				],
			},
		]);

		const tonEngine = new LadderEngine(tonProgram, "simulation", {
			scanCycleMs: 10,
		});

		tonEngine.setInput("%IX0.0", true);
		await scan(tonEngine);
		let tonState = state(tonEngine);
		assert.strictEqual(tonState.markers["%MX10.0"], false);
		assert.strictEqual(tonState.memoryWords["%MW10"], 10);

		await scan(tonEngine);
		tonState = state(tonEngine);
		assert.strictEqual(tonState.markers["%MX10.0"], true);
		assert.strictEqual(tonState.memoryWords["%MW10"], 20);

		tonEngine.setInput("%IX0.0", false);
		await scan(tonEngine);
		tonState = state(tonEngine);
		assert.strictEqual(tonState.markers["%MX10.0"], false);
		assert.strictEqual(tonState.memoryWords["%MW10"], 0);

		const tofProgram = createProgram([
			{
				id: "tof",
				order: 0,
				layout: { y: 100 },
				edges: [],
				nodes: [
					{
						id: "in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.1",
						position: { x: 100, y: 100 },
					},
					{
						id: "tof",
						type: "timer",
						timerType: "TOF",
						instance: "TOF_A",
						presetMs: 20,
						qOutput: "%MX11.0",
						etOutput: "%MW11",
						position: { x: 260, y: 100 },
					},
				],
			},
		]);

		const tofEngine = new LadderEngine(tofProgram, "simulation", {
			scanCycleMs: 10,
		});

		tofEngine.setInput("%IX0.1", true);
		await scan(tofEngine);
		let tofState = state(tofEngine);
		assert.strictEqual(tofState.markers["%MX11.0"], true);

		tofEngine.setInput("%IX0.1", false);
		await scan(tofEngine);
		tofState = state(tofEngine);
		assert.strictEqual(tofState.markers["%MX11.0"], true);

		await scan(tofEngine);
		tofState = state(tofEngine);
		assert.strictEqual(tofState.markers["%MX11.0"], false);
	});

	test("implements TP pulse timer and counter FB behavior", async () => {
		const tpCounterProgram = createProgram([
			{
				id: "tp",
				order: 0,
				layout: { y: 100 },
				edges: [],
				nodes: [
					{
						id: "tp_in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.0",
						position: { x: 100, y: 100 },
					},
					{
						id: "tp",
						type: "timer",
						timerType: "TP",
						instance: "TP_A",
						presetMs: 20,
						qOutput: "%MX12.0",
						etOutput: "%MW12",
						position: { x: 260, y: 100 },
					},
				],
			},
			{
				id: "ctu",
				order: 1,
				layout: { y: 200 },
				edges: [],
				nodes: [
					{
						id: "ctu_in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.1",
						position: { x: 100, y: 200 },
					},
					{
						id: "ctu",
						type: "counter",
						counterType: "CTU",
						instance: "CTU_A",
						preset: 2,
						qOutput: "%MX20.0",
						cvOutput: "%MW20",
						position: { x: 260, y: 200 },
					},
				],
			},
			{
				id: "ctd",
				order: 2,
				layout: { y: 300 },
				edges: [],
				nodes: [
					{
						id: "ctd_in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.2",
						position: { x: 100, y: 300 },
					},
					{
						id: "ctd",
						type: "counter",
						counterType: "CTD",
						instance: "CTD_A",
						preset: 0,
						qOutput: "%MX21.0",
						cvOutput: "%MW21",
						position: { x: 260, y: 300 },
					},
				],
			},
			{
				id: "ctud",
				order: 3,
				layout: { y: 400 },
				edges: [],
				nodes: [
					{
						id: "ctud_in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.3",
						position: { x: 100, y: 400 },
					},
					{
						id: "ctud",
						type: "counter",
						counterType: "CTUD",
						instance: "CTUD_A",
						preset: 1,
						qOutput: "%MX22.0",
						cvOutput: "%MW22",
						position: { x: 260, y: 400 },
					},
				],
			},
		]);

		const engine = new LadderEngine(tpCounterProgram, "simulation", {
			scanCycleMs: 10,
		});

		await scan(engine);
		let current = state(engine);
		assert.strictEqual(current.markers["%MX12.0"], false);

		engine.setInput("%IX0.0", true);
		await scan(engine);
		current = state(engine);
		assert.strictEqual(current.markers["%MX12.0"], true);

		await scan(engine);
		current = state(engine);
		assert.strictEqual(current.markers["%MX12.0"], true);

		await scan(engine);
		current = state(engine);
		assert.strictEqual(current.markers["%MX12.0"], false);

		engine.setInput("%IX0.1", true);
		engine.setInput("%IX0.2", true);
		engine.setInput("%IX0.3", true);
		await scan(engine);
		current = state(engine);
		assert.strictEqual(current.memoryWords["%MW20"], 1);
		assert.strictEqual(current.memoryWords["%MW21"], -1);
		assert.strictEqual(current.memoryWords["%MW22"], 1);

		// Keep high should not re-count.
		await scan(engine);
		current = state(engine);
		assert.strictEqual(current.memoryWords["%MW20"], 1);
		assert.strictEqual(current.memoryWords["%MW22"], 1);

		// Create new rising edge.
		engine.setInput("%IX0.1", false);
		await scan(engine);
		engine.setInput("%IX0.1", true);
		await scan(engine);
		current = state(engine);
		assert.strictEqual(current.memoryWords["%MW20"], 2);
		assert.strictEqual(current.markers["%MX20.0"], true);
		assert.strictEqual(current.markers["%MX22.0"], true);
	});

	test("resolves local/global symbols with local-first precedence", async () => {
		const program = createProgram(
			[
				{
					id: "shadowed_symbol",
					order: 0,
					layout: { y: 100 },
					edges: [],
					nodes: [
						{
							id: "c_run",
							type: "contact",
							contactType: "NO",
							variable: "Run",
							position: { x: 120, y: 100 },
						},
						{
							id: "out",
							type: "coil",
							coilType: "NORMAL",
							variable: "%QX0.0",
							position: { x: 280, y: 100 },
						},
					],
				},
			],
			[
				{
					name: "Run",
					scope: "global",
					type: "BOOL",
					initialValue: false,
				},
				{
					name: "Run",
					scope: "local",
					type: "BOOL",
					initialValue: true,
				},
			],
		);

		const engine = new LadderEngine(program, "simulation", { scanCycleMs: 10 });
		await scan(engine);

		const current = state(engine);
		assert.strictEqual(current.outputs["%QX0.0"], true);
		assert.strictEqual(current.variableBooleans["LOCAL::Run"], true);
		assert.strictEqual(current.variableBooleans["GLOBAL::Run"], false);
	});

	test("supports symbolic input force/write against declared variables", async () => {
		const program = createProgram(
			[
				{
					id: "symbolic_force",
					order: 0,
					layout: { y: 100 },
					edges: [],
					nodes: [
						{
							id: "c_start",
							type: "contact",
							contactType: "NO",
							variable: "StartPB",
							position: { x: 120, y: 100 },
						},
						{
							id: "coil_motor",
							type: "coil",
							coilType: "NORMAL",
							variable: "%QX0.0",
							position: { x: 280, y: 100 },
						},
					],
				},
			],
			[
				{
					name: "StartPB",
					scope: "global",
					type: "BOOL",
					address: "%IX0.0",
					initialValue: false,
				},
			],
		);

		const engine = new LadderEngine(program, "simulation", { scanCycleMs: 10 });

		engine.forceInput("StartPB", true);
		await scan(engine);
		let current = state(engine);
		assert.strictEqual(current.outputs["%QX0.0"], true);
		assert.strictEqual(current.forcedInputs["%IX0.0"], true);

		engine.releaseInput("StartPB");
		engine.writeInput("StartPB", false);
		await scan(engine);
		current = state(engine);
		assert.strictEqual(current.outputs["%QX0.0"], false);
		assert.strictEqual(current.forcedInputs["%IX0.0"], undefined);
	});

	test("supports numeric symbol operands and outputs for compare/math nodes", async () => {
		const program = createProgram(
			[
				{
					id: "symbolic_math",
					order: 0,
					layout: { y: 100 },
					edges: [],
					nodes: [
						{
							id: "cmp",
							type: "compare",
							op: "GT",
							left: "CounterA",
							right: "4",
							position: { x: 120, y: 100 },
						},
						{
							id: "math",
							type: "math",
							op: "ADD",
							left: "CounterA",
							right: "7",
							output: "Acc",
							position: { x: 280, y: 100 },
						},
					],
				},
			],
			[
				{
					name: "CounterA",
					scope: "global",
					type: "INT",
					address: "%MW10",
					initialValue: 5,
				},
				{
					name: "Acc",
					scope: "local",
					type: "INT",
					initialValue: 0,
				},
			],
		);

		const engine = new LadderEngine(program, "simulation", { scanCycleMs: 10 });
		await scan(engine);

		const current = state(engine);
		assert.strictEqual(current.markers["%MX_LD_COMPARE_cmp_Q"], true);
		assert.strictEqual(current.variableNumbers["Acc"], 12);
	});

	test("emits diagnostics for unresolved symbols and non-assignable coil targets", () => {
		const unresolved = createProgram([
			{
				id: "unresolved",
				order: 0,
				layout: { y: 100 },
				edges: [],
				nodes: [
					{
						id: "contact_missing",
						type: "contact",
						contactType: "NO",
						variable: "MissingVar",
						position: { x: 100, y: 100 },
					},
					{
						id: "coil_ok",
						type: "coil",
						coilType: "NORMAL",
						variable: "%QX0.0",
						position: { x: 220, y: 100 },
					},
				],
			},
		]);

		assert.throws(
			() => new LadderEngine(unresolved, "simulation", { scanCycleMs: 10 }),
			/unresolved variable/,
		);

		const nonAssignable = createProgram([
			{
				id: "bad_coil_target",
				order: 0,
				layout: { y: 100 },
				edges: [],
				nodes: [
					{
						id: "in",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.0",
						position: { x: 100, y: 100 },
					},
					{
						id: "coil_input",
						type: "coil",
						coilType: "NORMAL",
						variable: "%IX0.1",
						position: { x: 220, y: 100 },
					},
				],
			},
		]);

		assert.throws(
			() => new LadderEngine(nonAssignable, "simulation", { scanCycleMs: 10 }),
			/non-assignable target/,
		);
	});

	test("rejects invalid topology with actionable diagnostics", () => {
		const missingNodeProgram = createProgram([
			{
				id: "invalid_ref",
				order: 0,
				layout: { y: 100 },
				nodes: [
					{
						id: "c1",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.0",
						position: { x: 100, y: 100 },
					},
				],
				edges: [
					{
						id: "bad",
						fromNodeId: "c1",
						toNodeId: "missing",
					},
				],
			},
		]);

		assert.throws(
			() =>
				new LadderEngine(missingNodeProgram, "simulation", { scanCycleMs: 10 }),
			/unknown toNodeId 'missing'/,
		);

		const cyclicProgram = createProgram([
			{
				id: "cycle",
				order: 0,
				layout: { y: 100 },
				nodes: [
					{
						id: "a",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.0",
						position: { x: 100, y: 100 },
					},
					{
						id: "b",
						type: "coil",
						coilType: "NORMAL",
						variable: "%QX0.0",
						position: { x: 220, y: 100 },
					},
				],
				edges: [
					{ id: "e1", fromNodeId: "a", toNodeId: "b" },
					{ id: "e2", fromNodeId: "b", toNodeId: "a" },
				],
			},
		]);

		assert.throws(
			() => new LadderEngine(cyclicProgram, "simulation", { scanCycleMs: 10 }),
			/cycle or unreachable loop/,
		);
	});
});
