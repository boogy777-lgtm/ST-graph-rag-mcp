import * as assert from "assert";

import {
	isLocalControlEndpoint,
	parseControlEndpoint,
} from "../../runtimeControl";
import {
	buildRuntimeSourceOptions,
	normalizeStringArray,
} from "../../runtimeSourceOptions";

suite("Runtime Shared Utilities", () => {
	test("parseControlEndpoint accepts valid tcp endpoints", () => {
		const parsed = parseControlEndpoint("tcp://127.0.0.1:9222");
		assert.deepStrictEqual(parsed, {
			kind: "tcp",
			host: "127.0.0.1",
			port: 9222,
		});
	});

	test("parseControlEndpoint rejects invalid tcp endpoints", () => {
		assert.strictEqual(parseControlEndpoint("tcp://localhost"), undefined);
		assert.strictEqual(parseControlEndpoint("tcp://localhost:0"), undefined);
		assert.strictEqual(parseControlEndpoint("tcp://:9222"), undefined);
	});

	test("parseControlEndpoint handles unix endpoints on non-windows", () => {
		const parsed = parseControlEndpoint("unix:///tmp/trust.sock");
		if (process.platform === "win32") {
			assert.strictEqual(parsed, undefined);
			return;
		}
		assert.deepStrictEqual(parsed, { kind: "unix", path: "/tmp/trust.sock" });
	});

	test("isLocalControlEndpoint only accepts local addresses", () => {
		assert.strictEqual(isLocalControlEndpoint("tcp://localhost:9222"), true);
		assert.strictEqual(isLocalControlEndpoint("tcp://127.0.0.1:9222"), true);
		assert.strictEqual(
			isLocalControlEndpoint("tcp://192.168.0.10:9222"),
			false,
		);
	});

	test("normalizeStringArray trims and filters non-string values", () => {
		const result = normalizeStringArray(["  a  ", "", 1, "b", "   "]);
		assert.deepStrictEqual(result, ["a", "b"]);
	});

	test("buildRuntimeSourceOptions applies defaults when include globs missing", () => {
		const result = buildRuntimeSourceOptions({
			includeGlobs: undefined,
			excludeGlobs: ["  **/target/**  "],
			ignorePragmas: [" @foo ", ""],
			runtimeRoot: "/workspace",
		});
		assert.deepStrictEqual(result, {
			runtimeIncludeGlobs: ["**/*.{st,ST,pou,POU}"],
			runtimeExcludeGlobs: ["**/target/**"],
			runtimeIgnorePragmas: ["@foo"],
			runtimeRoot: "/workspace",
		});
	});

	test("buildRuntimeSourceOptions preserves explicit include globs", () => {
		const result = buildRuntimeSourceOptions({
			includeGlobs: [" **/*.st ", "**/*.pou"],
			excludeGlobs: [],
			ignorePragmas: [],
			runtimeRoot: undefined,
		});
		assert.deepStrictEqual(result.runtimeIncludeGlobs, ["**/*.st", "**/*.pou"]);
	});
});
