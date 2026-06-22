/**
 * ST-only MCP Server (entry point)
 *
 * Standalone MCP server for IEC 61131-3 Structured Text (ST) code analysis.
 * Uses truST LSP for parsing and SQLite for persistent storage.
 *
 * Delegates all tool definitions and handlers to st-tools.ts which provides 20 tools:
 * - Core (6): index, search, references, call_hierarchy, batch_index, health
 * - Analysis (6): variable_flow, fb_instances, call_chain, global_vars, impact_analysis, metrics
 * - Advanced (2): state_machine, data_flow_graph
 * - Utility (2): get_version, reset_graph
 * - SQL-Graph (4): list_file_entities, get_graph, get_entity_source, detect_code_clones
 * - Export (1, P5): obsidian_export
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
	getResourceCount,
	getSTToolDefinitions,
	handleSTToolCall,
	registerResources,
	setTelemetrySink,
	workspaceManager,
} from "./mcp/index.js";
import { buildCompositeReporter } from "./reporters/index.js";
import { BatchIndexer } from "./st/batch-indexer.js";
import { exportObsidianVault } from "./obsidian/exporter.js";
import path from "node:path";
import { STIndexer } from "./st/indexer.js";
import {
	type IndexerHooks,
	startTelemetry,
	type TelemetryHandle,
} from "./telemetry/index.js";

// === MCP Server ===

const server = new Server(
	{
		name: "st-only-mcp-server",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
			resources: {},
		},
	},
);

// Register resources (14 total: 8 static + 6 templates)
registerResources(server, () => workspaceManager.getSQLiteManager());

// Tool definitions — 20 from st-tools.ts (P5 adds obsidian_export → 21)
const toolDefinitions = getSTToolDefinitions();

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return { tools: toolDefinitions };
});

// Call tool handler — delegates to st-tools.ts dispatcher
server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name: toolName, arguments: args } = request.params;
	const token = (request.params as any)._meta?.progressToken;
	const reporter = buildCompositeReporter(server, token);

	try {
		const result = await handleSTToolCall(toolName, args, reporter);

		if (result && result.error) {
			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
				isError: true,
			};
		}

		return {
			content: [{ type: "text", text: JSON.stringify(result) }],
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({ success: false, error: errorMessage }),
				},
			],
			isError: true,
		};
	}
});

// === Startup ===

// Telemetry handle lives at module scope so SIGINT/SIGTERM handlers can stop it.
let telemetry: TelemetryHandle | null = null;

async function main() {
	const toolCount = toolDefinitions.length;
	const resourceCount = getResourceCount();
	console.error(`Starting ST MCP Server...`);
	console.error(`Tools available: ${toolCount} total`);
	console.error(
		`Resources available: ${resourceCount.total} total (${resourceCount.static} static, ${resourceCount.templates} templates)`,
	);

	// Boot the telemetry dashboard (WS server on 127.0.0.1, random port).
	// This must happen BEFORE connecting stdio, so any startup failures
	// surface before we block on the MCP transport.
	telemetry = startTelemetry({
		getActiveWorkspace: () => workspaceManager.getActiveWorkspace() || null,
		getDb: () => {
			const wsDir = workspaceManager.getActiveWorkspace();
			if (!wsDir) return null;
			const mgr = workspaceManager.getSQLiteManager(wsDir);
			return mgr ? mgr.getDb() : null;
		},
		onIndexAction: async (mode) => {
			const wsDir = workspaceManager.getActiveWorkspace();
			if (!wsDir) throw new Error("No active workspace to index");
			const sqliteManager = workspaceManager.getSQLiteManager(wsDir);
			if (!sqliteManager) throw new Error("SQLite DB not initialized for workspace");

			if (mode === "wipe") {
				sqliteManager.resetGraph();
			}

			let indexer = await workspaceManager.getIndexer(wsDir);
			if (!indexer) {
				// We don't have an indexer yet, let's create one.
				// This assumes TRUST_LSP_PATH is set or 'bin/trust-lsp.exe' exists relative to cwd.
				const lspPathResolved = process.env.TRUST_LSP_PATH || "bin/trust-lsp.exe";
				indexer = new STIndexer(lspPathResolved, wsDir, undefined, telemetry?.hooks);
				await indexer.start();
				workspaceManager.setIndexer(indexer, wsDir);
			}

			const batchIndexer = new BatchIndexer(wsDir, indexer);
			workspaceManager.setBatchIndexer(batchIndexer, wsDir);

			await batchIndexer.startSession({
				directory: wsDir,
				incremental: mode === "incremental",
				fullScan: mode === "full",
				reset: mode === "wipe"
			});
		},
		onObsidianExport: async () => {
			const wsDir = workspaceManager.getActiveWorkspace();
			if (!wsDir) throw new Error("No active workspace for export");
			const sqliteManager = workspaceManager.getSQLiteManager(wsDir);
			if (!sqliteManager) throw new Error("SQLite DB not initialized");

			const outDir = path.resolve(wsDir, "obsidian-vault");
			return exportObsidianVault(sqliteManager, {
				vaultPath: outDir,
				mode: "incremental",
				includeMermaid: true,
			});
		}
	});

	// Wire the telemetry sink for the AI-Radar middleware.
	// Tool registrations are static (st-tools.ts → ToolDispatcher wraps each
	// handler with `withTelemetry`), but the bus instance is created here.
	// Setting the sink now means every subsequent tool call emits
	// tool_started → tool_completed/tool_failed events onto the bus.
	setTelemetrySink((draft) => {
		telemetry?.bus.publish(draft);
	});

	// Make the hooks available to the indexer. WorkspaceManager will pass them
	// into every STIndexer it constructs (cold-path reconstruction included).
	workspaceManager.setIndexerHooks(telemetry.hooks);

	console.error(`Telemetry UI available at: ${telemetry.url}`);

	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error("ST MCP server running on stdio transport");
}

// Graceful shutdown
async function shutdown(reason: "sigint" | "sigterm" | "error"): Promise<void> {
	console.error(`\nShutting down ST MCP server (${reason})...`);
	try {
		telemetry?.stop();
	} catch (err) {
		console.error("[Shutdown] telemetry stop failed:", err);
	}
	try {
		await workspaceManager.shutdownAll();
	} catch (err) {
		console.error("[Shutdown] workspace shutdown failed:", err);
	}
	process.exit(0);
}

process.on("SIGINT", () => {
	void shutdown("sigint");
});

process.on("SIGTERM", () => {
	void shutdown("sigterm");
});

main().catch((error) => {
	console.error("Failed to start ST MCP server:", error);
	void shutdown("error");
});
