import * as assert from "assert";
import {
	clampRightPaneWidth,
	RIGHT_PANE_WIDTHS_STATE_KEY,
	resolveInitialRightPaneWidth,
	rightPaneStorageKey,
} from "../../visual/runtime/rightPaneResize";

suite("Visual right pane resize", () => {
	const limits = {
		minWidth: 280,
		maxWidth: 720,
		defaultWidth: 360,
	};

	test("clamps widths to configured bounds", () => {
		assert.strictEqual(clampRightPaneWidth(100, limits), 280);
		assert.strictEqual(clampRightPaneWidth(999, limits), 720);
		assert.strictEqual(clampRightPaneWidth(481.2, limits), 481);
	});

	test("prefers VS Code webview state over local storage", () => {
		const value = resolveInitialRightPaneWidth(
			"ladder",
			limits,
			{
				[RIGHT_PANE_WIDTHS_STATE_KEY]: {
					ladder: 512,
				},
			},
			"640",
		);
		assert.strictEqual(value, 512);
	});

	test("falls back to local storage when VS Code state is missing", () => {
		const value = resolveInitialRightPaneWidth("statechart", limits, {}, "640");
		assert.strictEqual(value, 640);
	});

	test("falls back to default width for invalid persisted values", () => {
		const value = resolveInitialRightPaneWidth(
			"blockly",
			limits,
			{
				[RIGHT_PANE_WIDTHS_STATE_KEY]: {
					blockly: "abc",
				},
			},
			"NaN",
		);
		assert.strictEqual(value, 360);
	});

	test("builds stable storage keys", () => {
		assert.strictEqual(
			rightPaneStorageKey("ladder"),
			"trust-lsp.right-pane-width.ladder",
		);
		assert.strictEqual(
			rightPaneStorageKey("statechart"),
			"trust-lsp.right-pane-width.statechart",
		);
		assert.strictEqual(
			rightPaneStorageKey("blockly"),
			"trust-lsp.right-pane-width.blockly",
		);
	});
});
