import {
	extractExtendsImplements,
	extractPOUEndLines,
	extractVariablesWithDirections,
} from "../indexer";

export interface ExtractResult {
	varsByScope: ReturnType<typeof extractVariablesWithDirections>;
	extendsImplements: ReturnType<typeof extractExtendsImplements>;
	pouEndLines: ReturnType<typeof extractPOUEndLines>;
}

export function extractStage(originalContent: string): ExtractResult {
	return {
		varsByScope: extractVariablesWithDirections(originalContent),
		extendsImplements: extractExtendsImplements(originalContent),
		pouEndLines: extractPOUEndLines(originalContent),
	};
}
