function diagnosticsToProblems(items) {
  el.problemsPanel.innerHTML = "";
  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No diagnostics.";
    el.problemsPanel.appendChild(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "ide-problem";
    row.setAttribute("aria-label", `Diagnostic ${item.message}`);

    const title = document.createElement("p");
    title.className = "ide-problem-title";
    const severity = String(item.severity || "warning").toLowerCase().includes("error")
      ? "error"
      : "warning";
    const chip = document.createElement("span");
    chip.className = `ide-severity ${severity}`;
    chip.textContent = severity;
    title.appendChild(chip);
    title.appendChild(document.createTextNode(` ${item.message}`));

    const meta = document.createElement("p");
    meta.className = "ide-problem-meta";
    meta.textContent = `${item.code || "diag"} at ${item.range.start.line}:${item.range.start.character}`;

    row.appendChild(title);
    row.appendChild(meta);
    row.addEventListener("click", () => {
      if (!state.editorView) {
        return;
      }
      const model = activeModel();
      if (!model) {
        return;
      }
      const pos = toMonacoPosition(item.range.start, model);
      state.editorView.setPosition(pos);
      state.editorView.revealPositionInCenter(pos);
      state.editorView.focus();
      updateCursorLabel();
    });

    el.problemsPanel.appendChild(row);
  }
}

function jumpToRange(range) {
  if (!state.editorView || !range || !range.start) {
    return;
  }
  const model = activeModel();
  if (!model) {
    return;
  }
  const monacoRange = toMonacoRange(range, model);
  state.editorView.setSelection(monacoRange);
  state.editorView.revealRangeInCenter(monacoRange);
  state.editorView.focus();
  updateCursorLabel();
}

function renderReferences(references) {
  el.referencesPanel.innerHTML = "";
  if (!Array.isArray(references) || references.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No references.";
    el.referencesPanel.appendChild(empty);
    return;
  }
  for (const location of references.slice(0, 80)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ide-link-button";
    const refPath = location.uri || location.path;
    const start = location.range?.start || {line: 0, character: 0};
    const writeTag = location.is_write ? " [write]" : "";
    button.textContent = `${refPath}:${start.line + 1}:${start.character + 1}${writeTag}`;
    button.addEventListener("click", async () => {
      await openFile(refPath);
      jumpToRange(location.range);
    });
    el.referencesPanel.appendChild(button);
  }
}

function renderSearchHits(hits) {
  el.searchPanel.innerHTML = "";
  if (!Array.isArray(hits) || hits.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No search results.";
    el.searchPanel.appendChild(empty);
    return;
  }
  for (const hit of hits.slice(0, 100)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ide-link-button";
    button.textContent = `${hit.path}:${Number(hit.line) + 1}  ${hit.preview || ""}`;
    button.addEventListener("click", async () => {
      await openFile(hit.path);
      jumpToRange({
        start: {line: Number(hit.line || 0), character: Number(hit.character || 0)},
      });
    });
    el.searchPanel.appendChild(button);
  }
}

function renderSymbolHits(hits) {
  el.searchPanel.innerHTML = "";
  if (!Array.isArray(hits) || hits.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No symbols.";
    el.searchPanel.appendChild(empty);
    return;
  }
  for (const hit of hits.slice(0, 120)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ide-link-button";
    button.textContent = `${hit.kind || "symbol"}  ${hit.name || ""}  (${hit.path}:${Number(hit.line || 0) + 1})`;
    button.addEventListener("click", async () => {
      await openFile(hit.path);
      jumpToRange({
        start: {line: Number(hit.line || 0), character: Number(hit.character || 0)},
      });
    });
    el.searchPanel.appendChild(button);
  }
}

// ── Project Management ─────────────────────────────────


function resetAnalysisFailureState() {
  state.analysis.consecutiveFailures = 0;
  if (state.analysis.degraded) {
    state.analysis.degraded = false;
    updateLatencyBadge();
    setStatus("Analysis recovered.");
  }
}

function noteAnalysisFailure(error, source) {
  const message = String(error?.message || error);
  if (isTimeoutMessage(message)) {
    bumpTelemetry("analysis_timeouts");
  }
  state.analysis.consecutiveFailures += 1;
  if (state.analysis.consecutiveFailures < 3) {
    return;
  }

  const now = Date.now();
  const firstDegrade = !state.analysis.degraded;
  state.analysis.degraded = true;
  updateLatencyBadge();
  if (firstDegrade || now - state.analysis.lastNoticeAtMs > 4_000) {
    const suffix = source === "completion"
      ? "Completion may be delayed while analysis retries."
      : "IDE is retrying analysis requests.";
    setStatus(`Analysis degraded after repeated failures. ${suffix}`);
    state.analysis.lastNoticeAtMs = now;
  }
}

async function fetchDiagnostics(docText) {
  const tab = activeTab();
  if (!tab) {
    return [];
  }
  if (!isStructuredTextPath(tab.path)) {
    return [];
  }

  if (docText.length > 180_000) {
    return [];
  }

  const started = performance.now();
  try {
    syncDocumentsToWasm();
    if (!wasmClient) {
      return [];
    }
    const result = await wasmClient.diagnostics(tab.path);
    resetAnalysisFailureState();
    const elapsed = performance.now() - started;
    state.latencySamples.push(elapsed);
    if (state.latencySamples.length > 40) {
      state.latencySamples.shift();
    }
    updateLatencyBadge();
    return Array.isArray(result) ? result : [];
  } catch (error) {
    noteAnalysisFailure(error, "diagnostics");
    throw error;
  }
}

async function fetchHover(position) {
  const tab = activeTab();
  if (!tab) {
    return null;
  }
  if (!isStructuredTextPath(tab.path)) {
    return null;
  }
  try {
    syncDocumentsToWasm();
    if (!wasmClient) {
      return null;
    }
    const result = await wasmClient.hover(tab.path, position);
    resetAnalysisFailureState();
    return result;
  } catch (error) {
    noteAnalysisFailure(error, "hover");
    throw error;
  }
}

async function fetchCompletion(position, limit = 40) {
  const tab = activeTab();
  if (!tab) {
    return [];
  }
  if (!isStructuredTextPath(tab.path)) {
    return [];
  }
  try {
    syncDocumentsToWasm();
    if (!wasmClient) {
      return [];
    }
    const result = await wasmClient.completion(tab.path, position, limit);
    resetAnalysisFailureState();
    return Array.isArray(result) ? result : [];
  } catch (error) {
    noteAnalysisFailure(error, "completion");
    console.warn("[ide] completion request failed:", error);
    return [];
  }
}

