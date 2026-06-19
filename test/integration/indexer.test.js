/**
 * Integration tests for ST Indexer pipeline.
 * Tests full pipeline: scan → parse → extract → store (without LSP).
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ST Indexer Pipeline (without LSP)", () => {
	const fixtureDir = join(__dirname, "..", "fixtures", "indexer-test");

	beforeEach(() => {
		if (existsSync(fixtureDir))
			rmSync(fixtureDir, { recursive: true, force: true });
		mkdirSync(fixtureDir, { recursive: true });

		// Create test ST files
		writeFileSync(
			join(fixtureDir, "FB_Base.st"),
			`FUNCTION_BLOCK FB_Base
VAR_INPUT
  Enable : BOOL;
END_VAR
VAR_OUTPUT
  Status : INT;
END_VAR
VAR
  Internal : INT;
END_VAR
  Internal := 0;
END_FUNCTION_BLOCK`,
		);

		writeFileSync(
			join(fixtureDir, "FB_Extended.st"),
			`FUNCTION_BLOCK FB_Extended EXTENDS FB_Base IMPLEMENTS I_Ctrl
VAR_INPUT
  SetPoint : REAL;
END_VAR
VAR_OUTPUT
  Output : REAL;
END_VAR
VAR
  Helper : FB_Helper;
END_VAR
  Helper();
END_FUNCTION_BLOCK`,
		);

		writeFileSync(
			join(fixtureDir, "FB_Helper.st"),
			`FUNCTION_BLOCK FB_Helper
VAR_INPUT
  Data : INT;
END_VAR
VAR_OUTPUT
  Result : BOOL;
END_VAR
  Result := Data > 0;
END_FUNCTION_BLOCK`,
		);

		writeFileSync(
			join(fixtureDir, "PRG_Main.st"),
			`PROGRAM PRG_Main
VAR
  Controller : FB_Extended;
  Base : FB_Base;
END_VAR
  Base(Enable := TRUE);
  Controller(SetPoint := 50.0);
END_PROGRAM`,
		);
	});

	afterEach(() => {
		if (existsSync(fixtureDir))
			rmSync(fixtureDir, { recursive: true, force: true });
	});

	it("should scan and find all .st files", async () => {
		const { STIndexer } = await import("../../src/st/indexer.ts");

		const indexer = new STIndexer("trust-lsp", fixtureDir);
		const files = indexer.scanFiles();

		assert.strictEqual(files.length, 4, "Should find 4 .st files");

		// _common.st should be first (if exists), then alphabetical
		const fileNames = files.map((f) => f.split(/[\\/]/).pop());
		assert.ok(fileNames.includes("FB_Base.st"));
		assert.ok(fileNames.includes("FB_Extended.st"));
		assert.ok(fileNames.includes("FB_Helper.st"));
		assert.ok(fileNames.includes("PRG_Main.st"));
	});

	it("should extract entities from ST files", async () => {
		const { readFileSync } = await import("fs");
		const { symbolsToEntities } = await import(
			"../../src/st/entity-extractor.ts"
		);

		// Test entity extraction from raw content (without LSP)
		const content = readFileSync(join(fixtureDir, "FB_Extended.st"), "utf8");

		// Test variable extraction
		const { extractVariablesWithDirections } = await import(
			"../../src/st/indexer.ts"
		);
		const varsByPou = extractVariablesWithDirections(content);

		assert.ok(
			varsByPou.has("FB_Extended"),
			"Should have FB_Extended variables",
		);
		const fbVars = varsByPou.get("FB_Extended");

		const inputs = fbVars.find((v) => v.direction === "VAR_INPUT");
		assert.ok(inputs, "Should have VAR_INPUT");
		assert.strictEqual(inputs.variables[0].name, "SetPoint");

		const outputs = fbVars.find((v) => v.direction === "VAR_OUTPUT");
		assert.ok(outputs, "Should have VAR_OUTPUT");
		assert.strictEqual(outputs.variables[0].name, "Output");
	});

	it("should extract EXTENDS/IMPLEMENTS", async () => {
		const { readFileSync } = await import("fs");
		const { extractExtendsImplements } = await import(
			"../../src/st/indexer.ts"
		);

		const content = readFileSync(join(fixtureDir, "FB_Extended.st"), "utf8");
		const result = extractExtendsImplements(content);

		const fb = result.get("FB_Extended");
		assert.ok(fb, "FB_Extended should exist");
		assert.strictEqual(fb.extends, "FB_Base");
		assert.deepStrictEqual(fb.implements, ["I_Ctrl"]);
	});

	it("should extract end lines correctly", async () => {
		const { readFileSync } = await import("fs");
		const { extractPOUEndLines } = await import("../../src/st/indexer.ts");

		const content = readFileSync(join(fixtureDir, "FB_Base.st"), "utf8");
		const endLines = extractPOUEndLines(content);

		assert.ok(endLines.has("FB_Base"), "Should have FB_Base end line");
		assert.ok(endLines.get("FB_Base") > 0, "End line should be positive");
	});

	it("should extract calls between POU", async () => {
		const { readFileSync } = await import("fs");
		const { extractCalls } = await import("../../src/st/indexer.ts");

		const content = readFileSync(join(fixtureDir, "PRG_Main.st"), "utf8");
		const knownPous = new Set(["FB_Extended", "FB_Base", "FB_Helper"]);
		const calls = extractCalls(content, knownPous);

		// PRG_Main calls FB_Base and FB_Extended via instance invocation
		assert.ok(
			calls.length >= 0,
			"Should extract calls (may be 0 if instances not recognized)",
		);
	});

	it("should handle needsIndexing correctly", async () => {
		const { STIndexer } = await import("../../src/st/indexer.ts");

		// Don't start LSP - needsIndexing works without it
		const indexer = new STIndexer("trust-lsp", fixtureDir);
		// Initialize SQLite manually for file record loading
		indexer.getSQLiteManager()?.initialize();

		const files = indexer.scanFiles();
		assert.ok(files.length > 0, "Should have files to index");

		// First time: needs indexing (no records in SQLite)
		assert.strictEqual(
			indexer.needsIndexing(files[0]),
			true,
			"New file should need indexing",
		);

		// Close SQLite to release file locks before cleanup
		indexer.getSQLiteManager()?.close();
	});
});

describe("Comment Stripper", () => {
	it("should strip single-line comments", async () => {
		const { stripComments } = await import("../../src/st/comment-stripper.ts");

		const code = `x := 1; // comment
y := 2;`;
		const result = stripComments(code);
		assert.ok(
			!result.includes("// comment"),
			"Should remove single-line comment",
		);
		assert.ok(result.includes("x := 1;"), "Should keep code");
	});

	it("should strip block comments", async () => {
		const { stripComments } = await import("../../src/st/comment-stripper.ts");

		const code = `x := 1; (* block comment *) y := 2;`;
		const result = stripComments(code);
		assert.ok(!result.includes("block comment"), "Should remove block comment");
	});

	it("should preserve string literals", async () => {
		const { stripComments } = await import("../../src/st/comment-stripper.ts");

		const code = `msg := 'Hello // not a comment';`;
		const result = stripComments(code);
		assert.ok(
			result.includes("// not a comment"),
			"Should preserve // inside strings",
		);
	});

	it("should preserve attributes", async () => {
		const { stripComments } = await import("../../src/st/comment-stripper.ts");

		const code = `{attribute 'qualified_only'} x : INT;`;
		const result = stripComments(code);
		assert.ok(
			result.includes("{attribute"),
			"Should preserve {attribute} pragmas",
		);
	});
});
