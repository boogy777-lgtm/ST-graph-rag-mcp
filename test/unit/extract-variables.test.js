/**
 * Unit tests for extractVariablesWithDirections() function.
 * Tests extraction of VAR_INPUT, VAR_OUTPUT, VAR_TEMP, VAR, VAR_GLOBAL, etc.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractVariablesWithDirections } from "../../src/st/indexer.ts";

describe("extractVariablesWithDirections", () => {
	it("should extract VAR_INPUT variables", () => {
		const content = `
FUNCTION_BLOCK FB_Test
VAR_INPUT
  Enable : BOOL;
  Value : REAL;
END_VAR
END_FUNCTION_BLOCK
`;
		const result = extractVariablesWithDirections(content);
		const fbVars = result.get("FB_Test");
		assert.ok(fbVars, "FB_Test should exist");
		const inputs = fbVars.find((v) => v.direction === "VAR_INPUT");
		assert.ok(inputs, "VAR_INPUT group should exist");
		assert.strictEqual(inputs.variables.length, 2);
		assert.strictEqual(inputs.variables[0].name, "Enable");
		assert.strictEqual(inputs.variables[0].varType, "BOOL");
		assert.strictEqual(inputs.variables[1].name, "Value");
		assert.strictEqual(inputs.variables[1].varType, "REAL");
	});

	it("should extract VAR_OUTPUT variables", () => {
		const content = `
FUNCTION_BLOCK FB_Test
VAR_OUTPUT
  Result : BOOL;
  Output : REAL;
END_VAR
END_FUNCTION_BLOCK
`;
		const result = extractVariablesWithDirections(content);
		const fbVars = result.get("FB_Test");
		const outputs = fbVars.find((v) => v.direction === "VAR_OUTPUT");
		assert.ok(outputs, "VAR_OUTPUT group should exist");
		assert.strictEqual(outputs.variables.length, 2);
	});

	it("should extract multiple variable groups", () => {
		const content = `
FUNCTION_BLOCK FB_Test
VAR_INPUT
  In1 : BOOL;
END_VAR
VAR_OUTPUT
  Out1 : BOOL;
END_VAR
VAR_TEMP
  Temp1 : INT;
END_VAR
END_FUNCTION_BLOCK
`;
		const result = extractVariablesWithDirections(content);
		const fbVars = result.get("FB_Test");
		assert.strictEqual(fbVars.length, 3);
		assert.ok(fbVars.find((v) => v.direction === "VAR_INPUT"));
		assert.ok(fbVars.find((v) => v.direction === "VAR_OUTPUT"));
		assert.ok(fbVars.find((v) => v.direction === "VAR_TEMP"));
	});

	it("should extract VAR_IN_OUT variables", () => {
		const content = `
FUNCTION_BLOCK FB_Test
VAR_IN_OUT
  Data : ARRAY[1..10] OF INT;
END_VAR
END_FUNCTION_BLOCK
`;
		const result = extractVariablesWithDirections(content);
		const fbVars = result.get("FB_Test");
		const inOut = fbVars.find((v) => v.direction === "VAR_IN_OUT");
		assert.ok(inOut, "VAR_IN_OUT group should exist");
		assert.strictEqual(inOut.variables[0].name, "Data");
	});

	it("should extract VAR_GLOBAL variables", () => {
		const content = `
PROGRAM PRG_Test
VAR_GLOBAL
  gMode : INT;
  gStatus : BOOL;
END_VAR
END_PROGRAM
`;
		const result = extractVariablesWithDirections(content);
		const prgVars = result.get("PRG_Test");
		const globals = prgVars.find((v) => v.direction === "VAR_GLOBAL");
		assert.ok(globals, "VAR_GLOBAL group should exist");
		assert.strictEqual(globals.variables.length, 2);
	});

	it("should extract VAR (internal) variables", () => {
		const content = `
FUNCTION_BLOCK FB_Test
VAR
  Internal : INT;
  Counter : DINT;
END_VAR
END_FUNCTION_BLOCK
`;
		const result = extractVariablesWithDirections(content);
		const fbVars = result.get("FB_Test");
		const internals = fbVars.find((v) => v.direction === "VAR");
		assert.ok(internals, "VAR group should exist");
		assert.strictEqual(internals.variables.length, 2);
	});

	it("should handle multiple variables on one line", () => {
		const content = `
FUNCTION_BLOCK FB_Test
VAR_INPUT
  a, b, c : BOOL;
END_VAR
END_FUNCTION_BLOCK
`;
		const result = extractVariablesWithDirections(content);
		const fbVars = result.get("FB_Test");
		const inputs = fbVars.find((v) => v.direction === "VAR_INPUT");
		assert.strictEqual(inputs.variables.length, 3);
		assert.strictEqual(inputs.variables[0].name, "a");
		assert.strictEqual(inputs.variables[1].name, "b");
		assert.strictEqual(inputs.variables[2].name, "c");
	});

	it("should handle empty content", () => {
		const result = extractVariablesWithDirections("");
		assert.strictEqual(result.size, 0);
	});

	it("should handle POU without variables", () => {
		const content = `
FUNCTION_BLOCK FB_Empty
  x := 1;
END_FUNCTION_BLOCK
`;
		const result = extractVariablesWithDirections(content);
		const fbVars = result.get("FB_Empty");
		assert.ok(fbVars);
		assert.strictEqual(fbVars.length, 0);
	});

	it("should extract variables from FUNCTION", () => {
		const content = `
FUNCTION FC_Test : BOOL
VAR_INPUT
  Input : INT;
END_VAR
VAR_OUTPUT
  Output : BOOL;
END_VAR
END_FUNCTION
`;
		const result = extractVariablesWithDirections(content);
		const fcVars = result.get("FC_Test");
		assert.ok(fcVars, "FC_Test should exist");
		assert.strictEqual(fcVars.length, 2);
	});
});
