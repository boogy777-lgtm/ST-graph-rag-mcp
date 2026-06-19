/**
 * Obsidian Export MCP Handler
 *
 * Tool: `obsidian_export` (21st tool, Phase 6).
 * Wraps the pure `exportObsidianVault` orchestrator with:
 *   - Zod schema validation
 *   - SQLite manager resolution via ToolHelpers
 *   - Error formatting (never throws raw Error to the client)
 */

import { exportObsidianVault } from "../../obsidian/exporter";
import type { ToolHelpers } from "../registry";
import { type ObsidianExportArgs, ObsidianExportSchema } from "./schemas";

/**
 * Export the indexed ST graph to an Obsidian vault.
 */
export async function handleObsidianExport(
	args: Record<string, unknown>,
	helpers: ToolHelpers,
): Promise<unknown> {
	const parsed: ObsidianExportArgs = ObsidianExportSchema.parse(args);

	const manager = helpers.getSQLiteManager();
	if (!manager) {
		return {
			success: false,
			error: "Not indexed yet. Call index first to build the graph.",
		};
	}

	try {
		const stats = await exportObsidianVault(manager, {
			vaultPath: parsed.vaultPath,
			mode: parsed.mode,
			includeMermaid: parsed.includeMermaid,
		});
		return {
			success: true,
			...stats,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("[obsidian_export] failed:", message);
		return {
			success: false,
			error: message,
		};
	}
}
