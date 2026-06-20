/**
 * Bun-based build script.
 *
 * Compiles the TypeScript codebase into standalone executable binaries.
 *   1. bin/st-graph-rag-mcp.exe (MCP server)
 *   2. bin/obsidian-export.exe (CLI tool)
 *
 * Usage: bun run scripts/build.ts
 */

import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dir, "..");
const binDir = resolve(projectRoot, "bin");

const entries = [
	{ input: "src/index.ts", output: "st-graph-rag-mcp" },
	{ input: "src/cli/obsidian-export.ts", output: "obsidian-export" },
];

async function buildOnce() {
	if (!existsSync(binDir)) {
		mkdirSync(binDir, { recursive: true });
	}

	const startTime = performance.now();
	
	for (const entry of entries) {
		const inputPath = resolve(projectRoot, entry.input);
		const outputPath = resolve(binDir, entry.output);

		console.log(`[build] Compiling ${entry.input} to binary...`);
		
		const result = spawnSync(
			"bun",
			["build", "--compile", inputPath, "--outfile", outputPath],
			{ stdio: "inherit", cwd: projectRoot }
		);

		if (result.status !== 0) {
			console.error(`[build] FAIL: Failed to compile ${entry.input}`);
			process.exit(1);
		}

		const exeExt = process.platform === "win32" ? ".exe" : "";
		const finalPath = outputPath + exeExt;

		if (existsSync(finalPath)) {
			const size = statSync(finalPath).size;
			console.log(
				`[build] ✓ ${entry.input} → ${relative(projectRoot, finalPath)} (${(size / 1024 / 1024).toFixed(1)} MB)`,
			);
		}
	}

	const elapsed = (performance.now() - startTime).toFixed(0);
	console.log(`[build] done in ${elapsed}ms`);
}

buildOnce().catch((err) => {
	console.error(err);
	process.exit(1);
});
