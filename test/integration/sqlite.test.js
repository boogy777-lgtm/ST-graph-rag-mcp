/**
 * Integration tests for STSQLiteManager.
 * Tests SQLite operations, FK CASCADE, bulk insert, and queries.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { STSQLiteManager } from "../../src/st/sqlite-manager.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("STSQLiteManager", () => {
	let db;
	const dbPath = join(__dirname, "..", "fixtures", "test-sqlite.db");

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

	it("should initialize database and create tables", () => {
		const health = db.getGraphHealth();
		assert.strictEqual(health.status, "empty");
		assert.strictEqual(health.entities.total, 0);
		assert.strictEqual(health.edges.total, 0);
	});

	it("should insert and retrieve POU", () => {
		const pou = {
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
		};
		db.insertPOU(pou);

		const found = db.getPOUByNameExact("FB_Test");
		assert.ok(found);
		assert.strictEqual(found.name, "FB_Test");
		assert.strictEqual(found.pou_type, "FUNCTION_BLOCK");
	});

	it("should insert and retrieve variables", () => {
		// Insert POU first
		db.insertPOU({
			id: "st:test.st:FB_Test",
			name: "FB_Test",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 1,
			end_line: null,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: Date.now(),
			updated_at: Date.now(),
		});

		// Insert variable
		db.insertVariable({
			id: "st:var:st:test.st:FB_Test:Enable",
			pou_id: "st:test.st:FB_Test",
			name: "Enable",
			direction: "VAR_INPUT",
			var_type: "BOOL",
			default_value: null,
			start_line: null,
			end_line: null,
		});

		const vars = db.getVariablesByPOU("st:test.st:FB_Test");
		assert.strictEqual(vars.length, 1);
		assert.strictEqual(vars[0].name, "Enable");
		assert.strictEqual(vars[0].direction, "VAR_INPUT");
	});

	it("should bulk insert file data", () => {
		const pous = [
			{
				id: "st:test.st:FB_A",
				name: "FB_A",
				pou_type: "FUNCTION_BLOCK",
				file_path: "test.st",
				start_line: 1,
				end_line: null,
				namespace: null,
				extends: null,
				implements: null,
				signature: null,
				created_at: Date.now(),
				updated_at: Date.now(),
			},
			{
				id: "st:test.st:FB_B",
				name: "FB_B",
				pou_type: "FUNCTION_BLOCK",
				file_path: "test.st",
				start_line: 10,
				end_line: null,
				namespace: null,
				extends: null,
				implements: null,
				signature: null,
				created_at: Date.now(),
				updated_at: Date.now(),
			},
		];
		const variables = [
			{
				id: "st:var:st:test.st:FB_A:x",
				pou_id: "st:test.st:FB_A",
				name: "x",
				direction: "VAR_INPUT",
				var_type: "BOOL",
				default_value: null,
				start_line: null,
				end_line: null,
			},
		];
		const types = [];
		const relationships = [
			{
				id: "st:rel:call:1",
				from_id: "st:test.st:FB_A",
				to_id: "st:test.st:FB_B",
				type: "CALLS",
				file_path: "test.st",
				line: 5,
				metadata: null,
			},
		];

		db.bulkInsertFileData(
			"test.st",
			"hash123",
			pous,
			variables,
			types,
			relationships,
		);

		const health = db.getGraphHealth();
		assert.strictEqual(health.entities.total, 2); // 2 POU
		assert.strictEqual(health.edges.total, 1); // 1 CALLS

		const vars = db.getVariablesByPOU("st:test.st:FB_A");
		assert.strictEqual(vars.length, 1);
	});

	it("should search POU by name (LIKE)", () => {
		const now = Date.now();
		const pouBase = {
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			end_line: null,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
		};
		db.insertPOU({
			id: "st:test.st:FB_PID",
			name: "FB_PID",
			start_line: 1,
			created_at: now,
			updated_at: now,
			...pouBase,
		});
		db.insertPOU({
			id: "st:test.st:FB_PID_Advanced",
			name: "FB_PID_Advanced",
			start_line: 10,
			created_at: now,
			updated_at: now,
			...pouBase,
		});

		const results = db.searchPOUs("FB_PID");
		// searchPOUs uses LIKE with %query%, so FB_PID matches both FB_PID and FB_PID_Advanced
		assert.ok(results.length >= 1, "Should find at least 1 POU");
	});

	it("should exact match POU by name (Problem #2 fix)", () => {
		const now2 = Date.now();
		db.insertPOU({
			id: "st:test.st:FB_PID",
			name: "FB_PID",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 1,
			end_line: null,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: now2,
			updated_at: now2,
		});
		db.insertPOU({
			id: "st:test.st:FB_PID_Advanced",
			name: "FB_PID_Advanced",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 10,
			end_line: null,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: now2,
			updated_at: now2,
		});

		const exact = db.getPOUByNameExact("FB_PID");
		assert.ok(exact);
		assert.strictEqual(exact.name, "FB_PID");
		assert.strictEqual(exact.id, "st:test.st:FB_PID");

		// Should NOT return FB_PID_Advanced
		const notFound = db.getPOUByNameExact("FB");
		assert.strictEqual(notFound, undefined);
	});

	it("should respect limit parameter (Problem #5 fix)", () => {
		const now3 = Date.now();
		for (let i = 0; i < 10; i++) {
			db.insertPOU({
				id: `st:test.st:FB_${i}`,
				name: `FB_${i}`,
				pou_type: "FUNCTION_BLOCK",
				file_path: "test.st",
				start_line: i * 10,
				end_line: null,
				namespace: null,
				extends: null,
				implements: null,
				signature: null,
				created_at: now3,
				updated_at: now3,
			});
		}

		const limited = db.searchPOUs("FB", undefined, 3);
		assert.ok(limited.length <= 3);
	});

	it("should insert and retrieve types", () => {
		db.insertType({
			id: "st:type:test.st:ST_Config",
			name: "ST_Config",
			type_kind: "STRUCT",
			file_path: "test.st",
			start_line: 1,
			end_line: null,
			definition: null,
			created_at: Date.now(),
		});

		const types = db.searchTypes("ST_Config");
		assert.strictEqual(types.length, 1);
		assert.strictEqual(types[0].type_kind, "STRUCT");
	});

	it("should get all POU names", () => {
		const now4 = Date.now();
		db.insertPOU({
			id: "st:test.st:FB_A",
			name: "FB_A",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 1,
			end_line: null,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: now4,
			updated_at: now4,
		});
		db.insertPOU({
			id: "st:test.st:FB_B",
			name: "FB_B",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 10,
			end_line: null,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: now4,
			updated_at: now4,
		});

		const names = db.getAllPOUNames();
		assert.ok(names.has("FB_A"));
		assert.ok(names.has("FB_B"));
	});

	it("should delete POU by file", () => {
		db.insertPOU({
			id: "st:test.st:FB_Test",
			name: "FB_Test",
			pou_type: "FUNCTION_BLOCK",
			file_path: "test.st",
			start_line: 1,
			end_line: null,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
			created_at: Date.now(),
			updated_at: Date.now(),
		});

		db.deletePOUsByFile("test.st");

		const found = db.getPOUByNameExact("FB_Test");
		assert.strictEqual(found, undefined);
	});
});

describe("STSQLiteManager FK CASCADE", () => {
	let db;
	const dbPath = join(__dirname, "..", "fixtures", "test-cascade.db");

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

	it("should cascade delete variables when POU is deleted", () => {
		// Insert POU
		db.bulkInsertFileData(
			"test.st",
			"hash1",
			[
				{
					id: "st:test.st:FB_Test",
					name: "FB_Test",
					pou_type: "FUNCTION_BLOCK",
					file_path: "test.st",
					start_line: 1,
					end_line: null,
					namespace: null,
					extends: null,
					implements: null,
					signature: null,
					created_at: Date.now(),
					updated_at: Date.now(),
				},
			],
			[
				{
					id: "st:var:st:test.st:FB_Test:x",
					pou_id: "st:test.st:FB_Test",
					name: "x",
					direction: "VAR_INPUT",
					var_type: "BOOL",
					default_value: null,
					start_line: null,
					end_line: null,
				},
			],
			[],
			[],
		);

		// Verify variable exists
		const varsBefore = db.getVariablesByPOU("st:test.st:FB_Test");
		assert.strictEqual(varsBefore.length, 1);

		// Delete POU
		db.deletePOUsByFile("test.st");

		// Verify variable is cascade deleted
		const varsAfter = db.getVariablesByPOU("st:test.st:FB_Test");
		assert.strictEqual(varsAfter.length, 0);
	});

	it("should cascade delete relationships when POU is deleted", () => {
		db.bulkInsertFileData(
			"test.st",
			"hash1",
			[
				{
					id: "st:test.st:FB_A",
					name: "FB_A",
					pou_type: "FUNCTION_BLOCK",
					file_path: "test.st",
					start_line: 1,
					end_line: null,
					namespace: null,
					extends: null,
					implements: null,
					signature: null,
					created_at: Date.now(),
					updated_at: Date.now(),
				},
				{
					id: "st:test.st:FB_B",
					name: "FB_B",
					pou_type: "FUNCTION_BLOCK",
					file_path: "test.st",
					start_line: 10,
					end_line: null,
					namespace: null,
					extends: null,
					implements: null,
					signature: null,
					created_at: Date.now(),
					updated_at: Date.now(),
				},
			],
			[],
			[],
			[
				{
					id: "st:rel:call:1",
					from_id: "st:test.st:FB_A",
					to_id: "st:test.st:FB_B",
					type: "CALLS",
					file_path: "test.st",
					line: 5,
					metadata: null,
				},
			],
		);

		// Delete all POU
		db.deletePOUsByFile("test.st");

		// Verify relationships are cascade deleted
		const rels = db.getRelationshipsByEntityId("st:test.st:FB_A");
		assert.strictEqual(rels.length, 0);
	});
});
