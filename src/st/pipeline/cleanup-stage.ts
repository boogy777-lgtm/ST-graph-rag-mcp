import type { LSPClient } from "../../lsp/client";

export async function cleanupStage(
	lspClient: LSPClient,
	uri: string,
): Promise<void> {
	try {
		await lspClient.closeDocument(uri);
	} catch (e) {
		console.error(`[Pipeline] Failed to close document ${uri}:`, e);
	}
}
