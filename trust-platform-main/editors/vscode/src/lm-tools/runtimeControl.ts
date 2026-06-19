import * as net from "net";
import * as vscode from "vscode";

import { parseControlEndpoint } from "../runtimeControl";
import { defaultRuntimeControlEndpoint } from "../runtimeDefaults";

export type RuntimeControlRequestHandler = (
	endpoint: string,
	authToken: string | undefined,
	requestType: string,
	params: unknown,
	token: vscode.CancellationToken,
	timeoutMs?: number,
) => Promise<unknown>;

let controlRequestSeq = 1;

function runtimeEndpointSettings(rootPath: string): {
	endpoint: string;
	authToken: string | undefined;
} {
	const config = vscode.workspace.getConfiguration(
		"trust-lsp",
		vscode.Uri.file(rootPath),
	);
	const endpointEnabled = config.get<boolean>(
		"runtime.controlEndpointEnabled",
		true,
	);
	const configured = endpointEnabled
		? (config.get<string>("runtime.controlEndpoint") ?? "").trim()
		: "";
	const endpoint = configured || defaultRuntimeControlEndpoint();
	const auth = (config.get<string>("runtime.controlAuthToken") ?? "").trim();
	return {
		endpoint,
		authToken: auth.length > 0 ? auth : undefined,
	};
}

export async function sendRuntimeControlRequest(
	endpoint: string,
	authToken: string | undefined,
	requestType: string,
	params: unknown,
	token: vscode.CancellationToken,
	timeoutMs = 2000,
): Promise<unknown> {
	if (token.isCancellationRequested) {
		throw new Error("Cancelled.");
	}
	const parsed = parseControlEndpoint(endpoint);
	if (!parsed) {
		throw new Error(`invalid control endpoint '${endpoint}'`);
	}
	const requestEnvelope = {
		id: controlRequestSeq++,
		type: requestType,
		params,
		auth: authToken,
	};
	return await new Promise<unknown>((resolve, reject) => {
		let settled = false;
		let buffer = "";
		const socket =
			parsed.kind === "tcp"
				? net.createConnection({ host: parsed.host, port: parsed.port })
				: net.createConnection({ path: parsed.path });
		const disposables: vscode.Disposable[] = [];

		const finish = (callback: () => void): void => {
			if (settled) {
				return;
			}
			settled = true;
			socket.destroy();
			for (const disposable of disposables) {
				disposable.dispose();
			}
			callback();
		};

		socket.setTimeout(timeoutMs, () => {
			finish(() => reject(new Error("control request timeout")));
		});
		socket.once("error", (error) => {
			finish(() => reject(error));
		});
		socket.once("connect", () => {
			socket.write(`${JSON.stringify(requestEnvelope)}\n`);
		});
		socket.on("data", (chunk: Buffer | string) => {
			buffer += chunk.toString();
			let newlineIndex = buffer.indexOf("\n");
			while (newlineIndex !== -1) {
				const line = buffer.slice(0, newlineIndex).trim();
				buffer = buffer.slice(newlineIndex + 1);
				if (line.length > 0) {
					try {
						const parsedLine = JSON.parse(line) as {
							ok?: boolean;
							result?: unknown;
							error?: unknown;
							code?: unknown;
						};
						if (parsedLine.ok) {
							finish(() => resolve(parsedLine.result));
						} else {
							const code =
								typeof parsedLine.code === "string" && parsedLine.code.trim()
									? parsedLine.code.trim()
									: undefined;
							const detail =
								typeof parsedLine.error === "string" && parsedLine.error.trim()
									? parsedLine.error.trim()
									: "control request rejected";
							finish(() =>
								reject(new Error(code ? `${code}: ${detail}` : detail)),
							);
						}
						return;
					} catch (error) {
						finish(() => reject(error));
						return;
					}
				}
				newlineIndex = buffer.indexOf("\n");
			}
		});

		disposables.push(
			token.onCancellationRequested(() => {
				finish(() => reject(new Error("Cancelled.")));
			}),
		);
	});
}

let runtimeControlRequest: RuntimeControlRequestHandler =
	sendRuntimeControlRequest;

export function setRuntimeControlRequestHandler(
	handler?: RuntimeControlRequestHandler,
): void {
	runtimeControlRequest = handler ?? sendRuntimeControlRequest;
}

export async function requestRuntimeControl(
	rootPath: string,
	token: vscode.CancellationToken,
	requestType: string,
	params: unknown,
): Promise<unknown> {
	const settings = runtimeEndpointSettings(rootPath);
	return await runtimeControlRequest(
		settings.endpoint,
		settings.authToken,
		requestType,
		params,
		token,
	);
}
