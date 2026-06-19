/**
 * Utility ST MCP Handlers
 *
 * Handlers: get_version, reset_graph
 */

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import type { STSQLiteManager } from "../../st/sqlite-manager";
import { ResetGraphSchema } from "./schemas";

let cachedVersion: string | null = null;

/**
 * Get server version from package.json.
 */
function getServerVersion(): string {
	if (cachedVersion) return cachedVersion;
	try {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		const packagePath = resolve(__dirname, "..", "..", "..", "package.json");
		if (existsSync(packagePath)) {
			const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
			cachedVersion = pkg.version || "unknown";
			return cachedVersion!;
		}
	} catch {
		// Fallback if package.json cannot be read
	}
	cachedVersion = "unknown";
	return cachedVersion!;
}

/**
 * Get server version and available features.
 */
export async function handleGetVersion(): Promise<any> {
	const version = getServerVersion();

	const features = [
		"index",
		"search",
		"references",
		"call_hierarchy",
		"graph_health",
		"variable_flow",
		"fb_instances",
		"call_chain",
		"global_vars",
		"inheritance",
		"interface_impl",
		"impact_analysis",
		"code_metrics",
		"state_machine",
		"graph_health_extended",
		"cross_file_deps",
		"data_flow_graph",
		"get_version",
		"reset_graph",
		"list_file_entities",
		"get_graph",
		"get_entity_source",
		"list_module_importers",
		"detect_code_clones",
		"resolve_entity",
		"analyze_hotspots",
		"get_metrics",
		"get_graph_stats",
		"query",
		"suggest_refactoring",
	];

	return {
		version,
		stTools: true,
		features,
	};
}

/**
 * Reset the entire graph database.
 */
export async function handleResetGraph(
	args: any,
	getSQLiteManager: () => STSQLiteManager | null,
): Promise<any> {
	const { force } = ResetGraphSchema.parse(args);

	const sqliteManager = getSQLiteManager();
	if (!sqliteManager) {
		return {
			success: false,
			deletedEntities: 0,
			deletedRelationships: 0,
			message: "Graph is empty. Call index first to build the graph.",
		};
	}

	if (!force) {
		return {
			success: false,
			deletedEntities: 0,
			deletedRelationships: 0,
			message:
				"WARNING: This will delete all graph data. Set force=true to confirm.",
		};
	}

	const result = sqliteManager.resetGraph();

	return {
		success: true,
		deletedEntities: result.deletedEntities,
		deletedRelationships: result.deletedRelationships,
		message: `Graph reset complete. Deleted ${result.deletedEntities} entities and ${result.deletedRelationships} relationships.`,
	};
}
