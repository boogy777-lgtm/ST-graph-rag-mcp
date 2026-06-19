import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const bundlePath = path.resolve(
  process.cwd(),
  "docs/demo/assets/ide-monaco.20260215.js",
);
const bundle = fs.readFileSync(bundlePath, "utf8");

test("demo monaco bundle contains references controller", () => {
  assert.match(bundle, /editor\.contrib\.referencesController/);
});

test("demo monaco bundle contains rename controller", () => {
  assert.match(bundle, /editor\.contrib\.renameController/);
});

test("demo monaco bundle contains rename action id", () => {
  assert.match(bundle, /editor\.action\.rename/);
});
