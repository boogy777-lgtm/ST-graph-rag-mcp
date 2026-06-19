/**
 * Unit тесты для ToolHandler (Template Method Pattern)
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { z } from "zod";
import type { RepositoryRegistry } from "../../../src/core/pipeline/stages/StoreStage";
import {
	type ToolContext,
	type ToolDefinition,
	ToolHandler,
} from "../../../src/mcp/handlers/tool-handler/ToolHandler";

// === Mock RepositoryRegistry ===
function createMockRegistry(): RepositoryRegistry {
	return {
		pou: {
			findById: async () => null,
			findAll: async () => [],
			save: async () => {},
			delete: async () => {},
		} as any,
		variable: {} as any,
		type: {} as any,
		relationship: {} as any,
		file: {} as any,
	};
}

// === Test Handler ===
const TestSchema = z.object({
	name: z.string(),
	value: z.number().optional(),
});

class TestHandler extends ToolHandler<
	{ name: string; value?: number },
	string
> {
	protected readonly name = "test";
	protected readonly description = "Test handler";
	protected readonly inputSchema = TestSchema;

	executeCallCount = 0;

	constructor(context: ToolContext) {
		super(context);
	}

	protected async execute(args: {
		name: string;
		value?: number;
	}): Promise<string> {
		this.executeCallCount++;
		return `Hello, ${args.name}! value=${args.value ?? 0}`;
	}
}

// === Tests ===

describe("ToolHandler (Template Method)", () => {
	let context: ToolContext;

	beforeEach(() => {
		context = {
			repositories: createMockRegistry(),
			logger: console,
		};
	});

	it("should validate args before execute", async () => {
		const handler = new TestHandler(context);

		await assert.rejects(
			() => handler.handle({ name: 123 as any }),
			z.ZodError,
		);
	});

	it("should execute and return result", async () => {
		const handler = new TestHandler(context);

		const result = await handler.handle({ name: "World" });
		assert.strictEqual(result, "Hello, World! value=0");
	});

	it("should call execute once", async () => {
		const handler = new TestHandler(context);

		await handler.handle({ name: "Test", value: 42 });
		assert.strictEqual(handler.executeCallCount, 1);
	});

	it("should get definition", () => {
		const handler = new TestHandler(context);
		const def: ToolDefinition = handler.getDefinition();

		assert.strictEqual(def.name, "test");
		assert.strictEqual(def.description, "Test handler");
		assert.strictEqual(def.inputSchema, TestSchema);
		assert.strictEqual(typeof def.handler, "function");
	});

	it("should handle errors and rethrow", async () => {
		class FailingHandler extends ToolHandler<{ name: string }, string> {
			protected readonly name = "failing";
			protected readonly description = "Failing";
			protected readonly inputSchema = z.object({ name: z.string() });

			constructor(ctx: ToolContext) {
				super(ctx);
			}

			protected async execute(): Promise<string> {
				throw new Error("Test error");
			}
		}

		const handler = new FailingHandler(context);
		await assert.rejects(
			() => handler.handle({ name: "test" }),
			(err: Error) => err.message === "Test error",
		);
	});
});
