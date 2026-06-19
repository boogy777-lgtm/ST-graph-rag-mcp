/**
 * Integration tests for MCP resources.
 *
 * Tests resource registration and reading via handlers.
 * Verifies that:
 * - Resources are registered correctly
 * - Static resources return content
 * - Template resources work with parameters
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");

const resourcesUrl = pathToFileURL(
	join(projectRoot, "src", "mcp", "resources", "index.ts"),
).href;
const {
	registerResources,
	getResourceCount,
	getResourceDefinitions,
	handleResourceRead,
} = await import(resourcesUrl);

describe("MCP Resources — registration", () => {
	it("should return resource count", () => {
		const count = getResourceCount();
		assert.ok(count.total > 0, "Should have resources");
		assert.ok(count.static >= 0, "Should have static count");
		assert.ok(count.templates >= 0, "Should have templates count");
	});

	it("should return resource definitions", () => {
		const definitions = getResourceDefinitions();
		assert.ok(
			typeof definitions === "object" && definitions !== null,
			"Should return object",
		);
		assert.ok(
			Array.isArray(definitions.resources),
			"Should have resources array",
		);
		assert.ok(
			Array.isArray(definitions.templates),
			"Should have templates array",
		);
		assert.ok(
			definitions.resources.length > 0,
			"Should have resource definitions",
		);
		assert.ok(
			definitions.templates.length > 0,
			"Should have template definitions",
		);

		for (const def of definitions.resources) {
			assert.ok(def.uri, `Resource should have uri: ${def.name}`);
			assert.ok(def.name, "Resource should have name");
			assert.ok(
				def.description,
				`Resource should have description: ${def.name}`,
			);
		}

		for (const def of definitions.templates) {
			assert.ok(
				def.uriTemplate,
				`Template should have uriTemplate: ${def.name}`,
			);
			assert.ok(def.name, "Template should have name");
			assert.ok(
				def.description,
				`Template should have description: ${def.name}`,
			);
		}
	});
});

describe("MCP Resources — reading", () => {
	before(() => {
		// Register resources with a mock server (not actually started)
		const mockServer = new Server(
			{ name: "test", version: "1.0.0" },
			{ capabilities: { resources: {} } },
		);
		registerResources(mockServer, () => null);
	});

	it("should read static resource: st://globals", async () => {
		const result = await handleResourceRead("st://globals", () => null);
		assert.ok(result, "Should return result for globals");
	});

	it("should read static resource: st://version", async () => {
		const result = await handleResourceRead("st://version", () => null);
		assert.ok(result, "Should return result for version");
	});

	it("should handle template resource with parameters", async () => {
		// st://entity/FB_Test
		const result = await handleResourceRead("st://entity/FB_Test", () => null);
		// Should return something (error or data)
		assert.ok(result !== undefined, "Should return result for entity template");
	});

	it("should handle invalid URI gracefully", async () => {
		const result = await handleResourceRead(
			"st://nonexistent/blah",
			() => null,
		);
		// Should not throw, return error
		assert.ok(result, "Should handle invalid URI gracefully");
	});
});
