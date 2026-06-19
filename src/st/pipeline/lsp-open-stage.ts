import type { LSPClient } from "../../lsp/client";
import { LSPReadyPoller, LSPTimeoutError } from "../../lsp/poller";

export interface LSPOpenResult {
	lspClient: LSPClient;
	documentOpened: boolean;
}

export async function lspOpenStage(
	lspClient: LSPClient,
	uri: string,
	strippedContent: string,
): Promise<LSPOpenResult> {
	await lspClient.openDocument(uri, strippedContent);

	const poller = new LSPReadyPoller(lspClient);
	try {
		const iterations = await poller.waitForDocumentReady(uri);
		if (iterations > 1) {
			console.error(
				`[Pipeline] LSP ready for ${uri} after ${iterations} polls`,
			);
		}
	} catch (err) {
		if (err instanceof LSPTimeoutError) {
			console.error(
				`[Pipeline] LSP timeout for ${uri}, proceeding with available data`,
			);
		} else {
			throw err;
		}
	}

	return { lspClient, documentOpened: true };
}
