/**
 * Unit tests for extractPOUEndLines() function.
 * Tests extraction of END_FUNCTION_BLOCK, END_PROGRAM, etc.
 * Verifies that END_ in comments is NOT matched.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPOUEndLines } from "../../src/st/indexer.ts";

describe("extractPOUEndLines", () => {
	it("should extract end_line for FUNCTION_BLOCK", () => {
		const content = `FUNCTION_BLOCK FB_Test
  // code
END_FUNCTION_BLOCK`;
		const endLines = extractPOUEndLines(content);
		// stripComments replaces // comment with \n, adding an extra line
		assert.strictEqual(endLines.get("FB_Test"), 4);
	});

	it("should extract end_line for PROGRAM", () => {
		const content = `PROGRAM PRG_Main
  // code
END_PROGRAM`;
		const endLines = extractPOUEndLines(content);
		assert.strictEqual(endLines.get("PRG_Main"), 4);
	});

	it("should extract end_line for FUNCTION", () => {
		const content = `FUNCTION FC_Test : BOOL
  // code
END_FUNCTION`;
		const endLines = extractPOUEndLines(content);
		assert.strictEqual(endLines.get("FC_Test"), 4);
	});

	it("should NOT match END_ in single-line comments", () => {
		const content = `FUNCTION_BLOCK FB_Test
  // END_FUNCTION_BLOCK - это комментарий
  RealCode();
END_FUNCTION_BLOCK`;
		const endLines = extractPOUEndLines(content);
		// stripComments adds extra line for each // comment
		assert.strictEqual(endLines.get("FB_Test"), 5);
	});

	it("should NOT match END_ in block comments (*)", () => {
		const content = `FUNCTION_BLOCK FB_Test
  (* END_FUNCTION_BLOCK - block комментарий *)
  RealCode();
END_FUNCTION_BLOCK`;
		const endLines = extractPOUEndLines(content);
		assert.strictEqual(endLines.get("FB_Test"), 4);
	});

	it("should NOT match END_ in /* */ comments", () => {
		const content = `FUNCTION_BLOCK FB_Test
  /* END_FUNCTION_BLOCK - C-style комментарий */
  RealCode();
END_FUNCTION_BLOCK`;
		const endLines = extractPOUEndLines(content);
		assert.strictEqual(endLines.get("FB_Test"), 4);
	});

	it("should handle multiple POU in one file", () => {
		const content = `FUNCTION_BLOCK FB_First
END_FUNCTION_BLOCK

FUNCTION_BLOCK FB_Second
END_FUNCTION_BLOCK`;
		const endLines = extractPOUEndLines(content);
		assert.strictEqual(endLines.get("FB_First"), 2);
		assert.strictEqual(endLines.get("FB_Second"), 5);
	});

	it("should handle empty content", () => {
		const endLines = extractPOUEndLines("");
		assert.strictEqual(endLines.size, 0);
	});

	it("should handle POU without END_ (malformed)", () => {
		const content = `FUNCTION_BLOCK FB_NoEnd
  x := 1;`;
		const endLines = extractPOUEndLines(content);
		assert.strictEqual(endLines.has("FB_NoEnd"), false);
	});
});
