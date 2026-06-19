/**
 * truST LSP Client
 *
 * JSON-RPC client for truST Language Server.
 * Handles lifecycle, message parsing, and request/response correlation.
 *
 * v3.0: Migrated from `child_process.spawn` to `Bun.spawn` for full Bun-native
 * operation. The `Subprocess` type from Bun replaces Node's `ChildProcess`.
 *
 * Bun.spawn differences vs Node child_process:
 *   - stdin: "pipe" returns a FileSink (not a WritableStream)
 *   - stdout/stderr: "pipe" returns a ReadableStream<Uint8Array> (or number for fd)
 *   - process events: use `proc.exited` (Promise<number>) instead of "exit" event
 *   - kill(): same signature, returns void
 */

import { EventEmitter } from "node:events";
import type { Subprocess } from "bun";

export interface LSPPosition {
	line: number;
	character: number;
}

export interface LSPRange {
	start: LSPPosition;
	end: LSPPosition;
}

export interface LSPLocation {
	uri: string;
	range: LSPRange;
}

export interface LSPSymbol {
	name: string;
	kind: number;
	location?: LSPLocation;
	range?: LSPRange;
	selectionRange?: LSPRange;
	containerName?: string;
	children?: LSPSymbol[];
	detail?: string;
}

export interface LSPDiagnostic {
	range: LSPRange;
	severity?: number;
	code?: string | number;
	message: string;
	source?: string;
}

export interface LSPReference {
	uri: string;
	range: LSPRange;
}

export interface LSPCallHierarchyItem {
	name: string;
	kind: number;
	uri: string;
	range: LSPRange;
	selectionRange: LSPRange;
	detail?: string;
	data?: unknown;
}

export interface LSPCallHierarchyIncomingCall {
	from: LSPCallHierarchyItem;
	fromRanges: LSPRange[];
}

export interface LSPCallHierarchyOutgoingCall {
	to: LSPCallHierarchyItem;
	fromRanges: LSPRange[];
}

export interface LSPTypeHierarchyItem {
	name: string;
	kind: number;
	uri: string;
	range: LSPRange;
	selectionRange: LSPRange;
	detail?: string;
	data?: unknown;
}

interface PendingRequest {
	resolve: (value: any) => void;
	reject: (error: Error) => void;
	method: string;
	timer: ReturnType<typeof setTimeout>;
}

/** Type guard: is this a ReadableStream? */
function isReadableStream(
	x: ReadableStream<Uint8Array> | number | undefined,
): x is ReadableStream<Uint8Array> {
	return x !== undefined && typeof x !== "number";
}

/** Type guard: is this a FileSink (Bun's Writable stdin)? */
function isFileSink(
	x: unknown,
): x is { write: (chunk: string) => number | Promise<number> } {
	return (
		x !== null &&
		typeof x === "object" &&
		typeof (x as { write?: unknown }).write === "function"
	);
}

export class LSPClient extends EventEmitter {
	private process: Subprocess<"pipe", "pipe", "pipe"> | null = null;
	private buffer = Buffer.alloc(0);
	private messageId = 0;
	private pendingRequests = new Map<number, PendingRequest>();
	private diagnostics = new Map<string, LSPDiagnostic[]>();
	private _isRunning = false;

	constructor(
		private lspPath: string,
		private requestTimeoutMs: number = 300_000,
	) {
		super();
	}

	async start(): Promise<void> {
		// Bun.spawn with stdio:"pipe" returns a Subprocess<"pipe","pipe","pipe">.
		// stdin: FileSink, stdout/stderr: ReadableStream<Uint8Array>
		this.process = Bun.spawn([this.lspPath, "--stdio"], {
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, RUST_BACKTRACE: "1" },
		}) as Subprocess<"pipe", "pipe", "pipe">;

		this._isRunning = true;

		// Read stdout asynchronously.
		this.readStdout();

		// Read stderr (best-effort logging).
		this.readStderr();

		// Bun.spawn uses `proc.exited` (Promise) instead of "exit" event.
		this.process.exited.then((code) => {
			this._isRunning = false;
			this.rejectAllPending(`LSP process exited with code ${code}`);
			this.emit("exit", code);
		});
	}

	private async readStdout(): Promise<void> {
		if (!this.process?.stdout) return;
		if (!isReadableStream(this.process.stdout)) {
			console.warn("[LSPClient] stdout is not a ReadableStream");
			return;
		}
		const reader = this.process.stdout.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				this.handleData(Buffer.from(value));
			}
		} catch (e) {
			this.emit("error", e);
		}
	}

	private async readStderr(): Promise<void> {
		if (!this.process?.stderr) return;
		if (!isReadableStream(this.process.stderr)) return;
		const reader = this.process.stderr.getReader();
		const decoder = new TextDecoder();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				this.emit("log", decoder.decode(value));
			}
		} catch {
			// Ignore stderr read errors
		}
	}

	isRunning(): boolean {
		return this._isRunning;
	}

	async stop(): Promise<void> {
		if (!this.process) return;

		this._isRunning = false;

		for (const [, req] of this.pendingRequests) {
			clearTimeout(req.timer);
		}
		this.pendingRequests.clear();

		try {
			await this.sendRequest("shutdown", {});
		} catch {
			// Ignore shutdown errors
		}

		this.sendNotification("exit", {});
		this.process.kill();
		this.process = null;
	}

	private rejectAllPending(message: string): void {
		for (const [, req] of this.pendingRequests) {
			clearTimeout(req.timer);
			req.reject(new Error(message));
		}
		this.pendingRequests.clear();
	}

	async initialize(rootUri: string): Promise<any> {
		return this.sendRequest("initialize", {
			processId: process.pid,
			clientInfo: { name: "code-graph-rag-mcp", version: "3.0.0" },
			rootUri,
			workspaceFolders: [{ uri: rootUri, name: "st-workspace" }],
			capabilities: {
				textDocument: {
					documentSymbol: { dynamicRegistration: false },
					publishDiagnostics: { relatedInformation: false },
					callHierarchy: { dynamicRegistration: false },
					typeHierarchy: { dynamicRegistration: false },
				},
				workspace: { workspaceFolders: true },
			},
		});
	}

	async openDocument(uri: string, text: string): Promise<void> {
		this.sendNotification("textDocument/didOpen", {
			textDocument: {
				uri,
				languageId: "st",
				version: 1,
				text,
			},
		});
	}

	async closeDocument(uri: string): Promise<void> {
		this.sendNotification("textDocument/didClose", {
			textDocument: { uri },
		});
	}

	async getWorkspaceSymbols(query: string): Promise<LSPSymbol[]> {
		return this.sendRequest("workspace/symbol", { query });
	}

	async getDocumentSymbols(uri: string): Promise<LSPSymbol[]> {
		return this.sendRequest("textDocument/documentSymbol", {
			textDocument: { uri },
		});
	}

	async getReferences(
		uri: string,
		position: LSPPosition,
	): Promise<LSPReference[]> {
		return this.sendRequest("textDocument/references", {
			textDocument: { uri },
			position,
			context: { includeDeclaration: true },
		});
	}

	async getDefinition(uri: string, position: LSPPosition): Promise<any> {
		return this.sendRequest("textDocument/definition", {
			textDocument: { uri },
			position,
		});
	}

	async prepareCallHierarchy(
		uri: string,
		position: LSPPosition,
	): Promise<LSPCallHierarchyItem[]> {
		return this.sendRequest("textDocument/prepareCallHierarchy", {
			textDocument: { uri },
			position,
		}).catch(() => []);
	}

	async getCallHierarchyIncomingCalls(
		item: LSPCallHierarchyItem,
	): Promise<LSPCallHierarchyIncomingCall[]> {
		return this.sendRequest("callHierarchy/incomingCalls", { item }).catch(
			() => [],
		);
	}

	async getCallHierarchyOutgoingCalls(
		item: LSPCallHierarchyItem,
	): Promise<LSPCallHierarchyOutgoingCall[]> {
		return this.sendRequest("callHierarchy/outgoingCalls", { item }).catch(
			() => [],
		);
	}

	async prepareTypeHierarchy(
		uri: string,
		position: LSPPosition,
	): Promise<LSPTypeHierarchyItem[]> {
		return this.sendRequest("textDocument/prepareTypeHierarchy", {
			textDocument: { uri },
			position,
		}).catch(() => []);
	}

	async getTypeHierarchySupertypes(
		item: LSPTypeHierarchyItem,
	): Promise<LSPTypeHierarchyItem[]> {
		return this.sendRequest("typeHierarchy/supertypes", { item }).catch(
			() => [],
		);
	}

	async getTypeHierarchySubtypes(
		item: LSPTypeHierarchyItem,
	): Promise<LSPTypeHierarchyItem[]> {
		return this.sendRequest("typeHierarchy/subtypes", { item }).catch(() => []);
	}

	getDiagnostics(uri: string): LSPDiagnostic[] {
		return this.diagnostics.get(uri) || [];
	}

	private handleData(data: Buffer): void {
		this.buffer = Buffer.concat([this.buffer, data]);

		while (true) {
			const headerMatch = this.buffer
				.toString()
				.match(/^Content-Length: (\d+)\r\n\r\n/);
			if (!headerMatch) break;

			const contentLength = parseInt(headerMatch[1]);
			const headerEnd = headerMatch[0].length;

			if (this.buffer.length < headerEnd + contentLength) break;

			const content = this.buffer.subarray(
				headerEnd,
				headerEnd + contentLength,
			);
			this.buffer = this.buffer.subarray(headerEnd + contentLength);

			try {
				const response = JSON.parse(content.toString("utf8"));

				if (
					response.method === "textDocument/publishDiagnostics" &&
					response.params
				) {
					const uri = response.params.uri;
					this.diagnostics.set(uri, response.params.diagnostics || []);
					this.emit("diagnostics", uri, response.params.diagnostics);
				} else if (response.id && this.pendingRequests.has(response.id)) {
					const req = this.pendingRequests.get(response.id)!;
					clearTimeout(req.timer);
					this.pendingRequests.delete(response.id);

					if (response.error) {
						req.reject(new Error(response.error.message));
					} else {
						req.resolve(response.result);
					}
				}
			} catch (e) {
				this.emit("error", e);
			}
		}
	}

	private sendRequest(method: string, params: any): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = ++this.messageId;

			const timer = setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(
						new Error(
							`LSP request '${method}' timed out after ${this.requestTimeoutMs}ms`,
						),
					);
				}
			}, this.requestTimeoutMs);

			this.pendingRequests.set(id, { resolve, reject, method, timer });

			const msg = { jsonrpc: "2.0", id, method, params };
			const content = JSON.stringify(msg);
			const header = `Content-Length: ${Buffer.byteLength(content, "utf8")}\r\n\r\n`;

			if (!this.process?.stdin || !this._isRunning) {
				clearTimeout(timer);
				this.pendingRequests.delete(id);
				reject(new Error("LSP process not started or not running"));
				return;
			}

			// Bun FileSink.write() accepts string; returns number or Promise<number>.
			const stdin = this.process.stdin;
			if (!isFileSink(stdin)) {
				clearTimeout(timer);
				this.pendingRequests.delete(id);
				reject(new Error("LSP stdin is not a writable sink"));
				return;
			}

			try {
				const result = stdin.write(header + content);
				if (result instanceof Promise) {
					result.catch((err: unknown) => {
						clearTimeout(timer);
						this.pendingRequests.delete(id);
						reject(err instanceof Error ? err : new Error(String(err)));
					});
				}
			} catch (err) {
				clearTimeout(timer);
				this.pendingRequests.delete(id);
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		});
	}

	sendNotification(method: string, params: any): void {
		const msg = { jsonrpc: "2.0", method, params };
		const content = JSON.stringify(msg);
		const header = `Content-Length: ${Buffer.byteLength(content, "utf8")}\r\n\r\n`;

		if (!this.process?.stdin) return;
		const stdin = this.process.stdin;
		if (!isFileSink(stdin)) return;
		try {
			stdin.write(header + content);
		} catch {
			// Best-effort notification; ignore write errors
		}
	}
}
