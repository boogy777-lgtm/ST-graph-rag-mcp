#!/usr/bin/env bun
/**
 * Smoke test for ST Graph RAG MCP server (v3.0 — Bun build).
 *
 * Validates:
 *   1. bin/st-graph-rag-mcp.exe exists and has correct size (>50MB).
 *   2. bin/obsidian-export.exe exists and supports --help output.
 *
 * Usage: bun run scripts/smoke.js
 */

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dir, "..");
const binDir = resolve(projectRoot, "bin");

const exeExt = process.platform === "win32" ? ".exe" : "";
const indexPath = resolve(binDir, `st-graph-rag-mcp${exeExt}`);
const obsidianPath = resolve(binDir, `obsidian-export${exeExt}`);

function fail(msg) {
	console.error(`SMOKE FAIL: ${msg}`);
	process.exit(1);
}

function pass(msg) {
	console.log(`SMOKE PASS: ${msg}`);
}

// 1. Check MCP server binary
if (!existsSync(indexPath)) {
	fail(`bin/st-graph-rag-mcp${exeExt} missing — run 'bun run scripts/build.ts' first`);
}

const indexSize = statSync(indexPath).size;
if (indexSize < 50 * 1024 * 1024) {
	fail(`bin/st-graph-rag-mcp${exeExt} is too small (${(indexSize / 1024 / 1024).toFixed(1)} MB). Expected >50MB bundled Bun executable.`);
}
pass(`st-graph-rag-mcp executable verified (${(indexSize / 1024 / 1024).toFixed(1)} MB)`);

// 2. Check Obsidian export binary
if (!existsSync(obsidianPath)) {
	fail(`bin/obsidian-export${exeExt} missing — run 'bun run scripts/build.ts' first`);
}

const obsSize = statSync(obsidianPath).size;
if (obsSize < 50 * 1024 * 1024) {
	fail(`bin/obsidian-export${exeExt} is too small. Expected >50MB.`);
}

// Test executing the obsidian export tool
const res = spawnSync(obsidianPath, [], { encoding: "utf8" });
if (!res.stdout.includes("Usage: obsidian-export") && !res.stderr.includes("Usage: obsidian-export")) {
	fail(`obsidian-export binary failed to print usage instructions. Output: ${res.stdout || res.stderr}`);
}
pass(`obsidian-export executable verified and responsive (${(obsSize / 1024 / 1024).toFixed(1)} MB)`);

process.exit(0);
