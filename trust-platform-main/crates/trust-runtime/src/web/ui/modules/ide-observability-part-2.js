async function runDiagnosticsForActiveEditor() {
  const tab = activeTab();
  const model = activeModel();
  if (!tab || !model || !state.editorView) {
    return;
  }
  if (!isStructuredTextPath(tab.path)) {
    state.diagnostics = [];
    diagnosticsToProblems([]);
    applyMonacoMarkers([], model);
    return;
  }

  const ticket = ++state.diagnosticsTicket;
  const text = state.editorView.getValue();
  try {
    const diagnostics = await fetchDiagnostics(text);
    if (ticket !== state.diagnosticsTicket) {
      return;
    }
    state.diagnostics = diagnostics;
    diagnosticsToProblems(diagnostics);
    applyMonacoMarkers(diagnostics, model);
  } catch (error) {
    if (ticket !== state.diagnosticsTicket) {
      return;
    }
    setStatus(`Diagnostics request failed: ${String(error.message || error)}`);
    state.diagnostics = [];
    diagnosticsToProblems([]);
    applyMonacoMarkers([], model);
  }
}

function scheduleDiagnostics({immediate = false} = {}) {
  if (state.diagnosticsTimer) {
    clearTimeout(state.diagnosticsTimer);
    state.diagnosticsTimer = null;
  }
  if (!state.editorView || !activeTab()) {
    return;
  }
  if (immediate) {
    runDiagnosticsForActiveEditor().catch(() => {});
    return;
  }
  state.diagnosticsTimer = setTimeout(() => {
    runDiagnosticsForActiveEditor().catch(() => {});
  }, 220);
}

// ── Health & Telemetry ─────────────────────────────────

function renderHealthPanel(payload) {
  const info = payload || {};
  const healthy = !state.analysis.degraded;
  const sessions = info.active_sessions ?? 0;
  const sorted = [...state.latencySamples].sort((a, b) => a - b);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted.length > 0 ? `${Math.round(sorted[p95Index])}ms` : "--";

  el.healthPanel.innerHTML = "";
  const statusRow = document.createElement("div");
  statusRow.className = "row";
  const badge = healthy ? "ok" : "warn";
  statusRow.innerHTML = `<span class="ide-badge ${badge}">${healthy ? "Healthy" : "Degraded"}</span>`;
  el.healthPanel.appendChild(statusRow);

  const rows = [
    ["Sessions", sessions],
    ["Diag p95", p95],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span class="muted">${label}</span> <span class="stat">${value}</span>`;
    el.healthPanel.appendChild(row);
  }
}

async function pollHealth() {
  if (!state.sessionToken) {
    return;
  }
  try {
    const health = await apiJson("/api/ide/health", {
      method: "GET",
      headers: apiHeaders(),
    });
    renderHealthPanel(health);
  } catch {
    renderHealthPanel(null);
  }
}

function scheduleHealthPoll() {
  if (state.healthTimer) {
    clearInterval(state.healthTimer);
  }
  state.healthTimer = setInterval(() => {
    pollHealth().catch(() => {});
  }, 5000);
}

async function flushFrontendTelemetry() {
  if (!state.sessionToken) {
    return;
  }
  try {
    await apiJson("/api/ide/frontend-telemetry", {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(state.telemetry),
      timeoutMs: 2500,
      allowSessionRetry: true,
    });
  } catch {
    // Keep counters locally; they'll be retried on next flush.
  }
}

function scheduleTelemetryFlush() {
  if (state.telemetryTimer) {
    clearInterval(state.telemetryTimer);
  }
  state.telemetryTimer = setInterval(() => {
    flushFrontendTelemetry().catch(() => {});
  }, 7000);
}

// ── Presence / Collaboration ───────────────────────────

function postPresenceEvent(path) {
