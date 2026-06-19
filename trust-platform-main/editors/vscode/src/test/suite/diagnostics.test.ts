import * as assert from "assert";
import * as vscode from "vscode";
import { augmentDiagnostic, resolveSpecDoc } from "../../diagnostics";

suite("Diagnostics IEC explainers", () => {
	test("augments diagnostics with IEC reference and spec link", () => {
		const range = new vscode.Range(
			new vscode.Position(0, 0),
			new vscode.Position(0, 1),
		);
		const diagnostic = new vscode.Diagnostic(
			range,
			"Invalid identifier",
			vscode.DiagnosticSeverity.Error,
		);
		(diagnostic as vscode.Diagnostic & { data?: any }).data = {
			explain: {
				iec: "IEC 61131-3 Ed.3 §6.1.2",
				spec: "docs/specs/01-lexical-elements.md",
			},
		};

		const updated = augmentDiagnostic(diagnostic, true) as any;
		assert.ok(updated.message.includes("IEC 61131-3"));
		const resolved = resolveSpecDoc("docs/specs/01-lexical-elements.md");
		if (resolved) {
			assert.ok(updated.codeDescription, "expected codeDescription to be set");
		} else {
			assert.ok(
				!updated.codeDescription,
				"expected codeDescription to be unset without a local spec doc",
			);
		}
	});

	test("skips IEC augmentation when disabled", () => {
		const range = new vscode.Range(
			new vscode.Position(0, 0),
			new vscode.Position(0, 1),
		);
		const diagnostic = new vscode.Diagnostic(
			range,
			"Invalid identifier",
			vscode.DiagnosticSeverity.Error,
		);
		(diagnostic as vscode.Diagnostic & { data?: any }).data = {
			explain: {
				iec: "IEC 61131-3 Ed.3 §6.1.2",
				spec: "docs/specs/01-lexical-elements.md",
			},
		};

		const updated = augmentDiagnostic(diagnostic, false);
		assert.strictEqual(updated, diagnostic);
		assert.strictEqual(updated.message, "Invalid identifier");
	});
});
