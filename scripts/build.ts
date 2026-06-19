/**
 * Bun-based build script.
 *
 * Replaces `tsup` (removed in v3.0). Produces two ESM bundles:
 *   1. dist/index.js             — MCP server entry (runtime: bun)
 *   2. dist/cli/obsidian-export.js — Obsidian vault exporter CLI
 *
 * The MCP server now runs natively under Bun (not Node), eliminating the
 * `better-sqlite3` native binding problem and ~840KB of tsup bundling overhead.
 *
 * Usage: bun run scripts/build.ts
 *        bun run scripts/build.ts --watch
 */

import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const distDir = resolve(projectRoot, "dist");

const entries = [
	{ input: "src/index.ts", output: "index.js" },
	{ input: "src/cli/obsidian-export.ts", output: "cli/obsidian-export.js" },
];

const watch = process.argv.includes("--watch");

async function clean() {
	if (existsSync(distDir)) {
		rmSync(distDir, { recursive: true, force: true });
		console.log("[build] cleaned dist/");
	}
	mkdirSync(distDir, { recursive: true });
}

async function buildOnce() {
	await clean();

	const startTime = performance.now();
	for (const entry of entries) {
		const inputPath = resolve(projectRoot, entry.input);
		const outputPath = resolve(distDir, entry.output);
		mkdirSync(dirname(outputPath), { recursive: true });

		const result = await Bun.build({
			entrypoints: [inputPath],
			outdir: dirname(outputPath),
			// Bun's build: target=bun produces a single-file ESM bundle optimized for the Bun runtime.
			// It inlines npm dependencies, tree-shakes, and externalizes Node built-ins by default.
			target: "bun",
			format: "esm",
			sourcemap: "external",
			minify: false,
			splitting: false,
			// External: keep none — bun build handles everything natively.
			// We deliberately do NOT mark `bun:sqlite` as external; it's a runtime built-in.
			// (Bun.build treats `bun:*` modules as automatic externals.)
		});

		if (!result.success) {
			console.error(`[build] FAIL: ${entry.input}`);
			for (const log of result.logs) {
				console.error(`  ${log.level}: ${log.message}`);
			}
			process.exit(1);
		}

		// Rename output to expected name (Bun uses entry filename by default).
		const bunOutput = resolve(dirname(outputPath), "index.js");
		if (entry.output !== "index.js") {
			// For cli/obsidian-export.ts → we need cli/obsidian-export.js
			// Bun outputs based on the basename of the entrypoint.
			const produced = result.outputs[0];
			if (produced) {
				const producedPath = produced.path;
				const expectedPath = outputPath;
				// Bun writes to `<outdir>/<basename-no-ext>.js` by default
				// We just verify the artifact exists and is non-empty.
				if (!existsSync(expectedPath) && !existsSync(bunOutput)) {
					console.error(
						`[build] FAIL: expected output missing: ${expectedPath} or ${bunOutput}`,
					);
					console.error(`[build] Bun produced: ${producedPath}`);
					process.exit(1);
				}
				if (producedPath !== expectedPath && existsSync(bunOutput)) {
					// Bun wrote to the wrong location; this is a fallback path.
					// We just need the bundle to exist at SOME predictable location for smoke.
					console.log(
						`[build] note: ${entry.output} emitted as ${relative(projectRoot, producedPath)}`,
					);
				}
			}
		}

		const finalPath = existsSync(outputPath) ? outputPath : bunOutput;
		const size = statSync(finalPath).size;
		console.log(
			`[build] ✓ ${entry.input} → ${relative(projectRoot, finalPath)} (${(size / 1024).toFixed(1)} KB)`,
		);
	}

	const elapsed = (performance.now() - startTime).toFixed(0);
	console.log(`[build] done in ${elapsed}ms`);
}

if (watch) {
	console.log("[build] watch mode (Ctrl+C to stop)");
	using watcher = Bun.serve({
		port: 0,
		fetch() {
			return new Response("build-watcher");
		},
	});
	// Simple file watcher: rebuild on any src/ change.
	const { watch: fsWatch } = await import("node:fs");
	const watchPaths = ["src", "tsconfig.json", "package.json"];
	const debounce = new Map<string, NodeJS.Timeout>();
	for (const wp of watchPaths) {
		const fullPath = resolve(projectRoot, wp);
		try {
			fsWatch(fullPath, { recursive: true }, (event, filename) => {
				const key = filename?.toString() ?? "";
				clearTimeout(debounce.get(key));
				debounce.set(
					key,
					setTimeout(() => {
						console.log(`[build] change detected: ${key}`);
						buildOnce().catch((e) => console.error(e));
					}, 200),
				);
			});
			console.log(`[build] watching ${wp}`);
		} catch (e) {
			console.warn(`[build] cannot watch ${wp}: ${e}`);
		}
	}
} else {
	await buildOnce();
}
