import init, { WasmAnalysisEngine } from "../pkg/trust_wasm_analysis.js";

let engine = null;
let startupError = null;
const canceledRequests = new Set();

async function ensureEngine() {
  if (startupError) {
    throw startupError;
  }
  if (engine) {
    return engine;
  }

  try {
    await init();
    engine = new WasmAnalysisEngine();
    self.postMessage({ type: "ready" });
    return engine;
  } catch (error) {
    startupError = new Error(
      `failed to initialize trust-wasm-analysis: ${String(error)}`
    );
    self.postMessage({
      type: "startup_error",
      error: startupError.message,
    });
    throw startupError;
  }
}

function asEngineError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { code: "engine_error", message };
}

function parseJson(json) {
  return JSON.parse(json);
}

function execute(method, params) {
  switch (method) {
    case "applyDocuments":
      return parseJson(
        engine.applyDocumentsJson(JSON.stringify(params.documents ?? []))
      );
    case "diagnostics":
      return parseJson(engine.diagnosticsJson(params.uri));
    case "hover":
      return parseJson(engine.hoverJson(JSON.stringify(params)));
    case "completion":
      return parseJson(engine.completionJson(JSON.stringify(params)));
    case "status":
      return parseJson(engine.statusJson());
    default:
      throw new Error(`unsupported method '${method}'`);
  }
}

self.onmessage = async (event) => {
  const payload = event.data ?? {};
  const { id, method, params = {}, timeoutMs = 0 } = payload;

  if (method === "cancel") {
    const requestId = params?.requestId;
    if (typeof requestId === "string" && requestId.length > 0) {
      canceledRequests.add(requestId);
    }
    return;
  }

  if (typeof id !== "string" || typeof method !== "string") {
    self.postMessage({
      id: typeof id === "string" ? id : null,
      error: { code: "bad_request", message: "id and method must be strings" },
    });
    return;
  }

  let timedOut = false;
  let timeoutHandle = null;
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      canceledRequests.add(id);
      self.postMessage({
        id,
        error: {
          code: "timeout",
          message: `request ${id} timed out after ${timeoutMs}ms`,
        },
      });
    }, timeoutMs);
  }

  try {
    await ensureEngine();
    const result = execute(method, params);
    if (!canceledRequests.has(id) && !timedOut) {
      self.postMessage({ id, result });
    }
  } catch (error) {
    if (!canceledRequests.has(id) && !timedOut) {
      self.postMessage({ id, error: asEngineError(error) });
    }
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    canceledRequests.delete(id);
  }
};
