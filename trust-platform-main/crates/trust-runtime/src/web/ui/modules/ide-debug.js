// ide-debug.js — Breakpoints, debug toolbar, live variable values, watch
// panel, call stack, and I/O force overlays.
// Implements US-6.1, US-6.2, US-6.3 from user stories.

// ── Constants ──────────────────────────────────────────

const DEBUG_BP_STORAGE_KEY = "trust.ide.breakpoints";
const DEBUG_POLL_INTERVAL_MS = 300;
const DEBUG_LIVE_VALUES_INTERVAL_MS = 500;

// ── Debug State ────────────────────────────────────────

const debugState = {
  active: false,
  paused: false,
  breakpoints: new Map(),  // file -> Set<line>
  currentFile: null,
  currentLine: null,
  stackFrames: [],
  variables: [],
  watchList: [],
  liveValuesEnabled: false,
  liveValues: {},
  forceWarningCount: 0,
  pollTimer: null,
  liveValuesTimer: null,
  gutterDecorations: [],
  currentLineDecoration: null,
};

// ── Breakpoint Management ──────────────────────────────

function debugLoadBreakpoints() {
  try {
    const raw = localStorage.getItem(DEBUG_BP_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const [file, lines] of Object.entries(data)) {
      debugState.breakpoints.set(file, new Set(lines));
    }
  } catch {
    // Ignore corrupt data
  }
}

function debugSaveBreakpoints() {
  try {
    const data = {};
    for (const [file, lines] of debugState.breakpoints) {
      data[file] = [...lines];
    }
    localStorage.setItem(DEBUG_BP_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

function debugToggleBreakpoint(file, line) {
  if (!debugState.breakpoints.has(file)) {
    debugState.breakpoints.set(file, new Set());
  }
  const lines = debugState.breakpoints.get(file);
  if (lines.has(line)) {
    lines.delete(line);
  } else {
    lines.add(line);
  }
  if (lines.size === 0) debugState.breakpoints.delete(file);
  debugSaveBreakpoints();
  debugRenderGutterMarkers();

  // Sync to runtime if connected
  if (onlineState && onlineState.connected) {
    debugSyncBreakpoints(file);
  }
}

async function debugSyncBreakpoints(file) {
  const lines = debugState.breakpoints.has(file) ? [...debugState.breakpoints.get(file)] : [];
  try {
    await runtimeControlRequest({
      id: 1,
      type: "breakpoints.set",
      params: { source: file, lines },
    }, { timeoutMs: 3000 });
  } catch {
    // Breakpoint sync errors are non-fatal
  }
}

async function debugClearAllBreakpoints() {
  debugState.breakpoints.clear();
  debugSaveBreakpoints();
  debugRenderGutterMarkers();
  if (onlineState && onlineState.connected) {
    try {
      await runtimeControlRequest({
        id: 1,
        type: "breakpoints.clear_all",
      }, { timeoutMs: 3000 });
    } catch {
      // Non-fatal
    }
  }
}

// ── Gutter Decorations ─────────────────────────────────

function debugRenderGutterMarkers() {
  // Clear existing decorations
  for (const dec of debugState.gutterDecorations) {
    if (dec.clear) dec.clear();
  }
  debugState.gutterDecorations = [];

  if (!state.editorView || !state.activePath) return;

  const fileBreakpoints = debugState.breakpoints.get(state.activePath);
  if (!fileBreakpoints || fileBreakpoints.size === 0) return;

  // Monaco gutter decorations
  if (monaco && state.editorView.deltaDecorations) {
    const model = state.editorView.getModel();
    if (!model) return;
    const decorations = [...fileBreakpoints].map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        glyphMarginClassName: "debug-bp-glyph",
        glyphMarginHoverMessage: { value: `Breakpoint at line ${line}` },
      },
    }));
    debugState.gutterDecorations = state.editorView.deltaDecorations(
      debugState.gutterDecorations,
      decorations
    );
  }
}

function debugRenderCurrentLine() {
  if (debugState.currentLineDecoration) {
    if (Array.isArray(debugState.currentLineDecoration) && state.editorView?.deltaDecorations) {
      state.editorView.deltaDecorations(debugState.currentLineDecoration, []);
    }
    debugState.currentLineDecoration = null;
  }

  if (!debugState.paused || !debugState.currentLine || !state.editorView) return;
  if (state.activePath !== debugState.currentFile) return;

  if (monaco && state.editorView.deltaDecorations) {
    debugState.currentLineDecoration = state.editorView.deltaDecorations([], [{
      range: new monaco.Range(debugState.currentLine, 1, debugState.currentLine, 1),
      options: {
        isWholeLine: true,
        className: "debug-current-line",
        glyphMarginClassName: "debug-current-glyph",
      },
    }]);
  }
}

// ── Debug Toolbar ──────────────────────────────────────

function debugRenderToolbar() {
  const toolbar = el.debugToolbar;
  if (!toolbar) return;

  if (!debugState.paused) {
    toolbar.hidden = true;
    return;
  }

  toolbar.hidden = false;
  toolbar.innerHTML = `
    <button type="button" class="btn ghost" data-debug-action="continue" title="Continue (F5)"><svg width="14" height="14" viewBox="0 0 16 16"><path d="M5 3v10l8-5z" fill="currentColor"/></svg></button>
    <button type="button" class="btn ghost" data-debug-action="step_over" title="Step Over (F10)"><svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 8h10M9 5l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>
    <button type="button" class="btn ghost" data-debug-action="step_in" title="Step Into (F11)"><svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 2v10M5 9l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>
    <button type="button" class="btn ghost" data-debug-action="step_out" title="Step Out (Shift+F11)"><svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 14V4M5 7l3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>
    <button type="button" class="btn ghost" data-debug-action="stop" title="Stop (Shift+F5)" style="color:var(--danger)"><svg width="14" height="14" viewBox="0 0 16 16"><rect x="4" y="4" width="8" height="8" fill="currentColor"/></svg></button>
    <span class="muted" style="font-size:11px;margin-left:8px">Paused at ${escapeHtml(debugState.currentFile || "")}:${debugState.currentLine || ""}</span>
  `;

  toolbar.querySelectorAll("[data-debug-action]").forEach((btn) => {
    btn.addEventListener("click", () => debugAction(btn.dataset.debugAction));
  });
}

async function debugAction(action) {
  try {
    let type;
    switch (action) {
      case "continue": type = "resume"; break;
      case "step_over": type = "step_over"; break;
      case "step_in": type = "step_in"; break;
      case "step_out": type = "step_out"; break;
      case "stop":
        debugState.paused = false;
        debugState.currentFile = null;
        debugState.currentLine = null;
        debugRenderCurrentLine();
        debugRenderToolbar();
        debugRenderVariables();
        debugRenderCallStack();
        setStatus("Debug session stopped.");
        return;
      default: return;
    }

    await runtimeControlRequest({
      id: 1,
      type,
    }, { timeoutMs: 5000 });
  } catch (err) {
    if (typeof showIdeToast === "function") {
      showIdeToast(`Debug action failed: ${err.message || err}`, "error");
    }
  }
}

// ── Debug State Polling ────────────────────────────────

function debugStartPolling() {
  debugStopPolling();
  debugState.pollTimer = setInterval(debugPollState, DEBUG_POLL_INTERVAL_MS);
}

function debugStopPolling() {
  if (debugState.pollTimer) {
    clearInterval(debugState.pollTimer);
    debugState.pollTimer = null;
  }
}

async function debugPollState() {
  if (!onlineState || !onlineState.connected) return;

  try {
    const result = await runtimeControlRequest({
      id: 1,
      type: "debug.state",
    }, { timeoutMs: 2000 });
    if (!result || typeof result !== "object") return;

    const wasPaused = debugState.paused;
    debugState.paused = !!result.paused;

    if (debugState.paused && result.last_stop) {
      const stop = result.last_stop;
      debugState.currentFile = stop.source || null;
      debugState.currentLine = stop.line || null;

      // Navigate to breakpoint location
      if (debugState.currentFile && !wasPaused) {
        if (typeof switchIdeTab === "function") switchIdeTab("code");
        if (typeof openFile === "function") {
          await openFile(debugState.currentFile);
        }
        if (state.editorView && debugState.currentLine) {
          state.editorView.revealLineInCenter(debugState.currentLine);
        }
      }
      debugRenderCurrentLine();
      debugFetchVariables();
      debugFetchCallStack();
    } else if (!debugState.paused && wasPaused) {
      debugState.currentFile = null;
      debugState.currentLine = null;
      debugRenderCurrentLine();
    }

    debugRenderToolbar();
    if (el.runtimeState) {
      el.runtimeState.textContent = debugState.paused
        ? `PAUSED at ${debugState.currentFile || ""}:${debugState.currentLine || ""}`
        : (onlineState.runtimeStatus || "");
    }
  } catch {
    // Polling errors are non-fatal
  }
}

// ── Variables Panel ────────────────────────────────────

async function debugFetchVariables() {
  if (!debugState.paused) return;
  try {
    const result = await runtimeControlRequest({
      id: 1,
      type: "debug.variables",
      params: { variables_reference: 0 },
    }, { timeoutMs: 3000 });
    if (result && Array.isArray(result.variables)) {
      debugState.variables = result.variables;
      debugRenderVariables();
    }
  } catch {
    // Non-fatal
  }
}

function debugRenderVariables() {
  const panel = el.debugVariablesPanel;
  if (!panel) return;

  if (!debugState.paused || debugState.variables.length === 0) {
    panel.innerHTML = '<span class="muted" style="font-size:11px">No variables in scope.</span>';
    return;
  }

  let html = '<table class="debug-var-table"><tbody>';
  for (const v of debugState.variables) {
    html += `<tr>
      <td class="mono" style="font-size:11px">${escapeHtml(v.name || "")}</td>
      <td style="font-size:11px;color:var(--accent)">${escapeHtml(String(v.value ?? ""))}</td>
      <td class="muted" style="font-size:10px">${escapeHtml(v.type || "")}</td>
    </tr>`;
  }
  html += "</tbody></table>";
  panel.innerHTML = html;
}

// ── Call Stack ─────────────────────────────────────────

async function debugFetchCallStack() {
  if (!debugState.paused) return;
  try {
    const result = await runtimeControlRequest({
      id: 1,
      type: "debug.stack",
    }, { timeoutMs: 3000 });
    if (result && Array.isArray(result.stack_frames)) {
      debugState.stackFrames = result.stack_frames;
      debugRenderCallStack();
    }
  } catch {
    // Non-fatal
  }
}

function debugRenderCallStack() {
  const panel = el.debugCallStackPanel;
  if (!panel) return;

  if (!debugState.paused || debugState.stackFrames.length === 0) {
    panel.innerHTML = '<span class="muted" style="font-size:11px">No call stack.</span>';
    return;
  }

  let html = "";
  for (const frame of debugState.stackFrames) {
    const source = frame.source?.name || frame.source?.path || "unknown";
    html += `<div class="debug-stack-frame">
      <span style="font-weight:500;font-size:11px">${escapeHtml(frame.name || "frame")}</span>
      <span class="muted" style="font-size:10px">${escapeHtml(source)}:${frame.line || "?"}</span>
    </div>`;
  }
  panel.innerHTML = html;
}

// ── Live Variable Values (US-6.1) ─────────────────────

function debugToggleLiveValues() {
  debugState.liveValuesEnabled = !debugState.liveValuesEnabled;
  if (el.liveValuesToggle) {
    el.liveValuesToggle.classList.toggle("active", debugState.liveValuesEnabled);
  }
  if (debugState.liveValuesEnabled) {
    debugStartLiveValuesPoll();
  } else {
    debugStopLiveValuesPoll();
    debugClearLiveAnnotations();
  }
}

function debugStartLiveValuesPoll() {
  debugStopLiveValuesPoll();
  debugState.liveValuesTimer = setInterval(debugPollLiveValues, DEBUG_LIVE_VALUES_INTERVAL_MS);
  debugPollLiveValues();
}

function debugStopLiveValuesPoll() {
  if (debugState.liveValuesTimer) {
    clearInterval(debugState.liveValuesTimer);
    debugState.liveValuesTimer = null;
  }
}

async function debugPollLiveValues() {
  if (!onlineState || !onlineState.connected) return;
  if (!state.editorView || !state.activePath) return;

  try {
    // Get variable list via eval for visible lines
    const result = await runtimeControlRequest({
      id: 1,
      type: "debug.variables",
      params: { variables_reference: 0 },
    }, { timeoutMs: 2000 });
    if (result && Array.isArray(result.variables)) {
      debugState.liveValues = {};
      for (const v of result.variables) {
        debugState.liveValues[v.name] = v.value;
      }
      debugRenderLiveAnnotations();
    }
  } catch {
    // Non-fatal
  }
}

function debugRenderLiveAnnotations() {
  if (!state.editorView || !monaco) return;

  const model = state.editorView.getModel();
  if (!model) return;

  const decorations = [];
  const lineCount = model.getLineCount();

  for (let line = 1; line <= lineCount; line++) {
    const text = model.getLineContent(line);
    // Match variable assignments: name := expr;
    const match = text.match(/^\s*(\w+)\s*:=/);
    if (match && debugState.liveValues[match[1]] !== undefined) {
      const value = debugState.liveValues[match[1]];
      const isBool = value === "TRUE" || value === "FALSE" || value === true || value === false;
      const isForced = typeof hwState !== "undefined" && hwState.forcedAddresses &&
        hwState.forcedAddresses.has(match[1]);
      const displayValue = isForced ? `${value} (F)` : String(value);
      const className = isBool
        ? (value === "TRUE" || value === true ? "debug-live-true" : "debug-live-false")
        : "debug-live-value";

      decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          afterContentClassName: className,
          after: {
            content: ` \u2192 ${displayValue}`,
            inlineClassName: className,
          },
        },
      });
    }
  }

  // Store and apply decorations
  if (debugState._liveDecorations) {
    debugState._liveDecorations = state.editorView.deltaDecorations(debugState._liveDecorations, decorations);
  } else {
    debugState._liveDecorations = state.editorView.deltaDecorations([], decorations);
  }
}

function debugClearLiveAnnotations() {
  if (debugState._liveDecorations && state.editorView?.deltaDecorations) {
    state.editorView.deltaDecorations(debugState._liveDecorations, []);
    debugState._liveDecorations = null;
  }
}

// ── Watch Panel ────────────────────────────────────────

function debugAddToWatch(varName) {
  if (!varName || debugState.watchList.includes(varName)) return;
  debugState.watchList.push(varName);
  debugRenderWatchPanel();
}

function debugRemoveFromWatch(varName) {
  debugState.watchList = debugState.watchList.filter((w) => w !== varName);
  debugRenderWatchPanel();
}

function debugRenderWatchPanel() {
  const panel = el.debugWatchPanel;
  if (!panel) return;

  if (debugState.watchList.length === 0) {
    panel.innerHTML = '<span class="muted" style="font-size:11px">Right-click a variable to add to watch.</span>';
    return;
  }

  let html = "";
  for (const name of debugState.watchList) {
    const value = debugState.liveValues[name] ?? debugState.variables.find((v) => v.name === name)?.value ?? "--";
    html += `<div class="debug-watch-entry">
      <span class="mono" style="font-size:11px">${escapeHtml(name)}</span>
      <span style="font-size:11px;color:var(--accent)">${escapeHtml(String(value))}</span>
      <button type="button" class="debug-watch-remove" data-watch-name="${escapeAttr(name)}" title="Remove">&times;</button>
    </div>`;
  }
  panel.innerHTML = html;

  panel.querySelectorAll("[data-watch-name]").forEach((btn) => {
    btn.addEventListener("click", () => debugRemoveFromWatch(btn.dataset.watchName));
  });
}

// ── I/O Force (US-6.3) ────────────────────────────────

async function debugForceIoValue(address, value) {
  if (!onlineState || !onlineState.connected) return;
  try {
    await runtimeControlRequest({
      id: 1,
      type: "io.force",
      params: { address, value: String(value) },
    }, { timeoutMs: 3000 });
    if (typeof showIdeToast === "function") showIdeToast(`Forced ${address} = ${value}`, "success");
  } catch (err) {
    if (typeof showIdeToast === "function") showIdeToast(`Force failed: ${err.message || err}`, "error");
  }
}

async function debugUnforceIoValue(address) {
  if (!onlineState || !onlineState.connected) return;
  try {
    await runtimeControlRequest({
      id: 1,
      type: "io.unforce",
      params: { address },
    }, { timeoutMs: 3000 });
    if (typeof showIdeToast === "function") showIdeToast(`Released force on ${address}`, "success");
  } catch (err) {
    if (typeof showIdeToast === "function") showIdeToast(`Unforce failed: ${err.message || err}`, "error");
  }
}

async function debugReleaseAllForces() {
  if (!onlineState || !onlineState.connected) return;
  if (typeof hwState !== "undefined" && hwState.forcedAddresses) {
    for (const addr of [...hwState.forcedAddresses]) {
      await debugUnforceIoValue(addr);
    }
  }
  if (typeof showIdeToast === "function") showIdeToast("All forces released.", "success");
}

function debugRenderForceWarning() {
  const banner = el.debugForceBanner;
  if (!banner) return;
  const count = typeof hwState !== "undefined" && hwState.forcedAddresses
    ? hwState.forcedAddresses.size : 0;
  if (count === 0) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  banner.innerHTML = `<span>\u26A0 ${count} value${count !== 1 ? "s" : ""} forced.</span>
    <button type="button" class="btn ghost" style="font-size:11px" onclick="debugReleaseAllForces()">Release All</button>`;
}

// ── Keyboard Shortcuts ─────────────────────────────────

function debugHandleKeyboard(e) {
  if (!onlineState || !onlineState.connected) return;
  if (!debugState.paused) return;

  if (e.key === "F5" && !e.shiftKey) {
    e.preventDefault();
    debugAction("continue");
  } else if (e.key === "F10") {
    e.preventDefault();
    debugAction("step_over");
  } else if (e.key === "F11" && !e.shiftKey) {
    e.preventDefault();
    debugAction("step_in");
  } else if (e.key === "F11" && e.shiftKey) {
    e.preventDefault();
    debugAction("step_out");
  } else if (e.key === "F5" && e.shiftKey) {
    e.preventDefault();
    debugAction("stop");
  }
}

// ── Activation ─────────────────────────────────────────

function debugActivate() {
  debugState.active = true;
  debugLoadBreakpoints();
  debugStartPolling();
  if (debugState.liveValuesEnabled) debugStartLiveValuesPoll();
  document.addEventListener("keydown", debugHandleKeyboard);
}

function debugDeactivate() {
  debugState.active = false;
  debugStopPolling();
  debugStopLiveValuesPoll();
  debugClearLiveAnnotations();
  debugState.paused = false;
  debugState.currentFile = null;
  debugState.currentLine = null;
  debugRenderCurrentLine();
  debugRenderToolbar();
  document.removeEventListener("keydown", debugHandleKeyboard);
}

// ── Init ───────────────────────────────────────────────

function debugInit() {
  debugLoadBreakpoints();

  if (el.liveValuesToggle) {
    el.liveValuesToggle.addEventListener("click", debugToggleLiveValues);
  }

  // Start polling when connected
  document.addEventListener("ide-tab-change", (e) => {
    if (e.detail?.tab === "code" && onlineState?.connected) {
      debugActivate();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(debugInit, 0);
});
