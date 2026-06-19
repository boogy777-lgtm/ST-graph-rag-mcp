/**
 * Benchmark script for ST Indexer.
 * Measures indexing performance for 10, 50, 100 files.
 * Usage: node test/benchmark/indexer.js
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generate test ST files for benchmarking.
 */
function generateTestFiles(dir, count) {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

	for (let i = 0; i < count; i++) {
		const nextIdx = (i + 1) % count;
		const content = `FUNCTION_BLOCK FB_Test_${i}
VAR_INPUT
  Enable : BOOL;
  Value : REAL;
  Index : INT := ${i};
END_VAR
VAR_OUTPUT
  Result : BOOL;
  Output : REAL;
END_VAR
VAR
  Internal : INT;
  Counter : DINT;
  NextFB : FB_Test_${nextIdx};
END_VAR
VAR_TEMP
  TempVal : REAL;
END_VAR
  // Call next FB in chain
  NextFB(Enable := Enable, Value := Value);
  Result := NextFB.Result;
  Output := NextFB.Output + Value;
END_FUNCTION_BLOCK
`;
		writeFileSync(join(dir, `FB_Test_${i}.st`), content);
	}
}

/**
 * Run benchmark for a given file count.
 */
async function benchmark(count) {
	const benchDir = join(__dirname, "fixtures", `benchmark-${count}`);

	console.log(`\n${"=".repeat(60)}`);
	console.log(`Benchmark: ${count} files`);
	console.log("=".repeat(60));

	// Generate files
	console.log(`Generating ${count} test files...`);
	const genStart = Date.now();
	generateTestFiles(benchDir, count);
	const genTime = Date.now() - genStart;
	console.log(`  Generated in ${genTime}ms`);

	try {
		const { STIndexer } = await import("../../src/st/indexer.ts");
		const { STSQLiteManager } = await import("../../src/st/sqlite-manager.ts");

		// Create indexer with temp DB
		const dbPath = join(benchDir, "bench.db");

		console.log(`Indexing ${count} files...`);
		const startTime = Date.now();

		const indexer = new STIndexer("trust-lsp", benchDir, dbPath);
		await indexer.start();

		// Use scanFiles to get file list
		const files = indexer.scanFiles();
		console.log(`  Found ${files.length} files to index`);

		// Index files one by one (without LSP, will fail on openDocument)
		// For benchmark, we measure scan + parse time
		const parseStart = Date.now();
		let totalEntities = 0;
		let totalEdges = 0;

		for (const file of files) {
			try {
				const result = await indexer.indexFile(file);
				totalEntities += result.entityCount;
				totalEdges += result.edgeCount;
			} catch (e) {
				// LSP errors expected without trust-lsp
				// Count what we can from file scanning
			}
		}

		const parseTime = Date.now() - parseStart;
		const totalTime = Date.now() - startTime;

		// Get stats from SQLite
		const sqlite = indexer.getSQLiteManager();
		const health = sqlite ? sqlite.getGraphHealth() : null;

		await indexer.stop();

		console.log(`\nResults for ${count} files:`);
		console.log(`  Total time: ${totalTime}ms`);
		console.log(`  Parse time: ${parseTime}ms`);
		console.log(
			`  Time per file: ${count > 0 ? (totalTime / count).toFixed(1) : 0}ms`,
		);
		console.log(`  Entities indexed: ${totalEntities}`);
		console.log(`  Edges indexed: ${totalEdges}`);
		if (health) {
			console.log(`  DB entities: ${health.entities.total}`);
			console.log(`  DB edges: ${health.edges.total}`);
		}

		return {
			count,
			totalTime,
			parseTime,
			timePerFile: count > 0 ? totalTime / count : 0,
			totalEntities,
			totalEdges,
			dbEntities: health?.entities.total || 0,
			dbEdges: health?.edges.total || 0,
		};
	} catch (e) {
		console.error(`  Benchmark error: ${e.message}`);
		return { count, error: e.message };
	}
}

/**
 * Run all benchmarks.
 */
async function runAll() {
	console.log("ST Indexer Benchmark");
	console.log("====================");

	const results = [];

	for (const count of [10, 50, 100]) {
		const result = await benchmark(count);
		results.push(result);

		// Cleanup between runs
		const benchDir = join(__dirname, "fixtures", `benchmark-${count}`);
		if (existsSync(benchDir)) {
			rmSync(benchDir, { recursive: true, force: true });
		}
	}

	// Summary
	console.log(`\n${"=".repeat(60)}`);
	console.log("SUMMARY");
	console.log("=".repeat(60));
	console.log(`| Files | Total (ms) | Per File (ms) | Entities | Edges |`);
	console.log(`|-------|------------|---------------|----------|-------|`);

	for (const r of results) {
		if (r.error) {
			console.log(`| ${r.count.toString().padStart(5)} | ERROR: ${r.error}`);
		} else {
			console.log(
				`| ${r.count.toString().padStart(5)} | ${r.totalTime.toString().padStart(10)} | ${r.timePerFile.toFixed(1).padStart(13)} | ${r.totalEntities.toString().padStart(8)} | ${r.totalEdges.toString().padStart(5)} |`,
			);
		}
	}
	console.log("=".repeat(60));
}

runAll().catch((err) => {
	console.error("Benchmark error:", err);
	process.exit(1);
});
