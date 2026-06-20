import { expect, test, describe, beforeAll } from "bun:test";
import { STSQLiteManager } from "../src/st/sqlite-manager.js";
import { STIndexer } from "../src/st/indexer.js";
import { exportObsidianVault } from "../src/obsidian/exporter.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const workspaceDir = process.cwd();
const fixtureDir = join(workspaceDir, "test/fixtures/simple");
const dbPath = join(workspaceDir, ".code-graph-rag/st-graph.db");
const vaultPath = join(workspaceDir, "obsidian-vault");

beforeAll(() => {
	if (!existsSync(fixtureDir)) mkdirSync(fixtureDir, { recursive: true });
	// Recreate a simple fixture
	writeFileSync(
		join(fixtureDir, "FB_BaseController.st"),
		"FUNCTION_BLOCK FB_BaseController\nEND_FUNCTION_BLOCK"
	);
});

describe("End-to-End Pipeline", () => {
	test("should index and export to Obsidian", async () => {
		const indexer = new STIndexer("bin/trust-lsp.exe", workspaceDir, dbPath);
		await indexer.start();

		try {
			// 1. Index
			await indexer.indexFiles([join(fixtureDir, "FB_BaseController.st")]);
			const db = indexer.getSQLiteManager()!.getDb();
			const pous = db.prepare("SELECT * FROM st_pous").all();
			expect(pous.length).toBeGreaterThan(0);

			// 2. Export
			const stats = await exportObsidianVault(indexer.getSQLiteManager()!, {
				vaultPath,
				mode: "full",
				includeMermaid: true,
			});
			expect(stats.filesWritten).toBeGreaterThan(0);
			expect(existsSync(join(vaultPath, "pous", "FB_BaseController.md"))).toBe(true);
		} finally {
			await indexer.stop();
		}
	}, 15000); // Increase timeout to 15s for indexing overhead
});
