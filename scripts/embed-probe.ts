import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve("src/ui-embed.gen.ts"), "utf8");

const checks: ReadonlyArray<readonly [string, boolean]> = [
	[
		"Single literal export (no mutation)",
		/export const UI_ASSETS = Object\.freeze\(/.test(src),
	],
	[
		"No top-level mutation (UI_ASSETS[k] = ...)",
		!/UI_ASSETS\[.*\] =/.test(src),
	],
	["Has /index.html key", src.includes('"/index.html"')],
	["Has /assets/ keys", /"\/assets\//.test(src)],
	["Uses Readonly<...> type assertion", src.includes("as Readonly<Record<")],
	[
		"No require() or import() at top level",
		!/^(import\(|require\()/m.test(src),
	],
	[
		"Closes with single Object.freeze",
		(src.match(/Object\.freeze\(/g) || []).length >= 2,
	],
];

let allPass = true;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (!ok) allPass = false;
}
process.exit(allPass ? 0 : 1);
