/**
 * Analysis ST MCP Handlers
 *
 * Handlers: variable_flow, fb_instances, call_chain, global_vars,
 *           impact_analysis, code_metrics
 */

import type { STSQLiteManager } from "../../st/sqlite-manager";
import {
	CallChainSchema,
	CodeMetricsSchema,
	FBInstancesSchema,
	GlobalVarsSchema,
	ImpactAnalysisSchema,
	VariableFlowSchema,
} from "./schemas";

const DEFAULT_LIMIT = 50;

/**
 * Get variable flow for a POU (VAR_INPUT → VAR_OUTPUT analysis).
 */
export async function handleVariableFlow(
	args: any,
	getSQLiteManager: (workspace?: string) => STSQLiteManager | null,
): Promise<any> {
	const { pouName, directory } = VariableFlowSchema.parse(args);

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	const pou = sqliteManager.getPOUByNameExact(pouName);
	if (!pou) {
		return {
			pouName,
			inputs: [],
			outputs: [],
			internals: [],
			message: `POU '${pouName}' not found in database`,
		};
	}

	const variables = sqliteManager.getVariablesByPOU(pou.id);

	const inputs = variables
		.filter((v) => v.direction === "VAR_INPUT")
		.map((v) => ({
			name: v.name,
			type: v.var_type,
			line: v.start_line,
		}));

	const outputs = variables
		.filter((v) => v.direction === "VAR_OUTPUT")
		.map((v) => ({
			name: v.name,
			type: v.var_type,
			line: v.start_line,
		}));

	const internals = variables
		.filter(
			(v) =>
				v.direction === "VAR" ||
				v.direction === "VAR_TEMP" ||
				v.direction === "VAR_IN_OUT",
		)
		.map((v) => ({
			name: v.name,
			type: v.var_type,
			direction: v.direction,
			line: v.start_line,
		}));

	return {
		pouName,
		pouType: pou.pou_type,
		file: pou.file_path,
		inputCount: inputs.length,
		outputCount: outputs.length,
		internalCount: internals.length,
		inputs,
		outputs,
		internals,
	};
}

/**
 * Find all instances of a FB (where FB is used as variable type).
 * Problem #4 fix: Uses single JOIN query instead of N+1 queries.
 */
export async function handleFBInstances(
	args: any,
	getSQLiteManager: (workspace?: string) => STSQLiteManager | null,
): Promise<any> {
	const { fbName, directory } = FBInstancesSchema.parse(args);

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	// Single JOIN query: replaces N separate getPOUById() calls
	const instances = sqliteManager.getFBInstancesWithPOU(fbName);

	return {
		fbName,
		instanceCount: instances.length,
		instances,
	};
}

/**
 * Get full call chain from a POU with depth (recursive CTE).
 */
export async function handleCallChain(
	args: any,
	getSQLiteManager: (workspace?: string) => STSQLiteManager | null,
): Promise<any> {
	const { pouName, maxDepth, limit, directory } = CallChainSchema.parse(args);
	const effectiveLimit = limit === 0 ? undefined : limit || DEFAULT_LIMIT;

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	const pou = sqliteManager.getPOUByNameExact(pouName);
	if (!pou) {
		return {
			pouName,
			chain: [],
			message: `POU '${pouName}' not found in database`,
		};
	}

	const chainRels = sqliteManager.getRecursiveCallChain(pou.id, maxDepth);
	const slicedRels = effectiveLimit
		? chainRels.slice(0, effectiveLimit)
		: chainRels;

	const chain = slicedRels.map((r) => ({
		caller: r.from_id,
		callee: r.to_id,
		depth: (r as any).depth || 1,
		file: r.file_path,
		line: r.line,
	}));

	return {
		pouName,
		pouId: pou.id,
		maxDepth,
		chainLength: chain.length,
		totalCount: chainRels.length,
		hasMore: effectiveLimit ? chainRels.length > effectiveLimit : false,
		limit: effectiveLimit,
		chain,
	};
}

/**
 * Get global variables and their users.
 */
export async function handleGlobalVars(
	args: any,
	getSQLiteManager: (workspace?: string) => STSQLiteManager | null,
): Promise<any> {
	const { varName, limit, directory } = GlobalVarsSchema.parse(args);
	const effectiveLimit = limit === 0 ? undefined : limit || DEFAULT_LIMIT;

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	let allGlobals: any[];

	if (varName) {
		allGlobals = sqliteManager.searchGlobalVariablesByName(varName);
	} else {
		allGlobals = sqliteManager.getGlobalVariables();
	}

	const globals = effectiveLimit
		? allGlobals.slice(0, effectiveLimit)
		: allGlobals;

	// Для каждой глобальной переменной находим кто её использует
	const result = globals.map((g) => {
		return {
			name: g.name,
			type: g.direction,
			file: g.file_path || "unknown",
			line: g.start_line,
		};
	});

	return {
		filter: varName || null,
		count: result.length,
		totalCount: allGlobals.length,
		hasMore: effectiveLimit ? allGlobals.length > effectiveLimit : false,
		limit: effectiveLimit,
		globals: result,
	};
}

/**
 * Analyze impact of changing an entity (who depends on it).
 */
export async function handleImpactAnalysis(
	args: any,
	getSQLiteManager: (workspace?: string) => STSQLiteManager | null,
): Promise<any> {
	const { entityName, limit, directory } = ImpactAnalysisSchema.parse(args);
	const effectiveLimit = limit === 0 ? undefined : limit || DEFAULT_LIMIT;

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	const allDirect = sqliteManager.getDirectDependents(entityName);
	const allTransitive = sqliteManager.getTransitiveDependents(entityName);

	const direct = effectiveLimit
		? allDirect.slice(0, effectiveLimit)
		: allDirect;
	const transitive = effectiveLimit
		? allTransitive.slice(0, effectiveLimit)
		: allTransitive;

	return {
		entityName,
		directDependentCount: direct.length,
		transitiveDependentCount: transitive.length,
		totalDirectDependents: allDirect.length,
		totalTransitiveDependents: allTransitive.length,
		hasMore: effectiveLimit
			? allDirect.length > effectiveLimit ||
				allTransitive.length > effectiveLimit
			: false,
		limit: effectiveLimit,
		directDependents: direct.map((d) => ({
			name: d.name,
			type: d.pou_type,
			file: d.file_path,
			relType: d.rel_type,
		})),
		transitiveDependents: transitive.map((t) => ({
			name: t.name,
			type: t.pou_type,
			file: t.file_path,
			relType: t.rel_type,
			depth: t.depth,
		})),
	};
}

/**
 * Get code metrics for POU (lines, variables, complexity).
 * mode='metrics' → POU metrics, mode='hotspots' → hotspot analysis.
 */
export async function handleCodeMetrics(
	args: any,
	getSQLiteManager: (workspace?: string) => STSQLiteManager | null,
): Promise<any> {
	const { pouName, filePath, limit, mode, metric, directory } =
		CodeMetricsSchema.parse(args);
	const effectiveLimit = limit === 0 ? undefined : limit || DEFAULT_LIMIT;

	const sqliteManager = getSQLiteManager(directory);
	if (!sqliteManager) {
		return { error: "Not indexed yet. Call index first." };
	}

	// mode='hotspots' — hotspot analysis
	if (mode === "hotspots") {
		const hotspots = sqliteManager.analyzeHotspots(
			metric,
			effectiveLimit || 10,
		);
		return {
			metric,
			hotspotCount: hotspots.length,
			hotspots: hotspots.map((h) => ({
				name: h.name,
				type: h.type,
				file: h.file,
				score: h.score,
				dependents: h.dependents,
				variables: h.variables,
			})),
		};
	}

	// mode='metrics' (default) — POU metrics
	if (pouName) {
		const metrics = sqliteManager.getPOUMetrics(pouName);
		if (!metrics) {
			return {
				pouName,
				message: `POU '${pouName}' not found in database`,
			};
		}
		return {
			metrics: [
				{
					name: metrics.name,
					type: metrics.pou_type,
					file: metrics.file_path,
					lines: metrics.lines,
					inputVars: metrics.input_vars,
					outputVars: metrics.output_vars,
					internalVars: metrics.internal_vars,
					totalVars: metrics.total_vars,
					calls: metrics.calls,
				},
			],
		};
	}

	// All POU metrics
	const allMetrics = sqliteManager.getAllPOUMetrics(filePath);
	const metrics = effectiveLimit
		? allMetrics.slice(0, effectiveLimit)
		: allMetrics;
	return {
		filter: filePath || "all",
		count: metrics.length,
		totalCount: allMetrics.length,
		hasMore: effectiveLimit ? allMetrics.length > effectiveLimit : false,
		limit: effectiveLimit,
		metrics: metrics.map((m) => ({
			name: m.name,
			type: m.pou_type,
			file: m.file_path,
			lines: m.lines,
			inputVars: m.input_vars,
			outputVars: m.output_vars,
			internalVars: m.internal_vars,
			totalVars: m.total_vars,
			calls: m.calls,
		})),
	};
}
