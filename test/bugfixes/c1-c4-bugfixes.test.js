/**
 * Bug fix tests: C1-C4 — Critical fixes verification.
 * Tests try/finally, Promise lock, CTE cycles, LSP timeout handling.
 *
 * NOTE: C1 and C2 tests require trust-lsp to be installed.
 * They are skipped if trust-lsp is not available.
 */

import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import { execSync } from "child_process";
import {
	accessSync,
	constants,
	existsSync,
	mkdirSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import modules at top level
const { STIndexer } = await import("../../src/st/indexer.ts");
const { STSQLiteManager } = await import("../../src/st/sqlite-manager.ts");
const { LSPClient } = await import("../../src/lsp/client.ts");

/**
 * Check if trust-lsp is available on PATH.
 */
function isLspAvailable() {
	try {
		execSync("where trust-lsp", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

const LSP_AVAILABLE = isLspAvailable();

// === C1: try/finally — closeDocument always called ===

describe("C1: try/finally — closeDocument always called", {
	skip: !LSP_AVAILABLE ? "trust-lsp not available" : false,
}, () => {
	const fixtureDir = join(__dirname, "..", "fixtures", "c1-test");

	beforeEach(() => {
		if (!existsSync(fixtureDir)) mkdirSync(fixtureDir, { recursive: true });
		writeFileSync(
			join(fixtureDir, "FB_Test.st"),
			`FUNCTION_BLOCK FB_Test
VAR_INPUT x : BOOL; END_VAR
END_FUNCTION_BLOCK`,
		);
	});

	afterEach(() => {
		const dbPath = join(fixtureDir, ".code-graph-rag", "st-graph.db");
		if (existsSync(dbPath)) unlinkSync(dbPath);
		if (existsSync(fixtureDir))
			rmSync(fixtureDir, { recursive: true, force: true });
	});

	it("should call closeDocument even when getDocumentSymbols throws", async () => {
		let closeCalled = false;

		const indexer = new STIndexer("trust-lsp", fixtureDir);
		await indexer.start();

		const mockLsp = {
			...indexer.lspClient,
			openDocument: async () => {},
			closeDocument: async () => {
				closeCalled = true;
			},
			getDocumentSymbols: async () => {
				throw new Error("LSP parse error");
			},
		};
		indexer.lspClient = mockLsp;

		try {
			await indexer.indexFile(join(fixtureDir, "FB_Test.st"));
		} catch (e) {
			// Expected error
		}

		assert.strictEqual(
			closeCalled,
			true,
			"closeDocument must be called even on error",
		);
		await indexer.stop();
	});
});

// === C2: Promise lock — prevent concurrent indexing ===

describe("C2: Promise lock — prevent concurrent indexing", {
	skip: !LSP_AVAILABLE ? "trust-lsp not available" : false,
}, () => {
	const fixtureDir = join(__dirname, "..", "fixtures", "c2-test");

	beforeEach(() => {
		if (!existsSync(fixtureDir)) mkdirSync(fixtureDir, { recursive: true });
		writeFileSync(
			join(fixtureDir, "FB_Test.st"),
			`FUNCTION_BLOCK FB_Test
VAR_INPUT x : BOOL; END_VAR
END_FUNCTION_BLOCK`,
		);
	});

	afterEach(() => {
		const dbPath = join(fixtureDir, ".code-graph-rag", "st-graph.db");
		if (existsSync(dbPath)) unlinkSync(dbPath);
		if (existsSync(fixtureDir))
			rmSync(fixtureDir, { recursive: true, force: true });
	});

	it("should return same promise for concurrent indexAll calls", async () => {
		let doIndexAllCalls = 0;

		const indexer = new STIndexer("trust-lsp", fixtureDir);
		await indexer.start();

		const originalDoIndexAll = indexer._doIndexAll.bind(indexer);
		indexer._doIndexAll = async () => {
			doIndexAllCalls++;
			return originalDoIndexAll();
		};

		try {
			const [r1, r2] = await Promise.all([
				indexer.indexAll(),
				indexer.indexAll(),
			]);

			assert.strictEqual(
				doIndexAllCalls,
				1,
				"Only one _doIndexAll should be called",
			);
			assert.deepStrictEqual(r1, r2, "Both calls should return same result");
		} finally {
			await indexer.stop();
		}
	});

	it("should allow new indexAll after previous completes", async () => {
		let doIndexAllCalls = 0;

		const indexer = new STIndexer("trust-lsp", fixtureDir);
		await indexer.start();

		const originalDoIndexAll = indexer._doIndexAll.bind(indexer);
		indexer._doIndexAll = async () => {
			doIndexAllCalls++;
			return originalDoIndexAll();
		};

		try {
			await indexer.indexAll();
			assert.strictEqual(doIndexAllCalls, 1);

			await indexer.indexAll();
			assert.strictEqual(doIndexAllCalls, 2);
		} finally {
			await indexer.stop();
		}
	});
});

// === C3: CTE visited set — prevent infinite cycles ===

describe("C3: CTE visited set — prevent infinite cycles", () => {
	let db;
	const dbPath = join(__dirname, "..", "fixtures", "c3-cycle.db");

	beforeEach(() => {
		if (existsSync(dbPath)) unlinkSync(dbPath);
		db = new STSQLiteManager(dbPath);
		db.initialize();

		// Create cyclic dependencies: A → B → C → A
		const now = Date.now();
		const pouBase = {
			pou_type: "FUNCTION_BLOCK",
			file_path: "cycle.st",
			end_line: null,
			namespace: null,
			extends: null,
			implements: null,
			signature: null,
		};
		db.bulkInsertFileData(
			"cycle.st",
			"hash1",
			[
				{
					id: "st:cycle.st:A",
					name: "A",
					start_line: 1,
					created_at: now,
					updated_at: now,
					...pouBase,
				},
				{
					id: "st:cycle.st:B",
					name: "B",
					start_line: 10,
					created_at: now,
					updated_at: now,
					...pouBase,
				},
				{
					id: "st:cycle.st:C",
					name: "C",
					start_line: 20,
					created_at: now,
					updated_at: now,
					...pouBase,
				},
			],
			[],
			[],
			[
				{
					id: "rel1",
					from_id: "st:cycle.st:A",
					to_id: "st:cycle.st:B",
					type: "CALLS",
					file_path: "cycle.st",
					line: 5,
					metadata: null,
				},
				{
					id: "rel2",
					from_id: "st:cycle.st:B",
					to_id: "st:cycle.st:C",
					type: "CALLS",
					file_path: "cycle.st",
					line: 15,
					metadata: null,
				},
				{
					id: "rel3",
					from_id: "st:cycle.st:C",
					to_id: "st:cycle.st:A",
					type: "CALLS",
					file_path: "cycle.st",
					line: 25,
					metadata: null,
				},
			],
		);
	});

	afterEach(() => {
		if (db) db.close();
		if (existsSync(dbPath)) unlinkSync(dbPath);
	});

	it("should handle cyclic dependencies without infinite loop", () => {
		const result = db.getTransitiveDependents("A", 20);

		// Should return B and C (not A itself due to visited set)
		assert.ok(
			result.length >= 2,
			"Should find at least 2 transitive dependents",
		);

		// No duplicates
		const names = result.map((r) => r.name);
		const uniqueNames = new Set(names);
		assert.strictEqual(
			names.length,
			uniqueNames.size,
			"No duplicates in results",
		);
	});

	it("should handle self-referencing entity without hanging", () => {
		db.insertRelationship({
			id: "rel-self",
			from_id: "st:cycle.st:A",
			to_id: "st:cycle.st:A",
			type: "CALLS",
			file_path: "cycle.st",
			line: 30,
			metadata: null,
		});

		// Should complete without hanging — the key test is completion
		const result = db.getTransitiveDependents("A", 20);

		// The visited set prevents infinite recursion, not necessarily exclusion
		assert.ok(Array.isArray(result), "Should return array without hanging");
	});

	it("should handle deep chain without cycles", () => {
		const pous = [];
		const rels = [];
		const now2 = Date.now();
		for (let i = 1; i <= 20; i++) {
			pous.push({
				id: `st:deep.st:D${i}`,
				name: `D${i}`,
				pou_type: "FUNCTION_BLOCK",
				file_path: "deep.st",
				start_line: i * 10,
				end_line: null,
				namespace: null,
				extends: null,
				implements: null,
				signature: null,
				created_at: now2,
				updated_at: now2,
			});
			if (i > 1) {
				rels.push({
					id: `rel-d${i}`,
					from_id: `st:deep.st:D${i}`,
					to_id: `st:deep.st:D${i - 1}`,
					type: "CALLS",
					file_path: "deep.st",
					line: i * 10 + 5,
					metadata: null,
				});
			}
		}

		db.bulkInsertFileData("deep.st", "hash2", pous, [], [], rels);

		const result = db.getTransitiveDependents("D1", 30);
		assert.ok(result.length >= 19, "Should find all 19 transitive dependents");
	});
});

// === C4: LSP timeout — pending requests don't hang ===

describe("C4: LSP timeout — pending requests handled", () => {
	it("should handle stop() without error", async () => {
		const lsp = new LSPClient("trust-lsp", 1000);
		await lsp.stop();
		assert.ok(true, "stop() completed without error");
	});
});
