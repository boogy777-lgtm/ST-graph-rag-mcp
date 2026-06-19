/**
 * Unit тесты для Visitor Pattern
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { EndLineVisitor } from "../../../src/core/visitor/EndLineVisitor";
import { ExtendsVisitor } from "../../../src/core/visitor/ExtendsVisitor";
import { SourceCodeAnalyzer } from "../../../src/core/visitor/SourceCodeAnalyzer";
import { VariableVisitor } from "../../../src/core/visitor/VariableVisitor";

describe("Visitor Pattern", () => {
	let analyzer: SourceCodeAnalyzer;

	beforeEach(() => {
		analyzer = new SourceCodeAnalyzer();
	});

	describe("VariableVisitor", () => {
		it("should extract variables with directions", () => {
			const code = `
FUNCTION_BLOCK MyFB
VAR_INPUT
  Input1 : BOOL;
  Input2 : INT;
END_VAR
VAR_OUTPUT
  Output1 : REAL;
END_VAR
VAR
  LocalVar : STRING;
END_VAR
END_FUNCTION_BLOCK
`.trim();

			const visitor = new VariableVisitor();
			const result = analyzer.analyze(code, visitor);

			assert.ok(result.has("MyFB"));
			const groups = result.get("MyFB")!;
			assert.strictEqual(groups.length, 3);

			const inputGroup = groups.find((g) => g.direction === "VAR_INPUT");
			assert.ok(inputGroup);
			assert.strictEqual(inputGroup.variables.length, 2);
			assert.strictEqual(inputGroup.variables[0].name, "Input1");
			assert.strictEqual(inputGroup.variables[0].varType, "BOOL");

			const outputGroup = groups.find((g) => g.direction === "VAR_OUTPUT");
			assert.ok(outputGroup);
			assert.strictEqual(outputGroup.variables.length, 1);
			assert.strictEqual(outputGroup.variables[0].name, "Output1");
		});

		it("should handle multiple POU", () => {
			const code = `
PROGRAM PRG1
VAR
  x : BOOL;
END_VAR
END_PROGRAM

FUNCTION Func1 : BOOL
VAR_INPUT
  Param : INT;
END_VAR
END_FUNCTION
`.trim();

			const visitor = new VariableVisitor();
			const result = analyzer.analyze(code, visitor);

			assert.strictEqual(result.size, 2);
			assert.ok(result.has("PRG1"));
			assert.ok(result.has("Func1"));
		});
	});

	describe("ExtendsVisitor", () => {
		it("should extract EXTENDS", () => {
			const code = `
FUNCTION_BLOCK Child EXTENDS Parent
VAR_INPUT
  x : BOOL;
END_VAR
END_FUNCTION_BLOCK
`.trim();

			const visitor = new ExtendsVisitor();
			const result = analyzer.analyze(code, visitor);

			assert.ok(result.has("Child"));
			const info = result.get("Child")!;
			assert.strictEqual(info.extends, "Parent");
		});

		it("should extract IMPLEMENTS", () => {
			const code = `
FUNCTION_BLOCK MyFB IMPLEMENTS IInterface1, IInterface2
VAR
  x : BOOL;
END_VAR
END_FUNCTION_BLOCK
`.trim();

			const visitor = new ExtendsVisitor();
			const result = analyzer.analyze(code, visitor);

			const info = result.get("MyFB")!;
			assert.deepStrictEqual(info.implements, ["IInterface1", "IInterface2"]);
		});
	});

	describe("EndLineVisitor", () => {
		it("should extract end lines for POU", () => {
			const code = `FUNCTION_BLOCK FB1
VAR_INPUT
  x : BOOL;
END_VAR
END_FUNCTION_BLOCK`;

			const visitor = new EndLineVisitor();
			const result = analyzer.analyze(code, visitor);

			assert.strictEqual(result.get("FB1"), 5);
		});

		it("should handle multiple POU end lines", () => {
			const code = `PROGRAM PRG1
VAR
  a : BOOL;
END_VAR
END_PROGRAM

FUNCTION FC1 : BOOL
END_FUNCTION`;

			const visitor = new EndLineVisitor();
			const result = analyzer.analyze(code, visitor);

			assert.strictEqual(result.get("PRG1"), 5);
			assert.strictEqual(result.get("FC1"), 8);
		});
	});
});
