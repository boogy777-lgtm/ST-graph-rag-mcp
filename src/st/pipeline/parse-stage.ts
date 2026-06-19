import type { LSPClient } from "../../lsp/client";
import { type Entity, symbolsToEntities } from "../entity-extractor";

export interface ParseResult {
	entities: Entity[];
}

export async function parseStage(
	lspClient: LSPClient,
	uri: string,
	filePath: string,
	comments: string[],
): Promise<ParseResult> {
	const symbols = await lspClient.getDocumentSymbols(uri);
	const entities = symbolsToEntities(symbols || [], filePath, comments);
	return { entities };
}
