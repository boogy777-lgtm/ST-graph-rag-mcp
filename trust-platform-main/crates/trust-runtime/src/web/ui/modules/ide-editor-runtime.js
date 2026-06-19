async function loadEditorModules() {
  try {
    const module = await import("/ide/assets/ide-monaco.20260215.js");
    ({monaco} = module);
    ({ensureStyleInjected} = module);
    ensureStyleInjected();
    configureMonacoLanguageSupport();
    startCompletion = () => {
      if (!state.editorView) {
        return;
      }
      state.editorView.focus();
      state.editorView.trigger("keyboard", "editor.action.triggerSuggest", {});
    };
    return true;
  } catch (error) {
    const message = String(error?.message || error);
    setStatus(`Editor modules failed to load: ${message}`);
    setStatus("Monaco assets could not be loaded from /ide/assets. Rebuild frontend bundle and refresh.");
    updateSaveBadge("err", "assets");
    return false;
  }
}

async function initWasmAnalysis() {
  try {
    const { TrustWasmAnalysisClient } = await import("/ide/wasm/analysis-client.js");
    wasmClient = new TrustWasmAnalysisClient({
      workerUrl: "/ide/wasm/worker.js",
      defaultTimeoutMs: 2000,
    });
    wasmClient.onStatus((status) => {
      console.log("[IDE] WASM status:", status.type, status);
      if (status.type === "ready") {
        setStatus("WASM analysis engine ready.");
      } else if (status.type === "fatal") {
        console.error("[IDE] WASM fatal:", status.error);
        setStatus("WASM analysis unavailable: " + status.error);
      } else if (status.type === "restarting") {
        bumpTelemetry("worker_restarts");
      }
    });
    await wasmClient.ready();
    console.log("[IDE] WASM analysis client ready");
    return true;
  } catch (error) {
    console.error("[IDE] WASM analysis init failed:", error);
    setStatus("WASM analysis init failed: " + String(error.message || error));
    wasmClient = null;
    return false;
  }
}
