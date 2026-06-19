#!/usr/bin/env bun
/**
 * Smoke test for ST Graph RAG MCP server (v3.0 — Bun build).
 *
 * Validates:
 *   1. dist/index.js exists and bundles MCP tool registrations.
 *   2. All 21 required tool names are present as `name: "tool_name"` in the bundle.
 *   3. dist/cli/obsidian-export.js exists (obsidian_export tool).
 *
 * Static check (no server spawn) — keeps CI fast and avoids stdio handshake flakiness.
 * Usage: bun run scripts/smoke.js
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const distDir = resolve(projectRoot, "dist");

const REQUIRED_TOOLS = [
	"index",
	"search",
	"references",
	"call_hierarchy",
	"batch_index",
	"health",
	"variable_flow",
	"fb_instances",
	"call_chain",
	"global_vars",
	"impact_analysis",
	"metrics",
	"state_machine",
	"data_flow_graph",
	"list_file_entities",
	"get_graph",
	"get_entity_source",
	"detect_code_clones",
	"get_version",
	"reset_graph",
	"obsidian_export",
];

function fail(msg) {
	console.error(`SMOKE FAIL: ${msg}`);
	process.exit(1);
}

function pass(msg) {
	console.log(`SMOKE PASS: ${msg}`);
}

const indexPath = resolve(distDir, "index.js");
const obsidianPath = resolve(distDir, "cli", "obsidian-export.js");

if (!existsSync(indexPath)) {
	fail(`dist/index.js missing — run 'bun run build' first (path: ${indexPath})`);
}

if (!existsSync(obsidianPath)) {
	fail(`dist/cli/obsidian-export.js missing — run 'bun run build' first (path: ${obsidianPath})`);
}

const bundle = readFileSync(indexPath, "utf-8");

// Match tool registrations emitted as object-literal key: `name: "tool_name"`
// The MCP SDK signature is `server.tool(name: string, schema, handler)`,
// so the bundled source contains `name: "<tool>"` once per tool.
const toolRegex = /name:\s*["']([a-z][a-z0-9_]+)["']/g;
const registered = new Set();
for (const m of bundle.matchAll(toolRegex)) {
	registered.add(m[1]);
}

const missing = REQUIRED_TOOLS.filter((t) => !registered.has(t));
if (missing.length > 0) {
	fail(
		`Missing tool registrations in bundle: ${missing.join(", ")} (found ${registered.size} unique 'name:' identifiers)`,
	);
}

pass(`21/21 required tools registered in dist/index.js (${registered.size} unique 'name:' identifiers detected)`);
pass(`dist/cli/obsidian-export.js present`);

const obsidianCli = readFileSync(obsidianPath, "utf-8");
// Verify the expected source modules are bundled (proof that the CLI re-uses the library).
// Bun.build may strip or transform source comments; check both comment markers and key symbols.
const requiredCliSourceComments = [
	"src/obsidian/exporter.ts",
	"src/obsidian/frontmatter-builder.ts",
	"src/obsidian/wikilink-builder.ts",
	"src/obsidian/templates/pou.md.ts",
	"src/obsidian/templates/type.md.ts",
	"src/obsidian/templates/index.md.ts",
];
const requiredCliSymbols = ["loadCache", "isChanged", "toWikilink", "buildFrontmatter"];
const requiredCliEntry = ["parseArgs", "function main()"];
const missingSourceComments = requiredCliSourceComments.filter((m) => !obsidianCli.includes(m));
const missingSymbols = requiredCliSymbols.filter((s) => !obsidianCli.includes(s));
const missingEntry = requiredCliEntry.filter((s) => !obsidianCli.includes(s));
if (missingSourceComments.length > 0 || missingSymbols.length > 0 || missingEntry.length > 0) {
	const details = [];
	if (missingSourceComments.length > 0) {
		details.push(`source comments missing: ${missingSourceComments.join(", ")}`);
	}
	if (missingSymbols.length > 0) {
		details.push(`symbols missing: ${missingSymbols.join(", ")}`);
	}
	if (missingEntry.length > 0) {
		details.push(`entry points missing: ${missingEntry.join(", ")}`);
	}
	fail(`dist/cli/obsidian-export.js incomplete — ${details.join("; ")}`);
}
pass(`dist/cli/obsidian-export.js bundles 5 src/obsidian/* modules + entry main() + exports loadCache/isChanged/toWikilink/buildFrontmatter`);

process.exit(0);
