// Responsibility: focused LM tools module with a single concern.
import * as vscode from "vscode";
import {
	type LmApi,
	languageModelTextPartCtor,
	languageModelToolResultCtor,
} from "./types";

export function lmAvailable(): boolean {
	const lm = (vscode as unknown as { lm?: LmApi }).lm;
	return !!(lm && languageModelToolResultCtor && languageModelTextPartCtor);
}

export function textResult(text: string): unknown {
	if (!languageModelToolResultCtor || !languageModelTextPartCtor) {
		return { text };
	}
	return new languageModelToolResultCtor([new languageModelTextPartCtor(text)]);
}

export function errorResult(message: string): unknown {
	return textResult(`Error: ${message}`);
}

export function clientUnavailableResult(): unknown {
	return errorResult("Language client is not available.");
}
