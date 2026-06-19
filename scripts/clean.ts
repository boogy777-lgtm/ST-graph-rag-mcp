/**
 * Clean script: remove dist/ directory.
 *
 * Replaces `rimraf dist` in v3.0 (rimraf is uninstalled).
 * Usage: bun run scripts/clean.ts
 */

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const distDir = resolve(projectRoot, "dist");

if (existsSync(distDir)) {
	rmSync(distDir, { recursive: true, force: true });
	console.log("[clean] removed dist/");
} else {
	console.log("[clean] dist/ does not exist (no-op)");
}
