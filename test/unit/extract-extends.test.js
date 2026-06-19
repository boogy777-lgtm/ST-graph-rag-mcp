/**
 * Unit tests for extractExtendsImplements() function.
 * Tests extraction of EXTENDS and IMPLEMENTS clauses from FB declarations.
 * Includes multiline declaration support.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractExtendsImplements } from "../../src/st/indexer.ts";

describe("extractExtendsImplements", () => {
	it("should extract EXTENDS from single-line declaration", () => {
		const content = `FUNCTION_BLOCK FB_Advanced EXTENDS FB_Base
END_FUNCTION_BLOCK`;
		const result = extractExtendsImplements(content);
		const fb = result.get("FB_Advanced");
		assert.ok(fb, "FB_Advanced should exist");
		assert.strictEqual(fb.extends, "FB_Base");
	});

	it("should extract IMPLEMENTS from single-line declaration", () => {
		const content = `FUNCTION_BLOCK FB_Ctrl IMPLEMENTS I_Controller
END_FUNCTION_BLOCK`;
		const result = extractExtendsImplements(content);
		const fb = result.get("FB_Ctrl");
		assert.ok(fb, "FB_Ctrl should exist");
		assert.deepStrictEqual(fb.implements, ["I_Controller"]);
	});

	it("should extract both EXTENDS and IMPLEMENTS", () => {
		const content = `FUNCTION_BLOCK FB_Advanced EXTENDS FB_Base IMPLEMENTS I_Ctrl
END_FUNCTION_BLOCK`;
		const result = extractExtendsImplements(content);
		const fb = result.get("FB_Advanced");
		assert.ok(fb, "FB_Advanced should exist");
		assert.strictEqual(fb.extends, "FB_Base");
		assert.deepStrictEqual(fb.implements, ["I_Ctrl"]);
	});

	it("should extract IMPLEMENTS with multiple interfaces", () => {
		const content = `FUNCTION_BLOCK FB_Ctrl IMPLEMENTS I1, I2, I3
END_FUNCTION_BLOCK`;
		const result = extractExtendsImplements(content);
		const fb = result.get("FB_Ctrl");
		assert.deepStrictEqual(fb.implements, ["I1", "I2", "I3"]);
	});

	it("should handle multiline EXTENDS/IMPLEMENTS", () => {
		const content = `FUNCTION_BLOCK FB_Multi
  EXTENDS
    FB_Base
  IMPLEMENTS
    I_Controller,
    I_Monitor
END_FUNCTION_BLOCK`;
		const result = extractExtendsImplements(content);
		const fb = result.get("FB_Multi");
		assert.ok(fb, "FB_Multi should exist");
		assert.strictEqual(fb.extends, "FB_Base");
		assert.deepStrictEqual(fb.implements, ["I_Controller", "I_Monitor"]);
	});

	it("should handle multiline with newlines between keywords", () => {
		const content = `FUNCTION_BLOCK FB_Test
  EXTENDS FB_Base
  IMPLEMENTS I_Ctrl
END_FUNCTION_BLOCK`;
		const result = extractExtendsImplements(content);
		const fb = result.get("FB_Test");
		assert.ok(fb);
		assert.strictEqual(fb.extends, "FB_Base");
		assert.deepStrictEqual(fb.implements, ["I_Ctrl"]);
	});

	it("should return empty map for POU without EXTENDS/IMPLEMENTS", () => {
		const content = `FUNCTION_BLOCK FB_Simple
VAR_INPUT
  x : BOOL;
END_VAR
END_FUNCTION_BLOCK`;
		const result = extractExtendsImplements(content);
		assert.strictEqual(result.size, 0);
	});

	it("should handle empty content", () => {
		const result = extractExtendsImplements("");
		assert.strictEqual(result.size, 0);
	});

	it("should NOT extract EXTENDS from comments", () => {
		const content = `// FUNCTION_BLOCK FB_Fake EXTENDS FB_Base
FUNCTION_BLOCK FB_Real
END_FUNCTION_BLOCK`;
		const result = extractExtendsImplements(content);
		assert.strictEqual(result.size, 0);
	});

	it("should handle PROGRAM with EXTENDS", () => {
		const content = `PROGRAM PRG_Extended EXTENDS PRG_Base
END_PROGRAM`;
		const result = extractExtendsImplements(content);
		const prg = result.get("PRG_Extended");
		assert.ok(prg);
		assert.strictEqual(prg.extends, "PRG_Base");
	});
});
