import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import type { LadderNode } from "../../ladder/ladderEngine.types";
import { parseLadderProgramText } from "../../visual/ladderToSt";

function fixturePath(name: string): string {
	const sourceFixture = path.resolve(
		__dirname,
		"..",
		"..",
		"..",
		"src",
		"test",
		"fixtures",
		"ladder",
		name,
	);
	if (fs.existsSync(sourceFixture)) {
		return sourceFixture;
	}
	return path.resolve(__dirname, "..", "fixtures", "ladder", name);
}

suite("Ladder schema v2 fixtures", () => {
	test("accepts schema v2 fixtures", () => {
		const valid = fs.readFileSync(
			fixturePath("schema-v2-valid.ladder.json"),
			"utf8",
		);

		const program = parseLadderProgramText(valid);
		assert.strictEqual(program.schemaVersion, 2);
		assert.strictEqual(program.networks.length, 1);
	});

	test("rejects legacy schema fixtures with actionable error", () => {
		const legacy = fs.readFileSync(
			fixturePath("schema-v1-legacy.ladder.json"),
			"utf8",
		);

		assert.throws(
			() => parseLadderProgramText(legacy),
			/Unsupported ladder schema/,
		);
	});

	test("rejects invalid enum symbols with actionable error", () => {
		const invalid = fs.readFileSync(
			fixturePath("schema-v2-invalid-symbols.ladder.json"),
			"utf8",
		);

		assert.throws(
			() => parseLadderProgramText(invalid),
			/coilType must be NORMAL, SET, RESET, or NEGATED/,
		);
	});

	test("requires declared symbols for all ladder example node references", () => {
		const repoRoot = path.resolve(__dirname, "../../../../..");
		const ladderExamples = path.join(repoRoot, "examples", "ladder");

		const isAddress = (value: string): boolean => value.trim().startsWith("%");
		const isLiteral = (value: string): boolean => {
			const token = value.trim();
			if (!token) {
				return true;
			}
			if (/^[-+]?\d+(\.\d+)?$/.test(token)) {
				return true;
			}
			const upper = token.toUpperCase();
			return upper === "TRUE" || upper === "FALSE";
		};
		const normalizeSymbol = (value: string): string => {
			const trimmed = value.trim();
			const upper = trimmed.toUpperCase();
			if (upper.startsWith("LOCAL::")) {
				return trimmed.slice(7).trim().toUpperCase();
			}
			if (upper.startsWith("GLOBAL::")) {
				return trimmed.slice(8).trim().toUpperCase();
			}
			if (upper.startsWith("L::")) {
				return trimmed.slice(3).trim().toUpperCase();
			}
			if (upper.startsWith("G::")) {
				return trimmed.slice(3).trim().toUpperCase();
			}
			if (upper.startsWith("LOCAL.")) {
				return trimmed.slice(6).trim().toUpperCase();
			}
			if (upper.startsWith("GLOBAL.")) {
				return trimmed.slice(7).trim().toUpperCase();
			}
			return trimmed.toUpperCase();
		};

		const referencesForNode = (node: LadderNode): string[] => {
			if (node.type === "contact" || node.type === "coil") {
				return [node.variable];
			}
			if (node.type === "timer") {
				return [node.input, node.qOutput, node.etOutput].filter(
					(value): value is string => typeof value === "string",
				);
			}
			if (node.type === "counter") {
				return [node.input, node.qOutput, node.cvOutput].filter(
					(value): value is string => typeof value === "string",
				);
			}
			if (node.type === "compare") {
				return [node.left, node.right];
			}
			if (node.type === "math") {
				return [node.left, node.right, node.output];
			}
			return [];
		};

		for (const file of fs.readdirSync(ladderExamples)) {
			if (!file.endsWith(".ladder.json")) {
				continue;
			}
			const sourcePath = path.join(ladderExamples, file);
			const sourceText = fs.readFileSync(sourcePath, "utf8");
			const program = parseLadderProgramText(sourceText);
			const declaredSymbols = new Set(
				program.variables
					.map((variable) => variable.name?.trim())
					.filter((name): name is string => Boolean(name))
					.map(normalizeSymbol),
			);

			for (const network of program.networks) {
				for (const node of network.nodes) {
					for (const reference of referencesForNode(node)) {
						const token = reference.trim();
						if (!token || isAddress(token) || isLiteral(token)) {
							continue;
						}
						const symbol = normalizeSymbol(token);
						assert.ok(
							declaredSymbols.has(symbol),
							`${file}: unresolved symbol '${reference}' in network '${network.id}' node '${node.id}'`,
						);
					}
				}
			}
		}
	});
});
