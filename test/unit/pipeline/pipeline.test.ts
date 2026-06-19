/**
 * Unit тесты для Pipeline Pattern
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	type Logger,
	Pipeline,
	type Stage,
	StageError,
} from "../../../src/core/pipeline";

// === Mock Logger ===
class MockLogger implements Logger {
	info() {}
	warn() {}
	error() {}
	debug() {}
}

// === Test Stages ===

class MultiplyStage implements Stage<number, number> {
	readonly name = "Multiply";
	constructor(private factor: number) {}
	async execute(input: number): Promise<number> {
		return input * this.factor;
	}
}

class AddStage implements Stage<number, number> {
	readonly name = "Add";
	constructor(private value: number) {}
	async execute(input: number): Promise<number> {
		return input + this.value;
	}
}

class FailingStage implements Stage<number, number> {
	readonly name = "Failing";
	async execute(_input: number): Promise<number> {
		throw new Error("Intentional failure");
	}
}

// === Tests ===

describe("Pipeline", () => {
	let logger: Logger;

	beforeEach(() => {
		logger = new MockLogger();
	});

	it("should execute all stages in order", async () => {
		const pipeline = new Pipeline<number, number>(logger)
			.addStage(new MultiplyStage(2))
			.addStage(new AddStage(3));

		const result = await pipeline.execute(5); // (5 * 2) + 3 = 13
		assert.strictEqual(result, 13);
	});

	it("should throw StageError on failure", async () => {
		const pipeline = new Pipeline<number, number>(logger).addStage(
			new FailingStage(),
		);

		await assert.rejects(() => pipeline.execute(5), StageError);
	});

	it("should include stage name in StageError", async () => {
		const pipeline = new Pipeline<number, number>(logger).addStage(
			new FailingStage(),
		);

		try {
			await pipeline.execute(5);
			assert.fail("Should have thrown");
		} catch (error) {
			assert.ok(error instanceof StageError);
			assert.strictEqual((error as StageError).stageName, "Failing");
		}
	});

	it("should include original error in StageError", async () => {
		const pipeline = new Pipeline<number, number>(logger).addStage(
			new FailingStage(),
		);

		try {
			await pipeline.execute(5);
			assert.fail("Should have thrown");
		} catch (error) {
			assert.strictEqual(
				(error as StageError).originalError.message,
				"Intentional failure",
			);
		}
	});

	it("should return stage names", () => {
		const pipeline = new Pipeline<number, number>(logger)
			.addStage(new MultiplyStage(2))
			.addStage(new AddStage(3));

		assert.deepStrictEqual(pipeline.getStageNames(), ["Multiply", "Add"]);
	});

	it("should pass transformed data between stages", async () => {
		const results: number[] = [];

		class CaptureStage implements Stage<number, number> {
			readonly name = "Capture";
			async execute(input: number): Promise<number> {
				results.push(input);
				return input;
			}
		}

		const pipeline = new Pipeline<number, number>(logger)
			.addStage(new MultiplyStage(10))
			.addStage(new CaptureStage())
			.addStage(new AddStage(5));

		await pipeline.execute(3);

		assert.deepStrictEqual(results, [30]); // 3 * 10 = 30
	});
});
