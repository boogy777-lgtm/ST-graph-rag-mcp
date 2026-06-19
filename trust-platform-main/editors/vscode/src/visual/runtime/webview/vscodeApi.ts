export interface VSCodeWebviewApi {
	postMessage: (message: unknown) => void;
	getState?: () => unknown;
	setState?: (state: unknown) => void;
}

declare const acquireVsCodeApi: undefined | (() => VSCodeWebviewApi);

const DEFAULT_VSCODE_API: VSCodeWebviewApi = {
	postMessage: () => undefined,
};

const VSCODE_API_GLOBAL_KEY = "__trust_lsp_vscode_api__";

type VSCodeGlobal = typeof globalThis & {
	[VSCODE_API_GLOBAL_KEY]?: VSCodeWebviewApi;
};

export function getVsCodeApi(): VSCodeWebviewApi {
	const globalScope = globalThis as VSCodeGlobal;
	const cachedApi = globalScope[VSCODE_API_GLOBAL_KEY];

	if (cachedApi) {
		return cachedApi;
	}

	if (typeof acquireVsCodeApi === "function") {
		const api = acquireVsCodeApi();
		globalScope[VSCODE_API_GLOBAL_KEY] = api;
		return api;
	}

	globalScope[VSCODE_API_GLOBAL_KEY] = DEFAULT_VSCODE_API;
	return DEFAULT_VSCODE_API;
}
