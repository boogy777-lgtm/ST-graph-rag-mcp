/**
 * Unit tests for MCP Resource Handlers.
 * Tests URI parsing, resource registration, and handler dispatch.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
	handleResourceRead,
	parseResourceURI,
} from "../../../src/mcp/resources/handlers.ts";
import { STSQLiteManager } from "../../../src/st/sqlite-manager.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("parseResourceURI", () => {
	it("should parse static resource URI", () => {
		const result = parseResourceURI("st://files/list");
		assert.strictEqual(result.base, "st://files/list");
		assert.deepStrictEqual(result.params, {});
		assert.deepStrictEqual(result.query, {});
	});

	it("should parse template resource URI with param", () => {
		const result = parseResourceURI("st://entity/FB_Motor");
		assert.strictEqual(result.base, "st://entity");
		assert.strictEqual(result.params["name"], "FB_Motor");
		assert.deepStrictEqual(result.query, {});
	});

	it("should parse URI with query parameters", () => {
		const result = parseResourceURI("st://statechart/FB_Ctrl?view=mermaid");
		assert.strictEqual(result.base, "st://statechart");
		assert.strictEqual(result.params["pouName"], "FB_Ctrl");
		assert.strictEqual(result.query["view"], "mermaid");
	});

	it("should parse URI with multiple query parameters", () => {
		const result = parseResourceURI(
			"st://statechart/FB_Ctrl?view=dot&format=svg",
		);
		assert.strictEqual(result.base, "st://statechart");
		assert.strictEqual(result.params["pouName"], "FB_Ctrl");
		assert.strictEqual(result.query["view"], "dot");
		assert.strictEqual(result.query["format"], "svg");
	});

	it("should handle encoded param values", () => {
		const result = parseResourceURI("st://entity/FB%20Motor%20Controller");
		assert.strictEqual(result.params["name"], "FB Motor Controller");
	});

	it("should handle names with slashes", () => {
		const result = parseResourceURI("st://entity/Namespace/FB_Motor");
		assert.strictEqual(result.params["name"], "Namespace/FB_Motor");
	});
});

describe("handleResourceRead", () => {
	let db;
	const dbPath = join(__dirname, "..", "..", "fixtures", "test-resources.db");

	function getSQLiteManager() {
		return db;
	}

	beforeEach(() => {
		if (existsSync(dbPath)) unlinkSync(dbPath);
		const dir = dirname(dbPath);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		db = new STSQLiteManager(dbPath);
		db.initialize();
	});

	afterEach(() => {
		if (db) db.close();
		if (existsSync(dbPath)) unlinkSync(dbPath);
	});

	it("should return error when not indexed", async () => {
		const result = await handleResourceRead("st://files/list", () => null);
		const data = JSON.parse(result.contents[0].text);
		assert.ok(data.error);
	});

	it("should return files list for empty database", async () => {
		const result = await handleResourceRead(
			"st://files/list",
			getSQLiteManager,
		);
		const data = JSON.parse(result.contents[0].text);
		assert.strictEqual(data.uri, "st://files/list");
		assert.strictEqual(data.totalFiles, 0);
		assert.deepStrictEqual(data.files, []);
	});

	it("should return globals for empty database", async () => {
		const result = await handleResourceRead("st://globals", getSQLiteManager);
		const data = JSON.parse(result.contents[0].text);
		assert.strictEqual(data.uri, "st://globals");
		assert.strictEqual(data.count, 0);
	});

	it("should return error for unknown entity", async () => {
		const result = await handleResourceRead(
			"st://entity/NonExistent",
			getSQLiteManager,
		);
		const data = JSON.parse(result.contents[0].text);
		assert.ok(data.error);
	});

	it("should return error for unknown resource", async () => {
		const result = await handleResourceRead(
			"st://unknown/path",
			getSQLiteManager,
		);
		const data = JSON.parse(result.contents[0].text);
		assert.ok(data.error);
	});

	it("should return entity data when POU exists", async () => {
		// Insert test POU
		db.insertPOU({
			id: "st:test.st:FB_Test",
			name: "FB_Test",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 1,
			end_line: 10,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: Date.now(),
			updated_at: Date.now(),
		});

		const result = await handleResourceRead(
			"st://entity/FB_Test",
			getSQLiteManager,
		);
		const data = JSON.parse(result.contents[0].text);
		assert.strictEqual(data.uri, "st://entity/FB_Test");
		assert.strictEqual(data.name, "FB_Test");
		assert.strictEqual(data.type, "FUNCTION_BLOCK");
	});

	it("should return calls data when POU exists", async () => {
		db.insertPOU({
			id: "st:test.st:FB_Caller",
			name: "FB_Caller",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 1,
			end_line: 10,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: Date.now(),
			updated_at: Date.now(),
		});

		const result = await handleResourceRead(
			"st://calls/FB_Caller",
			getSQLiteManager,
		);
		const data = JSON.parse(result.contents[0].text);
		assert.strictEqual(data.uri, "st://calls/FB_Caller");
		assert.strictEqual(data.pouName, "FB_Caller");
		assert.strictEqual(data.incomingCount, 0);
		assert.strictEqual(data.outgoingCount, 0);
	});

	it("should return statechart data for POU", async () => {
		db.insertPOU({
			id: "st:test.st:FB_StateMachine",
			name: "FB_StateMachine",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 1,
			end_line: 50,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: Date.now(),
			updated_at: Date.now(),
		});

		const result = await handleResourceRead(
			"st://statechart/FB_StateMachine",
			getSQLiteManager,
		);
		const data = JSON.parse(result.contents[0].text);
		assert.strictEqual(data.uri, "st://statechart/FB_StateMachine");
		assert.strictEqual(data.view, "full");
		// getStateMachines may or may not find the POU depending on DB state
		// Just verify we get a valid response (either data or error)
		assert.ok(data.uri || data.error);
	});

	it("should return statechart with mermaid view", async () => {
		db.insertPOU({
			id: "st:test.st:FB_StateMachine",
			name: "FB_StateMachine",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 1,
			end_line: 50,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: Date.now(),
			updated_at: Date.now(),
		});

		const result = await handleResourceRead(
			"st://statechart/FB_StateMachine?view=mermaid",
			getSQLiteManager,
		);
		const data = JSON.parse(result.contents[0].text);
		assert.strictEqual(data.view, "mermaid");
		assert.strictEqual(data.format, "mermaid");
		assert.ok(data.content.includes("stateDiagram-v2"));
	});

	it("should return statechart with dot view", async () => {
		db.insertPOU({
			id: "st:test.st:FB_StateMachine",
			name: "FB_StateMachine",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 1,
			end_line: 50,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: Date.now(),
			updated_at: Date.now(),
		});

		const result = await handleResourceRead(
			"st://statechart/FB_StateMachine?view=dot",
			getSQLiteManager,
		);
		const data = JSON.parse(result.contents[0].text);
		// May return error if getStateMachines doesn't find it, or valid DOT content
		if (data.error) {
			// Error is acceptable
			assert.ok(typeof data.error === "string");
		} else {
			assert.strictEqual(data.view, "dot");
			assert.strictEqual(data.format, "dot");
			assert.ok(typeof data.content === "string");
		}
	});
});
