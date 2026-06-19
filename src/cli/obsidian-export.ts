#!/usr/bin/env bun
/**
 * CLI runner for the Obsidian vault exporter.
 *
 * Usage:
 *   bun run src/cli/obsidian-export.ts <workspace-dir> <vault-path> [--full] [--no-mermaid]
 *
 *   <workspace-dir>  Absolute path to the indexed ST workspace
 *                    (must contain .code-graph-rag/st-graph.db).
 *   <vault-path>     Absolute path to the Obsidian vault root.
 *
 * Flags:
 *   --full        Force a full re-export (default: incremental).
 *   --no-mermaid  Skip Mermaid graph in the root index.
 *
 * Examples:
 *   bun run src/cli/obsidian-export.ts D:/proj D:/vaults/st
 *   bun run src/cli/obsidian-export.ts D:/proj D:/vaults/st --full --no-mermaid
 */

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { exportObsidianVault } from "../obsidian/exporter";
import { STSQLiteManager } from "../st/sqlite-manager";

interface CliArgs {
	workspace: string;
	vault: string;
	mode: "full" | "incremental";
	includeMermaid: boolean;
}

function parseArgs(argv: string[]): CliArgs | null {
	const positional: string[] = [];
	let mode: "full" | "incremental" = "incremental";
	let includeMermaid = true;

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--full") mode = "full";
		else if (a === "--no-mermaid") includeMermaid = false;
		else if (a?.startsWith("--")) {
			console.error(`Unknown flag: ${a}`);
			return null;
		} else if (a) positional.push(a);
	}

	if (positional.length < 2) return null;
	return {
		workspace: resolve(positional[0]),
		vault: resolve(positional[1]),
		mode,
		includeMermaid,
	};
}

function main(): number {
	const args = parseArgs(process.argv.slice(2));
	if (!args) {
		console.error(
			"Usage: obsidian-export <workspace> <vault-path> [--full] [--no-mermaid]",
		);
		return 1;
	}

	const dbPath = resolve(args.workspace, ".code-graph-rag", "st-graph.db");
	if (!existsSync(dbPath)) {
		console.error(`Database not found: ${dbPath}`);
		console.error("Run index first to build the graph.");
		return 1;
	}

	// Verify bun:sqlite can open the file (read-only probe) before spinning up the manager.
	const probe = new Database(dbPath, { readonly: true });
	probe.close();

	const manager = new STSQLiteManager(dbPath);
	manager.initialize();

	return exportObsidianVault(manager, {
		vaultPath: args.vault,
		mode: args.mode,
		includeMermaid: args.includeMermaid,
	}).then(
		(stats) => {
			console.log(JSON.stringify(stats, null, 2));
			manager.close();
			return 0;
		},
		(err: unknown) => {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[obsidian-export] failed: ${message}`);
			manager.close();
			return 1;
		},
	) as unknown as number;
}

const exitCode = main();
if (typeof exitCode === "number") process.exit(exitCode);
