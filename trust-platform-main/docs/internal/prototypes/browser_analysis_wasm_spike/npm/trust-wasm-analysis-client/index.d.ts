export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };

export type ApplyDocumentsResult = {
  documents: Array<{ uri: string; file_id: number }>;
};

export type DiagnosticItem = {
  code: string;
  severity: string;
  message: string;
  range: Range;
  related: Array<{ range: Range; message: string }>;
};

export type HoverItem = {
  contents: string;
  range: Range | null;
} | null;

export type CompletionTextEdit = {
  range: Range;
  new_text: string;
};

export type CompletionItem = {
  label: string;
  kind: string;
  detail?: string | null;
  documentation?: string | null;
  insert_text?: string | null;
  text_edit?: CompletionTextEdit | null;
  sort_priority: number;
};

export type EngineStatus = {
  document_count: number;
  uris: string[];
};

export type ClientStatusEvent =
  | { type: "ready" }
  | { type: "startup_error"; error: string }
  | { type: "worker_error"; error: string };

export class TrustWasmAnalysisClient {
  constructor(options?: { workerUrl?: string; defaultTimeoutMs?: number });

  onStatus(listener: (event: ClientStatusEvent) => void): () => void;
  ready(): Promise<void>;

  send<T = unknown>(method: string, params?: unknown, timeoutMs?: number): Promise<T>;
  cancel(requestId: string): void;
  cancelLast(): void;

  applyDocuments(
    documents: Array<{ uri: string; text: string }>,
    timeoutMs?: number,
  ): Promise<ApplyDocumentsResult>;
  diagnostics(uri: string, timeoutMs?: number): Promise<DiagnosticItem[]>;
  hover(uri: string, position: Position, timeoutMs?: number): Promise<HoverItem>;
  completion(
    uri: string,
    position: Position,
    limit?: number,
    timeoutMs?: number,
  ): Promise<CompletionItem[]>;
  status(timeoutMs?: number): Promise<EngineStatus>;

  dispose(): void;
}
