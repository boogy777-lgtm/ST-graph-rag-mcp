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
import { getResourceCount, registerResources } from "./mcp/resources/index.js";
import { getSTToolDefinitions, handleSTToolCall } from "./mcp/st-tools.js";
import { workspaceManager } from "./mcp/workspace-manager.js";
import { buildCompositeReporter } from "./reporters/index.js";

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

async function main() {
	const toolCount = toolDefinitions.length;
	const resourceCount = getResourceCount();
	console.error(`Starting ST MCP Server...`);
	console.error(`Tools available: ${toolCount} total`);
	console.error(
		`Resources available: ${resourceCount.total} total (${resourceCount.static} static, ${resourceCount.templates} templates)`,
	);

	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error("ST MCP server running on stdio transport");
}

// Graceful shutdown
process.on("SIGINT", async () => {
	console.error("\nShutting down ST MCP server...");
	await workspaceManager.shutdownAll();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	console.error("\nShutting down ST MCP server...");
	await workspaceManager.shutdownAll();
	process.exit(0);
});

main().catch((error) => {
	console.error("Failed to start ST MCP server:", error);
	process.exit(1);
});
