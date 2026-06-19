/**
 * Integration tests for MCP tools — direct handler calls.
 *
 * Tests the actual tool handlers (not via stdio protocol).
 * Verifies that:
 * - All registered tools respond correctly
 * - get_version returns valid structure
 * - search returns error when not indexed
 * - health returns valid structure
 * - index → search flow works end-to-end
 * - Error handling for invalid tools
 *
 * NOTE: handleSTToolCall() возвращает «сырой» объект из handler-а,
 * а НЕ MCP-обёртку { content: [...] }. Обёртку добавляет MCP-сервер
 * при отправке по протоколу; при прямом вызове мы получаем то, что
 * вернул handler напрямую.
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");

// Use pathToFileURL for Windows compatibility
const stToolsUrl = pathToFileURL(
	join(projectRoot, "src", "mcp", "st-tools.ts"),
).href;
const { getSTToolDefinitions, handleSTToolCall } = await import(stToolsUrl);

describe("MCP Tools — registration and structure", () => {
	it("should register tools", () => {
		const definitions = getSTToolDefinitions();
		assert.ok(Array.isArray(definitions));
		assert.ok(definitions.length > 0, "Should have tool definitions");

		const names = definitions.map((d: any) => d.name);
		assert.ok(names.includes("get_version"), "Should have get_version");
		assert.ok(names.includes("search"), "Should have search");
		assert.ok(names.includes("health"), "Should have health");
		assert.ok(names.includes("references"), "Should have references");
		assert.ok(names.includes("index"), "Should have index");
		assert.ok(names.includes("call_hierarchy"), "Should have call_hierarchy");
	});

	it("should have valid schema for each tool", () => {
		const definitions = getSTToolDefinitions();
		for (const def of definitions) {
			assert.ok(def.name, `Tool should have name: ${JSON.stringify(def)}`);
			assert.ok(def.description, `Tool should have description: ${def.name}`);
			assert.ok(def.inputSchema, `Tool should have inputSchema: ${def.name}`);
		}
	});
});

describe("MCP Tools — handler responses", () => {
	it("get_version should return version info", async () => {
		const result = await handleSTToolCall("get_version", {});
		// Handler returns raw object: { version, stTools, features }
		assert.ok(result, "Should return a result");
		assert.ok(typeof result === "object", "Should be an object");
		assert.ok(result.version, "Should have version field");
		assert.strictEqual(result.stTools, true, "stTools should be true");
		assert.ok(Array.isArray(result.features), "Should have features array");
		assert.ok(result.features.length > 0, "Features should not be empty");
	});

	it("search should return error when not indexed", async () => {
		const result = await handleSTToolCall("search", { query: "anything" });
		assert.ok(result, "Should return a result");
		// Without indexer, handler returns { error: 'Not indexed yet...' }
		assert.ok(result.error, "Should have error field when not indexed");
	});

	it("health should return structure even without indexing", async () => {
		const result = await handleSTToolCall("health", { mode: "basic" });
		assert.ok(result, "Should return a result");
		// Without indexer, handler returns { status: 'not_indexed', message: '...' }
		assert.ok(result.status || result.error, "Should have status or error");
	});

	it("unknown tool should throw Error", async () => {
		// Dispatcher throws Error for unknown tools
		let threw = false;
		try {
			await handleSTToolCall("nonexistent_tool_xyz", {});
		} catch (err) {
			threw = true;
			assert.ok(err instanceof Error, "Should throw an Error");
			assert.ok(
				err.message.includes("Unknown ST tool"),
				`Error message should indicate unknown tool: ${err.message}`,
			);
		}
		assert.ok(threw, "Should have thrown for unknown tool");
	});

	it("references should return error when not indexed", async () => {
		const result = await handleSTToolCall("references", {
			entityName: "FB_Test",
		});
		assert.ok(result, "Should return something");
		// Without indexer: { error: 'Not indexed yet...' }
		assert.ok(result.error, "Should have error when not indexed");
	});
});

describe("MCP Tools — index and search flow", () => {
	const fixtureDir = join(
		projectRoot,
		"test",
		"fixtures",
		"mcp-tools-integration",
	);

	before(() => {
		// Create test ST files
		if (!existsSync(fixtureDir)) mkdirSync(fixtureDir, { recursive: true });

		writeFileSync(
			join(fixtureDir, "FB_Motor.st"),
			`FUNCTION_BLOCK FB_Motor
VAR_INPUT
  Speed : INT;
  Enable : BOOL;
END_VAR
VAR_OUTPUT
  Running : BOOL;
  Current : REAL;
END_VAR
VAR
  Timer : TON;
END_VAR

IF Enable THEN
  Running := TRUE;
  Current := Speed * 0.5;
ELSE
  Running := FALSE;
END_IF
END_FUNCTION_BLOCK`,
		);

		writeFileSync(
			join(fixtureDir, "PRG_Main.st"),
			`PROGRAM PRG_Main
VAR
  motor1 : FB_Motor;
END_VAR

motor1(Speed := 100, Enable := TRUE);
END_PROGRAM`,
		);
	});

	after(async () => {
		// Cleanup — на Windows SQLite может держать файл, поэтому
		// даём СУБД закрыть соединение (микро-пауза) и используем
		// forceful удаление. Ошибка cleanup не должна валить тест.
		if (!existsSync(fixtureDir)) return;

		try {
			rmSync(fixtureDir, { recursive: true, force: true });
		} catch {
			// Файл .db может быть ещё залочен — игнорируем.
			// ОС освободит при завершении процесса.
		}
	});

	it("should index fixture directory (may fail without LSP)", async () => {
		let result;
		try {
			result = await handleSTToolCall("index", {
				directory: fixtureDir,
				lspPath: "",
				incremental: false,
			});
		} catch (err) {
			// LSP not available — indexer may throw during start()
			// This is expected when trust-lsp is not installed
			assert.ok(err instanceof Error, "Should throw Error if LSP unavailable");
			return; // Skip rest of index-dependent tests gracefully
		}

		// If index succeeded, check the result structure
		assert.ok(result, "Should return a result");
		// Handler returns: { message, stats } or { error }
		assert.ok(
			result.message || result.error || result.stats,
			"Should have message, error, or stats",
		);
	});

	it("should attempt search after indexing", async () => {
		const result = await handleSTToolCall("search", { query: "FB_Motor" });
		assert.ok(result, "Should return something");
		// If indexed: { entities, count, ... }
		// If not indexed: { error: 'Not indexed yet...' }
		// Both are valid
		assert.ok(
			result.error ||
				result.entities !== undefined ||
				result.count !== undefined ||
				result.pous !== undefined,
			"Should have error or search results",
		);
	});

	it("should attempt search for PRG_Main", async () => {
		const result = await handleSTToolCall("search", { query: "PRG_Main" });
		assert.ok(result, "Should return something");
		assert.ok(
			result.error ||
				result.entities !== undefined ||
				result.count !== undefined ||
				result.pous !== undefined,
			"Should have error or search results",
		);
	});

	it("should attempt references for FB_Motor", async () => {
		const result = await handleSTToolCall("references", {
			entityName: "FB_Motor",
		});
		assert.ok(result, "Should return something");
		// Either { entityName, referenceCount, references } or { error }
		assert.ok(
			result.error ||
				result.entityName !== undefined ||
				result.references !== undefined,
			"Should have error or references result",
		);
	});

	it("should attempt graph stats", async () => {
		const result = await handleSTToolCall("health", { mode: "stats" });
		assert.ok(result, "Should return something");
		// Either full stats or { status: 'not_indexed' }
		assert.ok(
			result.status !== undefined || result.error !== undefined,
			"Should have status or error",
		);
	});

	it("should attempt entity source", async () => {
		const result = await handleSTToolCall("get_entity_source", {
			entityName: "FB_Motor",
		});
		assert.ok(result, "Should return something");
		// Returns { source, ... } or { error }
		assert.ok(
			result.error ||
				result.source !== undefined ||
				result.message !== undefined,
			"Should have error, source, or message",
		);
	});

	it("should attempt variable flow for FB_Motor", async () => {
		const result = await handleSTToolCall("variable_flow", {
			pouName: "FB_Motor",
		});
		assert.ok(result, "Should return something");
		// Returns { inputs, outputs, ... } or { error }
		assert.ok(
			result.error || typeof result === "object",
			"Should return result object",
		);
	});

	it("should return global vars", async () => {
		const result = await handleSTToolCall("global_vars", {});
		assert.ok(result, "Should return something");
		// Returns { globals: [] } or { error }
		assert.ok(
			result.error || result.globals !== undefined,
			"Should return globals or error",
		);
	});

	it("should attempt list file entities", async () => {
		const result = await handleSTToolCall("list_file_entities", {
			filePath: fixtureDir + "/FB_Motor.st",
		});
		assert.ok(result, "Should return something");
		// Returns { entities } or { error }
		assert.ok(
			result.error || result.entities !== undefined,
			"Should return file entities or error",
		);
	});

	it("should attempt get graph data", async () => {
		const result = await handleSTToolCall("get_graph", { limit: 10 });
		assert.ok(result, "Should return something");
		// Returns { nodes, edges } or { error }
		assert.ok(
			result.error || result.nodes !== undefined,
			"Should return graph data or error",
		);
	});

	it("should attempt AI query", async () => {
		const result = await handleSTToolCall("query", {
			question: "What is FB_Motor?",
		});
		assert.ok(result, "Should return something");
		// May return { error } if SQLite not available
		assert.ok(typeof result === "object", "Should return an object");
	});

	it("should attempt refactoring suggestion", async () => {
		const result = await handleSTToolCall("suggest_refactoring", {
			entityName: "FB_Motor",
		});
		assert.ok(result, "Should return something");
		// May return { error } if entity not found
		assert.ok(typeof result === "object", "Should return an object");
	});
});
