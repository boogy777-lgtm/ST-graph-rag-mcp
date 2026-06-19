import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

// Editor contributions required by ide.js
import "monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution";
import "monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController";
import "monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestInlineCompletions";
import "monaco-editor/esm/vs/editor/contrib/parameterHints/browser/parameterHints";
import "monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching";
import "monaco-editor/esm/vs/editor/contrib/find/browser/findController";
import "monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu";
import "monaco-editor/esm/vs/editor/contrib/folding/browser/folding";
import "monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2";
import "monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations";
import "monaco-editor/esm/vs/editor/contrib/comment/browser/comment";
import "monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/goToCommands";
import "monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition";
import "monaco-editor/esm/vs/editor/contrib/rename/browser/rename";
import "monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch";

import editorCss from "monaco-editor/min/vs/editor/editor.main.css?inline";

let styleInjected = false;

function ensureStyleInjected(): void {
	if (styleInjected || typeof document === "undefined") {
		return;
	}
	const style = document.createElement("style");
	style.setAttribute("data-trust-monaco", "true");
	style.textContent = editorCss;
	document.head.appendChild(style);
	styleInjected = true;
}

export { ensureStyleInjected, monaco };
