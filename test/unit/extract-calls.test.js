/**
 * Unit tests for extractCalls() function.
 * Tests whitelist of IEC functions and user-defined POU call extraction.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractCalls } from "../../src/st/indexer.ts";

describe("extractCalls", () => {
	it("should extract user-defined POU calls", () => {
		const content = `
FUNCTION_BLOCK FB_Main
  FB_Helper();
  FB_Process(data);
END_FUNCTION_BLOCK
`;
		const knownPous = new Set(["FB_Helper", "FB_Process"]);
		const calls = extractCalls(content, knownPous);
		assert.strictEqual(calls.length, 2);
		assert.strictEqual(calls[0].calleeName, "FB_Helper");
		assert.strictEqual(calls[1].calleeName, "FB_Process");
	});

	it("should NOT extract IEC standard timer functions", () => {
		const content = `
FUNCTION_BLOCK FB_Main
  TON(IN := TRUE, PT := T#1s);
  TOF(IN := FALSE, PT := T#2s);
  TP(IN := TRUE, PT := T#3s);
END_FUNCTION_BLOCK
`;
		const knownPous = new Set(["TON", "TOF", "TP"]);
		const calls = extractCalls(content, knownPous);
		assert.strictEqual(calls.length, 0);
	});

	it("should NOT extract IEC math functions", () => {
		const content = `
FUNCTION_BLOCK FB_Main
  result := ABS(value);
  root := SQRT(value);
  logVal := LN(value);
END_FUNCTION_BLOCK
`;
		const knownPous = new Set(["ABS", "SQRT", "LN"]);
		const calls = extractCalls(content, knownPous);
		assert.strictEqual(calls.length, 0);
	});

	it("should NOT extract IEC conversion functions", () => {
		const content = `
FUNCTION_BLOCK FB_Main
  str := INT_TO_STRING(num);
  real := REAL_TO_LINT(val);
END_FUNCTION_BLOCK
`;
		const knownPous = new Set(["INT_TO_STRING", "REAL_TO_LINT"]);
		const calls = extractCalls(content, knownPous);
		assert.strictEqual(calls.length, 0);
	});

	it("should NOT extract SIZEOF and other system functions", () => {
		const content = `
FUNCTION_BLOCK FB_Main
  size := SIZEOF(myStruct);
  addr := ADR(myVar);
END_FUNCTION_BLOCK
`;
		const knownPous = new Set(["SIZEOF", "ADR"]);
		const calls = extractCalls(content, knownPous);
		assert.strictEqual(calls.length, 0);
	});

	it("should NOT extract calls from comment lines", () => {
		const content = `
FUNCTION_BLOCK FB_Main
  // FB_Helped();
  RealCall();
END_FUNCTION_BLOCK
`;
		const knownPous = new Set(["FB_Helped", "RealCall"]);
		const calls = extractCalls(content, knownPous);
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].calleeName, "RealCall");
	});

	it("should extract custom FB calls not in IEC whitelist", () => {
		const content = `
FUNCTION_BLOCK FB_Main
  CustomPID(input);
  FB_CustomProcess(data);
END_FUNCTION_BLOCK
`;
		const knownPous = new Set(["CustomPID", "FB_CustomProcess"]);
		const calls = extractCalls(content, knownPous);
		assert.strictEqual(calls.length, 2);
	});

	it("should NOT extract calls starting with underscore", () => {
		const content = `
FUNCTION_BLOCK FB_Main
  _internalCall();
  RealCall();
END_FUNCTION_BLOCK
`;
		const knownPous = new Set(["_internalCall", "RealCall"]);
		const calls = extractCalls(content, knownPous);
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].calleeName, "RealCall");
	});

	it("should return line numbers for calls", () => {
		const content = `FUNCTION_BLOCK FB_Main
  Call1();
  Call2();
END_FUNCTION_BLOCK`;
		const knownPous = new Set(["Call1", "Call2"]);
		const calls = extractCalls(content, knownPous);
		assert.strictEqual(calls.length, 2);
		assert.strictEqual(calls[0].line, 2);
		assert.strictEqual(calls[1].line, 3);
	});

	it("should handle empty content", () => {
		const calls = extractCalls("", new Set(["FB_Test"]));
		assert.strictEqual(calls.length, 0);
	});

	it("should handle content with no calls", () => {
		const content = `FUNCTION_BLOCK FB_Empty
  x := 1;
END_FUNCTION_BLOCK`;
		const calls = extractCalls(content, new Set());
		assert.strictEqual(calls.length, 0);
	});
});
