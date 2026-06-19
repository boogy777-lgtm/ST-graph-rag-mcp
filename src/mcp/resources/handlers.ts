/**
 * MCP Resource Handlers
 *
 * Handles reading of 5 resources (2 static + 3 templates). Each resource returns JSON data
 * that clients can read via the MCP readResource protocol.
 *
 * Resources are read-only and should not perform heavy computation.
 * For complex operations, use tools instead.
 */

import type { STSQLiteManager } from "../../st/sqlite-manager.js";
import type {
	CallsData,
	EntityData,
	FilesListData,
	GlobalsData,
	ResourceError,
	StatechartData,
	StatechartView,
} from "./types.js";

// === URI Parser ===

/**
 * Parses a resource URI into base, template params, and query params.
 *
 * Examples:
 *   st://graph/stats           -> { base: 'st://graph/stats', params: {}, query: {} }
 *   st://entity/FB_Motor       -> { base: 'st://entity', params: { name: 'FB_Motor' }, query: {} }
 *   st://statechart/FB_Ctrl?v=full -> { base: 'st://statechart', params: { pouName: 'FB_Ctrl' }, query: { v: 'full' } }
 */
export function parseResourceURI(uri: string): {
	base: string;
	params: Record<string, string>;
	query: Record<string, string>;
} {
	const [uriPart, queryString] = uri.split("?");
	const parts = uriPart.split("/").filter(Boolean);

	// parts[0] = 'st:', parts[1] = 'graph', parts[2] = 'stats' etc.
	if (parts.length < 2) {
		return { base: uri, params: {}, query: {} };
	}

	// Determine if this is a static resource (st://graph/stats) or template (st://entity/{name})
	// Static resources have exactly 3 parts: ['st:', 'category', 'resource']
	// Template resources have 3+ parts: ['st:', 'category', 'paramValue']
	const base = `st://${parts[1]}`;
	const params: Record<string, string> = {};
	const query: Record<string, string> = {};

	if (parts.length > 2) {
		const paramKey = getParamKeyForBase(base);
		if (paramKey) {
			// Template resource: decode the param value
			params[paramKey] = decodeURIComponent(parts.slice(2).join("/"));
		} else {
			// Static resource: include the sub-path in base
			// e.g., st://graph/stats -> base = 'st://graph/stats'
			// e.g., st://analysis/hotspots -> base = 'st://analysis/hotspots'
			return {
				base: `st://${parts.slice(1).join("/")}`,
				params: {},
				query,
			};
		}
	}

	// Parse query string
	if (queryString) {
		for (const pair of queryString.split("&")) {
			const [key, value] = pair.split("=");
			if (key && value !== undefined) {
				query[key] = decodeURIComponent(value);
			}
		}
	}

	return { base, params, query };
}

/**
 * Returns the parameter key name for a given resource base URI.
 */
function getParamKeyForBase(base: string): string | null {
	switch (base) {
		case "st://entity":
			return "name";
		case "st://calls":
			return "pouName";
		case "st://statechart":
			return "pouName";
		default:
			return null;
	}
}

// === Main Resource Read Handler ===

/**
 * Main handler for reading resources.
 * Dispatches to the appropriate handler based on URI.
 */
export async function handleResourceRead(
	uri: string,
	getSQLiteManager: () => STSQLiteManager | null,
): Promise<{
	contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
	const sqliteManager = getSQLiteManager();
	if (!sqliteManager) {
		return {
			contents: [
				{
					uri,
					mimeType: "application/json",
					text: JSON.stringify({
						error: "Not indexed yet. Call index first.",
					} as ResourceError),
				},
			],
		};
	}

	const parsed = parseResourceURI(uri);

	try {
		let data: unknown;

		switch (parsed.base) {
			case "st://files/list":
				data = handleFilesListResource(sqliteManager);
				break;
			case "st://globals":
				data = handleGlobalsResource(sqliteManager);
				break;
			case "st://entity":
				data = handleEntityResource(parsed.params["name"], sqliteManager);
				break;
			case "st://calls":
				data = handleCallsResource(parsed.params["pouName"], sqliteManager);
				break;
			case "st://statechart":
				data = handleStatechartResource(
					parsed.params["pouName"],
					(parsed.query["view"] || parsed.query["v"]) as
						| StatechartView
						| undefined,
					sqliteManager,
				);
				break;
			default:
				data = { error: `Unknown resource: ${parsed.base}` } as ResourceError;
		}

		return {
			contents: [
				{
					uri,
					mimeType: "application/json",
					text: JSON.stringify(data),
				},
			],
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			contents: [
				{
					uri,
					mimeType: "application/json",
					text: JSON.stringify({ error: errorMessage } as ResourceError),
				},
			],
		};
	}
}

// === Static Resource Handlers ===

/**
 * st://files/list — List of indexed files
 */
const DEFAULT_LIMIT = 50;

function handleFilesListResource(db: STSQLiteManager): FilesListData {
	const files = db.getAllFiles().slice(0, DEFAULT_LIMIT);
	const totalPOUs = files.reduce((sum, f) => sum + f.pou_count, 0);

	return {
		uri: "st://files/list",
		totalFiles: files.length,
		totalPOUs,
		files: files.map((f) => ({
			path: f.path,
			hash: f.hash,
			lastIndexed: new Date(f.last_indexed).toISOString(),
			pouCount: f.pou_count,
			varCount: f.var_count,
		})),
	};
}

/**
 * st://globals — Global variables
 */
function handleGlobalsResource(db: STSQLiteManager): GlobalsData {
	const allGlobals = db.getGlobalVariables();
	const globals = allGlobals.slice(0, DEFAULT_LIMIT);

	return {
		uri: "st://globals",
		count: globals.length,
		globals: globals.map((g) => ({
			name: g.name,
			type: g.direction,
			line: g.start_line,
		})),
	};
}

// === Template Resource Handlers ===

/**
 * st://entity/{name} — Entity information
 */
function handleEntityResource(
	name: string,
	db: STSQLiteManager,
): EntityData | ResourceError {
	if (!name) {
		return { error: "Entity name is required" };
	}

	const entities = db.resolveEntity(name, undefined, 1);

	if (entities.length === 0) {
		return { error: `Entity '${name}' not found` };
	}

	const entity = entities[0];

	// Get variables if it's a POU
	const pou = db.getPOUByNameExact(name);
	let variables: Array<{ name: string; direction: string; varType: string }> =
		[];
	if (pou) {
		const vars = db.getVariablesByPOU(pou.id);
		variables = vars.map((v) => ({
			name: v.name,
			direction: v.direction,
			varType: v.var_type,
		}));
	}

	// Get call relationships
	const incoming = pou ? db.getIncomingCalls(pou.id) : [];
	const outgoing = pou ? db.getOutgoingCalls(pou.id) : [];

	return {
		uri: `st://entity/${name}`,
		id: entity.id,
		name: entity.name,
		type: entity.type,
		file: entity.file,
		line: entity.line,
		description: entity.description,
		variables,
		calls: outgoing.map((r) => r.to_id),
		calledBy: incoming.map((r) => r.from_id),
	};
}

/**
 * st://calls/{pouName} — Call hierarchy
 */
function handleCallsResource(
	pouName: string,
	db: STSQLiteManager,
): CallsData | ResourceError {
	if (!pouName) {
		return { error: "POU name is required" };
	}

	const pou = db.getPOUByNameExact(pouName);
	if (!pou) {
		return { error: `POU '${pouName}' not found` };
	}

	const allIncoming = db.getIncomingCalls(pou.id);
	const allOutgoing = db.getOutgoingCalls(pou.id);
	const chain = db.getRecursiveCallChain(pou.id, 5);

	const incoming = allIncoming.slice(0, DEFAULT_LIMIT);
	const outgoing = allOutgoing.slice(0, DEFAULT_LIMIT);

	return {
		uri: `st://calls/${pouName}`,
		pouName,
		pouType: pou.pou_type,
		file: pou.file_path,
		incomingCount: incoming.length,
		outgoingCount: outgoing.length,
		limit: DEFAULT_LIMIT,
		incoming: incoming.map((r) => ({
			caller: r.from_id,
			file: r.file_path,
			line: r.line,
		})),
		outgoing: outgoing.map((r) => ({
			callee: r.to_id,
			file: r.file_path,
			line: r.line,
		})),
		callChainDepth: chain.length,
	};
}

/**
 * st://statechart/{pouName}?view=full|flat|tree|transitions|dot|mermaid
 *
 * Statechart resource with multiple view modes for hierarchical FSM.
 * Full state extraction requires parsing the source file for CASE...END_CASE constructs.
 */
function handleStatechartResource(
	pouName: string,
	view: StatechartView | undefined,
	db: STSQLiteManager,
): StatechartData | ResourceError {
	if (!pouName) {
		return { error: "POU name is required" };
	}

	const viewMode: StatechartView = view || "full";

	const machines = db.getStateMachines(pouName);
	if (machines.length === 0) {
		return {
			error: `POU '${pouName}' not found or does not contain state machine`,
			uri: `st://statechart/${pouName}`,
			view: viewMode,
		};
	}

	const machine = machines[0];

	const baseData = {
		uri: `st://statechart/${pouName}`,
		view: viewMode,
		pouName: machine.pouName,
		pouType: machine.pouType,
		filePath: machine.filePath,
		startLine: machine.startLine,
		endLine: machine.endLine,
	};

	switch (viewMode) {
		case "flat":
			return {
				...baseData,
				states: [],
				note: "Flat state list requires source parsing. Parse CASE statements in the source file for actual states.",
			};

		case "tree":
			return {
				...baseData,
				hierarchy: {
					name: machine.pouName,
					children: [],
				},
				note: "State hierarchy requires source parsing. Parse nested CASE statements for hierarchy.",
			};

		case "transitions":
			return {
				...baseData,
				transitions: [],
				note: "Transition extraction requires source parsing. Parse CASE...END_CASE for state transitions.",
			};

		case "dot":
			return {
				...baseData,
				format: "dot" as const,
				content: generateDotDiagram(
					machine.pouName,
					machine.filePath,
					machine.startLine,
				),
				note: "DOT diagram template. Parse CASE statements to populate actual states and transitions.",
			};

		case "mermaid":
			return {
				...baseData,
				format: "mermaid" as const,
				content: generateMermaidDiagram(
					machine.pouName,
					machine.filePath,
					machine.startLine,
				),
				note: "Mermaid diagram template. Parse CASE statements to populate actual states and transitions.",
			};

		case "full":
		default:
			return {
				...baseData,
				states: [],
				transitions: [],
				metrics: {
					totalStates: 0,
					maxDepth: 0,
					totalTransitions: 0,
					hasOrthogonalRegions: false,
					compositeStates: 0,
				},
				note: "Full statechart data requires source file parsing. Parse CASE...END_CASE constructs in the source file.",
			};
	}
}

/**
 * Generate a DOT diagram template for Graphviz.
 */
function generateDotDiagram(
	pouName: string,
	filePath: string,
	startLine: number,
): string {
	return `digraph ${pouName.replace(/[^a-zA-Z0-9_]/g, "_")} {
  rankdir=LR;
  node [shape=ellipse, style=filled, fillcolor=lightblue];
  
  // States (parse from CASE statements in ${filePath}:${startLine})
  Initial [shape=point, fillcolor=black];
  State1 [label="State1"];
  State2 [label="State2"];
  
  // Transitions (parse from CASE...END_CASE)
  Initial -> State1;
  State1 -> State2 [label="condition"];
  State2 -> State1 [label="reset"];
}`;
}

/**
 * Generate a Mermaid diagram template.
 */
function generateMermaidDiagram(
	pouName: string,
	filePath: string,
	startLine: number,
): string {
	return `stateDiagram-v2
  // Statechart for ${pouName}
  // Source: ${filePath}:${startLine}
  // Parse CASE...END_CASE for actual states
  
  [*] --> State1
  State1 --> State2 : condition
  State2 --> State1 : reset
  
  // Nested states (if any):
  // state State1 {
  //   [*] --> SubState1
  //   SubState1 --> SubState2 : event
  // }`;
}
