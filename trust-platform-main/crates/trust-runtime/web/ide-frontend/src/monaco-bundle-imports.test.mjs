import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourcePath = path.join(__dirname, "monaco-bundle.ts");
const source = fs.readFileSync(sourcePath, "utf8");

const requiredImports = [
  "monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/goToCommands",
  "monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition",
  "monaco-editor/esm/vs/editor/contrib/rename/browser/rename",
  "monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch",
];

for (const modulePath of requiredImports) {
  test(`monaco bundle keeps required contribution import: ${modulePath}`, () => {
    assert.match(
      source,
      new RegExp(`import\\s+"${modulePath.replaceAll("/", "\\/")}";`),
    );
  });
}
