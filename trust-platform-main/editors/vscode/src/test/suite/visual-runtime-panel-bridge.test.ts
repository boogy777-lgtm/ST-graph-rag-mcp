import * as assert from "assert";
import * as vscode from "vscode";
import {
	isRuntimePanelWebviewMessage,
	runtimePanelModeToUi,
	runtimePanelStatusFromState,
	runtimeUiModeToPanel,
} from "../../visual/runtime/runtimePanelBridge";

suite("Visual runtime panel bridge", () => {
	test("validates shared runtime panel message schema", () => {
		assert.strictEqual(
			isRuntimePanelWebviewMessage({ type: "runtimeStart" }),
			true,
		);
		assert.strictEqual(
			isRuntimePanelWebviewMessage({
				type: "runtimeSetMode",
				mode: "simulate",
			}),
			true,
		);
		assert.strictEqual(
			isRuntimePanelWebviewMessage({ type: "runtimeSetMode", mode: "online" }),
			true,
		);
		assert.strictEqual(
			isRuntimePanelWebviewMessage({
				type: "writeInput",
				address: "%IX0.0",
				value: "TRUE",
			}),
			true,
		);
		assert.strictEqual(
			isRuntimePanelWebviewMessage({
				type: "forceInput",
				address: "%IX0.1",
				value: "FALSE",
			}),
			true,
		);
		assert.strictEqual(
			isRuntimePanelWebviewMessage({ type: "releaseInput", address: "%IX0.0" }),
			true,
		);
		assert.strictEqual(
			isRuntimePanelWebviewMessage({ type: "runtimeSetMode", mode: "invalid" }),
			false,
		);
		assert.strictEqual(
			isRuntimePanelWebviewMessage({ type: "writeInput", address: "%IX0.0" }),
			false,
		);
	});

	test("maps runtime mode consistently", () => {
		assert.strictEqual(runtimeUiModeToPanel("local"), "simulate");
		assert.strictEqual(runtimeUiModeToPanel("external"), "online");
		assert.strictEqual(runtimePanelModeToUi("simulate"), "local");
		assert.strictEqual(runtimePanelModeToUi("online"), "external");
	});

	test("derives runtime status payload from shared runtime ui state", () => {
		const resource = vscode.Uri.file("/tmp/runtime-panel-bridge.st");
		const localIdle = runtimePanelStatusFromState(resource, {
			mode: "local",
			isExecuting: false,
			status: "idle",
		});
		assert.strictEqual(localIdle.runtimeMode, "simulate");
		assert.strictEqual(localIdle.runtimeState, "stopped");
		assert.strictEqual(localIdle.running, false);

		const externalRunning = runtimePanelStatusFromState(resource, {
			mode: "external",
			isExecuting: true,
			status: "running",
		});
		assert.strictEqual(externalRunning.runtimeMode, "online");
		assert.strictEqual(externalRunning.runtimeState, "connected");
		assert.strictEqual(externalRunning.running, true);
	});
});
