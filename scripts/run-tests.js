#!/usr/bin/env bun
/**
 * Simple test runner for ST MCP server.
 * Uses Bun's built-in test runner for TypeScript imports from src/.
 * Usage: bun run scripts/run-tests.js [--verbose] [--watch] [--silent]
 *
 * v3.0: empty test/ is a valid success state. Bun replaces tsx + cross-env.
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const __filename = import.meta.path;
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const watch = args.includes("--watch");
const silent = args.includes("--silent");

const testDir = resolve(__dirname, "..", "test");
const projectRoot = resolve(__dirname, "..");

/**
 * Recursively find test files matching *.test.{js,ts}
 */
function findTestFiles(dir) {
	const files = [];
	if (!existsSync(dir)) return files;

	const entries = readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = resolve(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...findTestFiles(fullPath));
		} else if (entry.name.match(/\.test\.(js|ts)$/)) {
			files.push(fullPath);
		}
	}
	return files;
}

async function runTests() {
	const files = findTestFiles(testDir);

	if (files.length === 0) {
		console.error(
			"No test files found in test/ (v3.0: empty test/ is a valid success state)",
		);
		console.error("Tests: 0 passed, 0 failed, 0 total");
		process.exit(0);
	}

	console.error(`Found ${files.length} test files:`);
	for (const f of files) {
		console.error(`  - ${relative(testDir, f)}`);
	}
	console.error("");

	let hasFailure = false;
	let passed = 0;
	let failed = 0;

	for (const file of files) {
		const relPath = relative(projectRoot, file);
		console.error(`\n▶ ${relPath}`);

		// Use Bun's built-in test runner (replaces `npx tsx --test`).
		const result = await new Promise((resolvePromise) => {
			const child = spawn("bun", ["test", file], {
				stdio: ["inherit", "pipe", "inherit"],
				cwd: projectRoot,
			});

			let output = "";
			child.stdout.on("data", (data) => {
				output += data.toString();
				if (verbose) process.stdout.write(data);
			});

			child.on("close", (code) => {
				resolvePromise({ code, output });
			});
		});

		if (result.code === 0) {
			passed++;
			if (!verbose) {
				const passMatch = result.output.match(/pass\s+(\d+)/);
				if (passMatch) console.error(`  ✅ pass ${passMatch[1]}`);
			}
		} else {
			failed++;
			hasFailure = true;
			console.error(`  ❌ failed`);
		}
	}

	console.error(`\n${"=".repeat(50)}`);
	console.error(
		`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`,
	);
	console.error("=".repeat(50));

	if (hasFailure) {
		process.exit(1);
	}
}

runTests().catch((err) => {
	console.error("Test runner error:", err);
	process.exit(1);
});
