/**
 * Advanced ST MCP Handlers
 *
 * Handlers: state_machine, graph_health_extended, data_flow_graph
 */

import type { STSQLiteManager } from "../../st/sqlite-manager";
import {
	DataFlowGraphSchema,
	GraphHealthExtendedSchema,
	StateMachineSchema,
} from "./schemas";

/**
 * Analyze state machines (CASE...END_CASE) in ST code.
 * Returns POU candidates that may contain state machines.
 */
export async function handleStateMachine(
	args: any,
	getSQLiteManager: (workspace?: string) => STSQLiteManager | null,
): Promise<any> {
	const { pouName, directory } = StateMachineSchema.parse(args);

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	const machines = sqliteManager.getStateMachines(pouName);

	if (machines.length === 0) {
		return {
			pouName: pouName || "all",
			stateMachineCount: 0,
			stateMachines: [],
		};
	}

	return {
		pouName: pouName || "all",
		stateMachineCount: machines.length,
		note: "CASE...END_CASE parsing requires source file access. Use startLine/endLine to extract and parse manually.",
		stateMachines: machines.map((m) => ({
			pouName: m.pouName,
			pouId: m.pouId,
			filePath: m.filePath,
			pouType: m.pouType,
			startLine: m.startLine,
			endLine: m.endLine,
		})),
	};
}

/**
 * Get extended graph health with orphan detection, stale files, and aggregate stats.
 */
export async function handleGraphHealthExtended(
	getSQLiteManager: (workspace?: string) => STSQLiteManager | null,
): Promise<any> {
	const sqliteManager = getSQLiteManager();
	if (!sqliteManager) {
		return {
			status: "not_indexed",
			message: "Call index first to build the graph",
		};
	}

	const health = sqliteManager.getGraphHealthExtended();

	return {
		status: health.status,
		entities: health.entities,
		edges: health.edges,
		files: health.files,
		orphanEntities: health.orphanEntities,
		staleFiles: health.staleFiles,
		stats: health.stats,
	};
}

/**
 * Get data flow graph: VAR_OUTPUT of one FB → VAR_INPUT of another via CALLS.
 * Shows how data flows through POU boundaries.
 */
export async function handleDataFlowGraph(
	args: any,
	getSQLiteManager: (workspace?: string) => STSQLiteManager | null,
): Promise<any> {
	const { startPou, directory } = DataFlowGraphSchema.parse(args);

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	const flow = sqliteManager.getDataFlowGraph(startPou);

	if (flow.length === 0) {
		const pou = sqliteManager.getPOUByNameExact(startPou);
		if (!pou) {
			return {
				startPou,
				flow: [],
				message: `POU '${startPou}' not found in database`,
			};
		}
		return {
			startPou,
			flow: [],
			message: `No data flow found from '${startPou}'. POU may have no VAR_OUTPUT or no CALLS relationships.`,
		};
	}

	return {
		startPou,
		flowCount: flow.length,
		flow: flow.map((f) => ({
			fromPou: f.fromPou,
			fromVar: f.fromVar,
			toPou: f.toPou,
			toVar: f.toVar,
		})),
	};
}
