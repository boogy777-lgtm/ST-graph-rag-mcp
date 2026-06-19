import * as assert from "assert";
import {
	BlocklyEngine,
	type BlocklyWorkspace,
} from "../../blockly/blocklyEngine";

suite("BlocklyEngine", () => {
	test("generates complete connected statement chains", () => {
		const workspace: BlocklyWorkspace = {
			blocks: {
				languageVersion: 0,
				blocks: [
					{
						id: "set-1",
						type: "variables_set",
						fields: {
							VAR: { id: "var-counter", name: "counter" },
						},
						inputs: {
							VALUE: {
								block: {
									id: "num-1",
									type: "math_number",
									fields: { NUM: 1 },
								},
							},
						},
						next: {
							block: {
								id: "set-2",
								type: "variables_set",
								fields: {
									VAR: { id: "var-counter", name: "counter" },
								},
								inputs: {
									VALUE: {
										block: {
											id: "num-2",
											type: "math_number",
											fields: { NUM: 2 },
										},
									},
								},
							},
						},
					},
				],
			},
			variables: [{ id: "var-counter", name: "counter", type: "INT" }],
			metadata: {
				name: "ChainProgram",
			},
		};

		const engine = new BlocklyEngine();
		const generated = engine.generateCode(workspace);

		assert.deepStrictEqual(generated.errors, []);
		assert.match(generated.structuredText, /counter := 1;/);
		assert.match(generated.structuredText, /counter := 2;/);
		assert.ok(
			generated.structuredText.indexOf("counter := 1;") <
				generated.structuredText.indexOf("counter := 2;"),
			"Expected first statement to be generated before the chained next statement",
		);
	});

	test("supports IF0/DO0 input slots from Blockly control blocks", () => {
		const workspace: BlocklyWorkspace = {
			blocks: {
				languageVersion: 0,
				blocks: [
					{
						id: "if-1",
						type: "controls_if",
						inputs: {
							IF0: {
								block: {
									id: "bool-1",
									type: "logic_boolean",
									fields: { BOOL: "TRUE" },
								},
							},
							DO0: {
								block: {
									id: "set-inside",
									type: "variables_set",
									fields: {
										VAR: { id: "var-lamp", name: "lamp" },
									},
									inputs: {
										VALUE: {
											block: {
												id: "bool-2",
												type: "logic_boolean",
												fields: { BOOL: "TRUE" },
											},
										},
									},
								},
							},
						},
					},
				],
			},
			variables: [{ id: "var-lamp", name: "lamp", type: "BOOL" }],
			metadata: { name: "IfProgram" },
		};

		const engine = new BlocklyEngine();
		const generated = engine.generateCode(workspace);

		assert.deepStrictEqual(generated.errors, []);
		assert.match(generated.structuredText, /IF TRUE THEN/);
		assert.match(generated.structuredText, /lamp := TRUE;/);
	});
});
