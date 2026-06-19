/**
 * MCP Resources Registry
 *
 * Registers all 14 resources with the MCP server.
 * Handles both static resources and dynamic resource templates.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { STSQLiteManager } from "../../st/sqlite-manager.js";
import { handleResourceRead } from "./handlers.js";
import type {
	ResourceDefinition,
	ResourceTemplateDefinition,
} from "./types.js";

// === Static Resource Definitions ===

const STATIC_RESOURCES: ResourceDefinition[] = [
	{
		uri: "st://files/list",
		name: "Indexed Files List",
		description:
			"List of all indexed ST files with metadata (hash, last indexed, POU count). Use to see what files are tracked.",
		mimeType: "application/json",
		isTemplate: false,
	},
	{
		uri: "st://globals",
		name: "Global Variables",
		description:
			"All VAR_GLOBAL declarations with their types and locations. Use to understand shared state.",
		mimeType: "application/json",
		isTemplate: false,
	},
];

// === Resource Template Definitions ===

const RESOURCE_TEMPLATES: ResourceTemplateDefinition[] = [
	{
		uriTemplate: "st://entity/{name}",
		name: "Entity Info",
		description:
			"Detailed information about a specific ST entity (POU or type). Includes variables, calls, and calledBy relationships. Example: st://entity/FB_Motor",
		mimeType: "application/json",
	},
	{
		uriTemplate: "st://calls/{pouName}",
		name: "Call Hierarchy",
		description:
			"Call hierarchy for a specific POU showing incoming and outgoing calls with depth. Example: st://calls/PLC_PRG",
		mimeType: "application/json",
	},
	{
		uriTemplate: "st://statechart/{pouName}",
		name: "Statechart",
		description:
			"State machine analysis for a POU. Supports ?view=full|flat|tree|transitions|dot|mermaid query parameter. Example: st://statechart/FB_StateMachine?view=mermaid",
		mimeType: "application/json",
	},
];

// === Resource Registration ===

/**
 * Registers all resources with the MCP server.
 *
 * This function sets up:
 * 1. ListResources handler — returns all available resources and templates
 * 2. ReadResource handler — handles reading resource content by URI
 */
export function registerResources(
	server: Server,
	getSQLiteManager: () => STSQLiteManager | null,
): void {
	// Register ListResources handler
	server.setRequestHandler(ListResourcesRequestSchema, async () => {
		return {
			resources: STATIC_RESOURCES.map((r) => ({
				uri: r.uri,
				name: r.name,
				description: r.description,
				mimeType: r.mimeType,
			})),
			resourceTemplates: RESOURCE_TEMPLATES.map((t) => ({
				uriTemplate: t.uriTemplate,
				name: t.name,
				description: t.description,
				mimeType: t.mimeType,
			})),
		};
	});

	// Register ReadResource handler
	server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
		const uri = request.params.uri;
		return handleResourceRead(uri, getSQLiteManager);
	});
}

/**
 * Returns the list of all registered resources (for documentation/testing).
 */
export function getResourceDefinitions(): {
	resources: ResourceDefinition[];
	templates: ResourceTemplateDefinition[];
} {
	return {
		resources: STATIC_RESOURCES,
		templates: RESOURCE_TEMPLATES,
	};
}

/**
 * Returns the count of registered resources.
 */
export function getResourceCount(): {
	static: number;
	templates: number;
	total: number;
} {
	return {
		static: STATIC_RESOURCES.length,
		templates: RESOURCE_TEMPLATES.length,
		total: STATIC_RESOURCES.length + RESOURCE_TEMPLATES.length,
	};
}
