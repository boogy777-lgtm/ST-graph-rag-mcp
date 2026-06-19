import * as assert from "assert";
import { RuntimeController } from "../../visual/runtime/runtimeController";
import {
	isRuntimeWebviewMessage,
	runtimeMessage,
} from "../../visual/runtime/runtimeMessages";

suite("Visual runtime controller", () => {
	test("tracks mode/start/stop transitions", async () => {
		const calls: string[] = [];
		const controller = new RuntimeController({
			openPanel: () => undefined,
			openSettings: () => undefined,
		});
		const adapter = {
			startLocal: async () => {
				calls.push("startLocal");
			},
			startExternal: async () => {
				calls.push("startExternal");
			},
			stop: async () => {
				calls.push("stop");
			},
		};

		const docId = "doc-1";
		assert.strictEqual(controller.ensureState(docId).mode, "local");

		controller.setMode(docId, "external");
		await controller.start(docId, adapter);
		assert.deepStrictEqual(calls, ["startExternal"]);
		assert.strictEqual(controller.ensureState(docId).isExecuting, true);
		assert.strictEqual(controller.ensureState(docId).status, "running");

		await controller.stop(docId, adapter);
		assert.deepStrictEqual(calls, ["startExternal", "stop"]);
		assert.strictEqual(controller.ensureState(docId).isExecuting, false);
		assert.strictEqual(controller.ensureState(docId).status, "stopped");
	});

	test("captures start failures in runtime state", async () => {
		const controller = new RuntimeController({
			openPanel: () => undefined,
			openSettings: () => undefined,
		});
		const adapter = {
			startLocal: async () => {
				throw new Error("connect failed");
			},
			startExternal: async () => undefined,
			stop: async () => undefined,
		};

		await assert.rejects(controller.start("doc-2", adapter), /connect failed/);
		const state = controller.ensureState("doc-2");
		assert.strictEqual(state.status, "error");
		assert.strictEqual(state.isExecuting, false);
		assert.strictEqual(state.lastError, "connect failed");
	});

	test("routes runtime panel and settings actions", async () => {
		const calls: string[] = [];
		const controller = new RuntimeController({
			openPanel: () => {
				calls.push("panel");
			},
			openSettings: () => {
				calls.push("settings");
			},
		});

		await controller.openRuntimePanel();
		await controller.openRuntimeSettings();
		assert.deepStrictEqual(calls, ["panel", "settings"]);
	});

	test("runtime message schema guard accepts shared payloads", () => {
		assert.ok(isRuntimeWebviewMessage(runtimeMessage.start()));
		assert.ok(isRuntimeWebviewMessage(runtimeMessage.stop()));
		assert.ok(isRuntimeWebviewMessage(runtimeMessage.setMode("local")));
		assert.ok(isRuntimeWebviewMessage(runtimeMessage.openPanel()));
		assert.ok(isRuntimeWebviewMessage(runtimeMessage.openSettings()));
		assert.strictEqual(
			isRuntimeWebviewMessage({ type: "runtime.setMode", mode: "invalid" }),
			false,
		);
	});
});
