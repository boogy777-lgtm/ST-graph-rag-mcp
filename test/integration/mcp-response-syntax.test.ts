/**
 * Integration tests for MCP response syntax and structure validation.
 *
 * Directly calls handleSTToolCall() and validates the shape of every
 * response without going through stdio. The indexed SQLite database is
 * used (project-root .code-graph-rag/st-graph.db). Health full mode is
 * executed against an empty workspace because the maxCallDepth CTE in
 * getGraphHealthExtended() is prohibitively slow on the full graph.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");

const stToolsUrl = pathToFileURL(
	join(projectRoot, "src", "mcp", "st-tools.ts"),
).href;
const { getSTToolDefinitions, handleSTToolCall } = await import(stToolsUrl);

const SAMPLE_ENTITY = "FB_Motor";
const SAMPLE_FILE = join(
	projectRoot,
	"trust-platform",
	"tests",
	"corpus",
	"function_blocks",
	"motor.st",
);
const EMPTY_HEALTH_WS = join(
	projectRoot,
	"test",
	"integration",
	".empty-health-syntax",
);

// Ensure the empty workspace directory exists so the health/full test
// can create a fresh empty DB there and avoid the slow maxCallDepth
// query on the fully indexed graph.
if (!existsSync(EMPTY_HEALTH_WS)) {
	mkdirSync(EMPTY_HEALTH_WS, { recursive: true });
}

describe("MCP Response Syntax — structure validation", () => {
	it("get_version returns valid shape", async () => {
		const result = await handleSTToolCall("get_version", {});
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.strictEqual(typeof result.version, "string", "version is string");
		assert.strictEqual(result.stTools, true, "stTools is true");
		assert.ok(Array.isArray(result.features), "features is array");
		assert.ok(result.features.length > 0, "features not empty");
		assert.ok(
			result.features.every((f: unknown) => typeof f === "string"),
			"all features are strings",
		);
	});

	it("search returns valid structure for existing query", async () => {
		const result = await handleSTToolCall("search", {
			query: SAMPLE_ENTITY,
			limit: 5,
		});
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.strictEqual(result.method, "basic_search", "method is basic_search");
		assert.strictEqual(typeof result.query, "string", "query is string");
		assert.strictEqual(typeof result.type, "string", "type is string");
		assert.strictEqual(typeof result.limit, "number", "limit is number");
		assert.strictEqual(typeof result.count, "number", "count is number");
		assert.ok(Array.isArray(result.entities), "entities is array");
		assert.strictEqual(
			result.entities.length,
			result.count,
			"entities length matches count",
		);

		for (const entity of result.entities) {
			assert.strictEqual(typeof entity.name, "string", "entity.name is string");
			assert.strictEqual(typeof entity.type, "string", "entity.type is string");
			assert.strictEqual(typeof entity.file, "string", "entity.file is string");
			assert.strictEqual(typeof entity.line, "number", "entity.line is number");
			assert.ok(
				entity.parent === null || typeof entity.parent === "string",
				"entity.parent is string|null",
			);
			assert.ok(
				entity.signature === undefined ||
					entity.signature === null ||
					typeof entity.signature === "string",
				"entity.signature is string|null|undefined",
			);
		}
	});

	it("search with nonexistent query returns valid empty response", async () => {
		const result = await handleSTToolCall("search", {
			query: "XYZ_NONEXISTENT_12345",
			limit: 5,
		});
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.strictEqual(result.count, 0, "count is 0");
		assert.ok(Array.isArray(result.entities), "entities is array");
		assert.strictEqual(result.entities.length, 0, "entities is empty");
		assert.strictEqual(typeof result.method, "string", "method is string");
		assert.strictEqual(typeof result.query, "string", "query is string");
		assert.strictEqual(typeof result.type, "string", "type is string");
		assert.strictEqual(typeof result.limit, "number", "limit is number");
	});

	it("health basic returns valid shape", async () => {
		const result = await handleSTToolCall("health", { mode: "basic" });
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.ok(
			result.status === "ready" ||
				result.status === "empty" ||
				result.status === "not_indexed",
			"status is one of ready|empty|not_indexed",
		);
		assert.ok(
			result.lastStats === null ||
				(typeof result.lastStats === "object" && result.lastStats !== null),
			"lastStats is null or object",
		);
		assert.strictEqual(typeof result.entities, "object", "entities is object");
		assert.strictEqual(
			typeof result.entities.total,
			"number",
			"entities.total is number",
		);
		assert.strictEqual(
			typeof result.entities.byType,
			"object",
			"entities.byType is object",
		);
		assert.strictEqual(typeof result.edges, "object", "edges is object");
		assert.strictEqual(
			typeof result.edges.total,
			"number",
			"edges.total is number",
		);
		assert.strictEqual(
			typeof result.edges.byType,
			"object",
			"edges.byType is object",
		);
		assert.strictEqual(typeof result.files, "object", "files is object");
		assert.strictEqual(
			typeof result.files.total,
			"number",
			"files.total is number",
		);
	});

	it("health stats returns valid shape", async () => {
		const result = await handleSTToolCall("health", { mode: "stats" });
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.ok(result.status, "status is present");
		assert.strictEqual(typeof result.entities, "object", "entities is object");
		assert.strictEqual(typeof result.edges, "object", "edges is object");
		assert.strictEqual(typeof result.files, "object", "files is object");
		assert.strictEqual(typeof result.stats, "object", "stats is object");

		assert.ok(
			Array.isArray(result.stats.entityTypes),
			"stats.entityTypes is array",
		);
		assert.ok(
			Array.isArray(result.stats.relationshipTypes),
			"stats.relationshipTypes is array",
		);
		assert.ok(
			Array.isArray(result.stats.mostConnected),
			"stats.mostConnected is array",
		);

		for (const et of result.stats.entityTypes) {
			assert.strictEqual(typeof et.type, "string", "entityType.type is string");
			assert.strictEqual(
				typeof et.count,
				"number",
				"entityType.count is number",
			);
		}
		for (const rt of result.stats.relationshipTypes) {
			assert.strictEqual(
				typeof rt.type,
				"string",
				"relationshipType.type is string",
			);
			assert.strictEqual(
				typeof rt.count,
				"number",
				"relationshipType.count is number",
			);
		}
		for (const mc of result.stats.mostConnected) {
			assert.strictEqual(
				typeof mc.name,
				"string",
				"mostConnected.name is string",
			);
			assert.strictEqual(
				typeof mc.connections,
				"number",
				"mostConnected.connections is number",
			);
		}
	});

	it("health full returns valid shape", async () => {
		const result = await handleSTToolCall("health", {
			mode: "full",
			directory: EMPTY_HEALTH_WS,
		});
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.ok(result.status, "status is present");
		assert.strictEqual(typeof result.entities, "object", "entities is object");
		assert.strictEqual(typeof result.edges, "object", "edges is object");
		assert.strictEqual(typeof result.files, "object", "files is object");

		assert.strictEqual(typeof result.extended, "object", "extended is object");
		assert.ok(
			Array.isArray(result.extended.orphanEntities),
			"extended.orphanEntities is array",
		);
		assert.ok(
			Array.isArray(result.extended.staleFiles),
			"extended.staleFiles is array",
		);
		assert.strictEqual(
			typeof result.extended.stats,
			"object",
			"extended.stats is object",
		);

		assert.strictEqual(typeof result.metrics, "object", "metrics is object");
		assert.strictEqual(
			typeof result.metrics.totalFiles,
			"number",
			"metrics.totalFiles is number",
		);
		assert.strictEqual(
			typeof result.metrics.totalPous,
			"number",
			"metrics.totalPous is number",
		);
		assert.strictEqual(
			typeof result.metrics.totalTypes,
			"number",
			"metrics.totalTypes is number",
		);
		assert.strictEqual(
			typeof result.metrics.totalVariables,
			"number",
			"metrics.totalVariables is number",
		);
		assert.strictEqual(
			typeof result.metrics.totalRelationships,
			"number",
			"metrics.totalRelationships is number",
		);
		assert.strictEqual(
			typeof result.metrics.avgVariablesPerPou,
			"number",
			"metrics.avgVariablesPerPou is number",
		);

		assert.strictEqual(typeof result.stats, "object", "stats is object");
		assert.ok(
			Array.isArray(result.stats.entityTypes),
			"stats.entityTypes is array",
		);
		assert.ok(
			Array.isArray(result.stats.relationshipTypes),
			"stats.relationshipTypes is array",
		);
		assert.ok(
			Array.isArray(result.stats.mostConnected),
			"stats.mostConnected is array",
		);
	});

	it("references returns valid shape", async () => {
		const result = await handleSTToolCall("references", {
			entityName: SAMPLE_ENTITY,
		});
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.strictEqual(result.entityName, SAMPLE_ENTITY, "entityName matches");
		assert.strictEqual(
			typeof result.referenceCount,
			"number",
			"referenceCount is number",
		);
		assert.ok(Array.isArray(result.references), "references is array");
		for (const ref of result.references) {
			assert.strictEqual(typeof ref.type, "string", "reference.type is string");
			assert.strictEqual(typeof ref.file, "string", "reference.file is string");
			assert.strictEqual(typeof ref.line, "number", "reference.line is number");
		}
	});

	it("call_hierarchy returns valid shape", async () => {
		const result = await handleSTToolCall("call_hierarchy", {
			entityName: SAMPLE_ENTITY,
			direction: "both",
		});
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.strictEqual(result.entityName, SAMPLE_ENTITY, "entityName matches");
		assert.strictEqual(
			typeof result.direction,
			"string",
			"direction is string",
		);
		assert.strictEqual(
			typeof result.incomingCount,
			"number",
			"incomingCount is number",
		);
		assert.strictEqual(
			typeof result.outgoingCount,
			"number",
			"outgoingCount is number",
		);
		assert.ok(Array.isArray(result.incoming), "incoming is array");
		assert.ok(Array.isArray(result.outgoing), "outgoing is array");

		for (const call of result.incoming) {
			assert.strictEqual(typeof call.file, "string", "call.file is string");
			assert.strictEqual(typeof call.line, "number", "call.line is number");
		}
		for (const call of result.outgoing) {
			assert.strictEqual(typeof call.file, "string", "call.file is string");
			assert.strictEqual(typeof call.line, "number", "call.line is number");
		}
	});

	it("metrics returns valid shape", async () => {
		const result = await handleSTToolCall("metrics", { limit: 5 });
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.strictEqual(typeof result.filter, "string", "filter is string");
		assert.strictEqual(typeof result.count, "number", "count is number");
		assert.strictEqual(
			typeof result.totalCount,
			"number",
			"totalCount is number",
		);
		assert.strictEqual(typeof result.limit, "number", "limit is number");
		assert.ok(Array.isArray(result.metrics), "metrics is array");

		for (const m of result.metrics) {
			assert.strictEqual(typeof m.name, "string", "metric.name is string");
			assert.strictEqual(typeof m.type, "string", "metric.type is string");
			assert.strictEqual(typeof m.file, "string", "metric.file is string");
			assert.strictEqual(typeof m.lines, "number", "metric.lines is number");
			assert.strictEqual(
				typeof m.inputVars,
				"number",
				"metric.inputVars is number",
			);
			assert.strictEqual(
				typeof m.outputVars,
				"number",
				"metric.outputVars is number",
			);
			assert.strictEqual(
				typeof m.internalVars,
				"number",
				"metric.internalVars is number",
			);
			assert.strictEqual(
				typeof m.totalVars,
				"number",
				"metric.totalVars is number",
			);
			assert.strictEqual(typeof m.calls, "number", "metric.calls is number");
		}
	});

	it("get_graph returns valid shape", async () => {
		const result = await handleSTToolCall("get_graph", { limit: 5 });
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.ok(Array.isArray(result.nodes), "nodes is array");
		assert.ok(Array.isArray(result.edges), "edges is array");
		assert.strictEqual(typeof result.total, "number", "total is number");
		assert.ok(
			result.nextCursor === undefined ||
				result.nextCursor === null ||
				typeof result.nextCursor === "string",
			"nextCursor is string|null|undefined",
		);

		for (const node of result.nodes) {
			assert.strictEqual(typeof node.name, "string", "node.name is string");
			assert.strictEqual(typeof node.type, "string", "node.type is string");
			assert.strictEqual(typeof node.file, "string", "node.file is string");
		}
		for (const edge of result.edges) {
			assert.strictEqual(typeof edge.source, "string", "edge.source is string");
			assert.strictEqual(typeof edge.target, "string", "edge.target is string");
			assert.strictEqual(typeof edge.type, "string", "edge.type is string");
		}
	});

	it("global_vars returns valid shape", async () => {
		const result = await handleSTToolCall("global_vars", { limit: 5 });
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.ok(
			result.filter === null || typeof result.filter === "string",
			"filter is null|string",
		);
		assert.strictEqual(typeof result.count, "number", "count is number");
		assert.strictEqual(
			typeof result.totalCount,
			"number",
			"totalCount is number",
		);
		assert.strictEqual(typeof result.limit, "number", "limit is number");
		assert.ok(Array.isArray(result.globals), "globals is array");

		for (const g of result.globals) {
			assert.strictEqual(typeof g.name, "string", "global.name is string");
			assert.strictEqual(typeof g.type, "string", "global.type is string");
			assert.strictEqual(typeof g.file, "string", "global.file is string");
			assert.strictEqual(typeof g.line, "number", "global.line is number");
		}
	});

	it("list_file_entities returns valid shape", async () => {
		const result = await handleSTToolCall("list_file_entities", {
			filePath: SAMPLE_FILE,
		});
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.strictEqual(typeof result.file, "string", "file is string");
		assert.strictEqual(
			typeof result.entityCount,
			"number",
			"entityCount is number",
		);
		assert.ok(Array.isArray(result.entities), "entities is array");
		assert.strictEqual(
			result.entities.length,
			result.entityCount,
			"entities length matches entityCount",
		);

		for (const entity of result.entities) {
			assert.strictEqual(typeof entity.name, "string", "entity.name is string");
			assert.strictEqual(typeof entity.type, "string", "entity.type is string");
			assert.strictEqual(typeof entity.line, "number", "entity.line is number");
		}
	});

	it("get_entity_source returns valid shape", async () => {
		const result = await handleSTToolCall("get_entity_source", {
			entityName: SAMPLE_ENTITY,
		});
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.strictEqual(typeof result.entity, "object", "entity is object");
		assert.strictEqual(
			typeof result.entity.name,
			"string",
			"entity.name is string",
		);
		assert.strictEqual(
			typeof result.entity.type,
			"string",
			"entity.type is string",
		);
		assert.strictEqual(
			typeof result.entity.file,
			"string",
			"entity.file is string",
		);
		assert.strictEqual(
			typeof result.entity.line,
			"number",
			"entity.line is number",
		);
		assert.strictEqual(typeof result.source, "string", "source is string");
		assert.strictEqual(
			typeof result.startLine,
			"number",
			"startLine is number",
		);
		assert.strictEqual(typeof result.endLine, "number", "endLine is number");
	});

	it("unknown tool throws Error", async () => {
		let threw = false;
		try {
			await handleSTToolCall("nonexistent_tool_xyz", {});
		} catch (err) {
			threw = true;
			assert.ok(err instanceof Error, "thrown value is Error");
			assert.ok(
				err.message.includes("Unknown ST tool"),
				`error message indicates unknown tool: ${err.message}`,
			);
		}
		assert.ok(threw, "should have thrown for unknown tool");
	});

	it("references for nonexistent entity returns empty valid response", async () => {
		const result = await handleSTToolCall("references", {
			entityName: "XYZ_NONEXISTENT_999",
		});
		assert.ok(result, "result exists");
		assert.strictEqual(typeof result, "object", "result is object");
		assert.strictEqual(
			result.entityName,
			"XYZ_NONEXISTENT_999",
			"entityName matches",
		);
		assert.strictEqual(result.referenceCount, 0, "referenceCount is 0");
		assert.ok(Array.isArray(result.references), "references is array");
		assert.strictEqual(result.references.length, 0, "references is empty");
	});
});

after(() => {
	// Best-effort cleanup of the empty workspace used for the full-health test.
	try {
		if (existsSync(EMPTY_HEALTH_WS)) {
			rmSync(EMPTY_HEALTH_WS, { recursive: true, force: true });
		}
	} catch {
		// Ignore Windows file-lock errors; OS will release on process exit.
	}
});

// Verify that the tools under test are actually registered.
describe("MCP Response Syntax — tool registration sanity check", () => {
	it("all tested tools are registered", () => {
		const definitions = getSTToolDefinitions();
		const names = definitions.map((d: { name: string }) => d.name);
		for (const tool of [
			"get_version",
			"search",
			"health",
			"references",
			"call_hierarchy",
			"metrics",
			"get_graph",
			"global_vars",
			"list_file_entities",
			"get_entity_source",
		]) {
			assert.ok(
				names.includes(tool),
				`registered tools should include ${tool}`,
			);
		}
	});
});
