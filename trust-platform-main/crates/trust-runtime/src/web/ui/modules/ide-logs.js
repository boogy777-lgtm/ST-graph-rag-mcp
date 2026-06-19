// ide-logs.js — Unified log view with source filters, search, alarm ack,
// and CSV export. Implements US-8.1, US-8.2, US-8.3.

// ── Constants ──────────────────────────────────────────

const LOGS_POLL_INTERVAL_MS = 2000;
const LOGS_MAX_ENTRIES = 500;
const LOGS_SOURCES = ["runtime", "alarms", "build", "system"];

// ── Logs State ─────────────────────────────────────────

const logsState = {
  entries: [],
  filteredEntries: [],
  activeSources: new Set(LOGS_SOURCES),
  severityFilter: "all",
  runtimeFilter: "all",
  searchQuery: "",
  autoScroll: true,
  pollTimer: null,
  initialized: false,
  lastRuntimeStatus: null,
};

// ── Source Sidebar ─────────────────────────────────────

function logsRenderSources() {
  const container = el.logsSources;
  if (!container) return;
  container.innerHTML = "";

  for (const source of LOGS_SOURCES) {
    const label = document.createElement("label");
    label.className = "logs-source-toggle";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = logsState.activeSources.has(source);
    cb.dataset.logsSource = source;
    cb.addEventListener("change", (e) => {
      if (e.target.checked) {
        logsState.activeSources.add(source);
      } else {
        logsState.activeSources.delete(source);
      }
      logsApplyFilters();
      logsRenderTable();
    });
    label.appendChild(cb);
    const span = document.createElement("span");
    span.textContent = source.charAt(0).toUpperCase() + source.slice(1);
    label.appendChild(span);
    container.appendChild(label);
  }

  // Auto-scroll toggle
  const autoLabel = document.createElement("label");
  autoLabel.className = "logs-source-toggle";
  autoLabel.style.marginTop = "8px";
  autoLabel.style.borderTop = "1px solid var(--border)";
  autoLabel.style.paddingTop = "8px";
  const autoCb = document.createElement("input");
  autoCb.type = "checkbox";
  autoCb.checked = logsState.autoScroll;
  autoCb.addEventListener("change", (e) => { logsState.autoScroll = e.target.checked; });
  autoLabel.appendChild(autoCb);
  const autoSpan = document.createElement("span");
  autoSpan.textContent = "Auto-scroll";
  autoLabel.appendChild(autoSpan);
  container.appendChild(autoLabel);

  // Export button
  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "btn ghost";
  exportBtn.textContent = "Export CSV";
  exportBtn.style.marginTop = "8px";
  exportBtn.addEventListener("click", logsExportCsv);
  container.appendChild(exportBtn);
}

// ── Log Entry Management ───────────────────────────────

function logsAddEntry(entry) {
  logsState.entries.push({
    ts: entry.ts || Date.now(),
    level: entry.level || "info",
    source: entry.source || "system",
    runtime: entry.runtime || "",
    message: entry.message || "",
    acked: entry.acked || false,
    alarmId: entry.alarmId || null,
  });
  if (logsState.entries.length > LOGS_MAX_ENTRIES) {
    logsState.entries.shift();
  }
  logsRenderRuntimeFilterOptions();
  logsApplyFilters();
  logsRenderTable();
  logsUpdateAlarmStatusBadge();
}

function logsAddSystemEvent(message) {
  logsAddEntry({ source: "system", level: "info", message });
}

function logsAddBuildEvent(message, level) {
  logsAddEntry({ source: "build", level: level || "info", message });
}

function logsUpdateAlarmStatusBadge() {
  if (!el.alarmCount) return;
  const unacked = logsState.entries.filter((entry) =>
    entry.source === "alarms" && !entry.acked
  ).length;
  if (unacked <= 0) {
    el.alarmCount.textContent = "";
    return;
  }
  el.alarmCount.textContent = `\u26A0 ${unacked} alarm${unacked === 1 ? "" : "s"}`;
  if (!el.alarmCount.dataset.logsBound) {
    el.alarmCount.dataset.logsBound = "1";
    el.alarmCount.addEventListener("click", () => {
      if (typeof switchIdeTab === "function") switchIdeTab("logs");
    });
  }
}

// ── Filtering ──────────────────────────────────────────

function logsApplyFilters() {
  logsState.filteredEntries = logsState.entries.filter((entry) => {
    if (!logsState.activeSources.has(entry.source)) return false;
    if (logsState.severityFilter !== "all" && entry.level !== logsState.severityFilter) return false;
    if (logsState.runtimeFilter !== "all") {
      const runtime = String(entry.runtime || "").trim();
      if (runtime !== logsState.runtimeFilter) return false;
    }
    if (logsState.searchQuery) {
      const q = logsState.searchQuery.toLowerCase();
      if (!entry.message.toLowerCase().includes(q) &&
          !entry.source.toLowerCase().includes(q) &&
          !entry.runtime.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });
}

// ── Table Rendering ────────────────────────────────────

function logsRenderTable() {
  const panel = el.logsTablePanel;
  if (!panel) return;

  if (logsState.filteredEntries.length === 0) {
    if (logsState.entries.length === 0) {
      if (!onlineState || !onlineState.connected) {
        panel.innerHTML = '<div class="muted" style="padding:16px;font-size:13px;text-align:center">No events yet. Build and system events appear offline. Connect to a runtime for alarms and live runtime events.</div>';
      } else {
        panel.innerHTML = '<div class="muted" style="padding:16px;font-size:13px;text-align:center">No events yet. Build output, runtime events, and alarms will appear here.</div>';
      }
    } else {
      panel.innerHTML = '<div class="muted" style="padding:16px;font-size:13px;text-align:center">No events match current filters.</div>';
    }
    return;
  }

  let html = `<table class="data-table logs-table">
    <thead><tr>
      <th style="width:140px">Time</th>
      <th style="width:60px">Level</th>
      <th style="width:70px">Source</th>
      <th style="width:100px">Runtime</th>
      <th>Message</th>
      <th style="width:50px"></th>
    </tr></thead><tbody>`;

  for (const entry of logsState.filteredEntries) {
    const levelClass = `logs-level-${entry.level}`;
    const ts = new Date(entry.ts).toLocaleTimeString();
    const ackBtn = (entry.source === "alarms" && !entry.acked && entry.alarmId)
      ? `<button type="button" class="btn ghost logs-ack-btn" data-alarm-id="${escapeAttr(entry.alarmId)}" style="font-size:10px;padding:1px 4px">Ack</button>`
      : "";

    html += `<tr class="${levelClass}${entry.acked ? " logs-acked" : ""}">
      <td class="mono" style="font-size:10px">${escapeHtml(ts)}</td>
      <td><span class="logs-level-badge ${levelClass}">${escapeHtml(entry.level)}</span></td>
      <td style="font-size:11px">${escapeHtml(entry.source)}</td>
      <td style="font-size:11px">${escapeHtml(entry.runtime)}</td>
      <td style="font-size:12px">${escapeHtml(entry.message)}</td>
      <td>${ackBtn}</td>
    </tr>`;
  }
  html += "</tbody></table>";
  panel.innerHTML = html;

  // Bind ack buttons
  panel.querySelectorAll("[data-alarm-id]").forEach((btn) => {
    btn.addEventListener("click", () => logsAckAlarm(btn.dataset.alarmId));
  });

  // Auto-scroll
  if (logsState.autoScroll) {
    panel.scrollTop = panel.scrollHeight;
  }
  logsUpdateAlarmStatusBadge();
}

// ── Filter Bar ─────────────────────────────────────────

function logsRuntimeOptions() {
  const runtimes = new Set();
  for (const entry of logsState.entries) {
    const runtime = String(entry.runtime || "").trim();
    if (!runtime) continue;
    runtimes.add(runtime);
  }
  return [...runtimes].sort((a, b) => a.localeCompare(b));
}

function logsRenderRuntimeFilterOptions() {
  const runtimeSelect = document.getElementById("logsRuntimeFilter");
  if (!runtimeSelect) return;

  const runtimes = logsRuntimeOptions();
  if (logsState.runtimeFilter !== "all" && !runtimes.includes(logsState.runtimeFilter)) {
    logsState.runtimeFilter = "all";
  }

  let html = '<option value="all">All runtimes</option>';
  for (const runtime of runtimes) {
    html += `<option value="${escapeAttr(runtime)}">${escapeHtml(runtime)}</option>`;
  }
  runtimeSelect.innerHTML = html;
  runtimeSelect.value = logsState.runtimeFilter;
}

function logsRenderFilterBar() {
  const bar = el.logsFilterBar;
  if (!bar) return;

  bar.innerHTML = `
    <select id="logsSeverityFilter" style="font-size:11px;padding:3px 6px">
      <option value="all">All severities</option>
      <option value="error">Error</option>
      <option value="warn">Warning</option>
      <option value="info">Info</option>
      <option value="debug">Debug</option>
    </select>
    <select id="logsRuntimeFilter" style="font-size:11px;padding:3px 6px"></select>
    <input id="logsSearchInput" type="text" placeholder="Search events..." style="font-size:11px;flex:1;max-width:200px" aria-label="Search logs"/>
    <button type="button" class="btn ghost" id="logsAckAllBtn" style="font-size:11px">Ack All</button>
    <button type="button" class="btn ghost" id="logsRefreshBtn" style="font-size:11px">Refresh</button>
  `;

  const severitySelect = document.getElementById("logsSeverityFilter");
  if (severitySelect) {
    severitySelect.value = logsState.severityFilter;
    severitySelect.addEventListener("change", (e) => {
      logsState.severityFilter = e.target.value;
      logsApplyFilters();
      logsRenderTable();
    });
  }

  const runtimeSelect = document.getElementById("logsRuntimeFilter");
  if (runtimeSelect) {
    logsRenderRuntimeFilterOptions();
    runtimeSelect.addEventListener("change", (e) => {
      logsState.runtimeFilter = e.target.value || "all";
      logsApplyFilters();
      logsRenderTable();
    });
  }

  const searchInput = document.getElementById("logsSearchInput");
  if (searchInput) {
    searchInput.value = logsState.searchQuery;
    searchInput.addEventListener("input", (e) => {
      logsState.searchQuery = e.target.value;
      logsApplyFilters();
      logsRenderTable();
    });
  }

  const ackAllBtn = document.getElementById("logsAckAllBtn");
  if (ackAllBtn) ackAllBtn.addEventListener("click", logsAckAll);

  const refreshBtn = document.getElementById("logsRefreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", logsPollEvents);
}

// ── Alarm Acknowledgment (US-8.2) ─────────────────────

async function logsAckAlarm(alarmId) {
  try {
    await runtimeControlRequest({
      id: 1,
      type: "alarm.ack",
      params: { id: alarmId },
    }, { timeoutMs: 3000 });
    const entry = logsState.entries.find((e) => e.alarmId === alarmId);
    if (entry) entry.acked = true;
    logsApplyFilters();
    logsRenderTable();
    logsUpdateAlarmStatusBadge();
  } catch (err) {
    if (typeof showIdeToast === "function") showIdeToast(`Ack failed: ${err.message || err}`, "error");
  }
}

async function logsAckAll() {
  const unacked = logsState.entries.filter((e) => e.source === "alarms" && !e.acked && e.alarmId);
  for (const entry of unacked) {
    try {
      await runtimeControlRequest({
        id: 1,
        type: "alarm.ack",
        params: { id: entry.alarmId },
      }, { timeoutMs: 2000 });
      entry.acked = true;
    } catch {
      // Continue with remaining
    }
  }
  logsApplyFilters();
  logsRenderTable();
  logsUpdateAlarmStatusBadge();
  if (typeof showIdeToast === "function") showIdeToast("All alarms acknowledged.", "success");
}

// ── Event Polling ──────────────────────────────────────

function logsStartPolling() {
  logsStopPolling();
  logsState.pollTimer = setInterval(logsPollEvents, LOGS_POLL_INTERVAL_MS);
}

function logsStopPolling() {
  if (logsState.pollTimer) {
    clearInterval(logsState.pollTimer);
    logsState.pollTimer = null;
  }
}

function logsTrackRuntimeStatusEvent() {
  if (!onlineState || !onlineState.connected) return;
  const runtime = String(onlineState.runtimeName || onlineState.address || "").trim();
  const next = String(onlineState.runtimeStatus || "running").trim();
  if (!next) return;
  const normalized = next.toLowerCase();

  if (logsState.lastRuntimeStatus == null) {
    logsState.lastRuntimeStatus = normalized;
    return;
  }
  if (logsState.lastRuntimeStatus === normalized) return;

  logsState.lastRuntimeStatus = normalized;
  logsAddEntry({
    source: "runtime",
    level: normalized.includes("fault") ? "error" : "info",
    runtime,
    message: `Runtime state changed to ${next.toUpperCase()}`,
  });
}

async function logsPollEvents() {
  if (!onlineState || !onlineState.connected) return;
  logsTrackRuntimeStatusEvent();
  try {
    const result = await runtimeControlRequest({
      id: 1,
      type: "alarm.list",
    }, { timeoutMs: 3000 });
    if (result && Array.isArray(result.alarms)) {
      for (const alarm of result.alarms) {
        const exists = logsState.entries.some((e) => e.alarmId === alarm.id);
        if (!exists) {
          logsAddEntry({
            source: "alarms",
            level: alarm.severity || "warn",
            message: alarm.message || `Alarm ${alarm.id}`,
            runtime: alarm.runtime || "",
            alarmId: alarm.id,
            acked: alarm.acked || false,
            ts: alarm.ts || Date.now(),
          });
        }
      }
    }
  } catch {
    // Polling errors are non-fatal
  }
}

// ── CSV Export (US-8.3) ────────────────────────────────

function logsExportCsv() {
  const rows = [["Timestamp", "Level", "Source", "Runtime", "Message"]];
  for (const entry of logsState.filteredEntries) {
    rows.push([
      new Date(entry.ts).toISOString(),
      entry.level,
      entry.source,
      entry.runtime,
      `"${String(entry.message).replace(/"/g, '""')}"`,
    ]);
  }
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const iso = now.toISOString();
  const dateStr = `${iso.slice(0, 10)}-${iso.slice(11, 19).replace(/:/g, "")}`;
  a.href = url;
  a.download = `truST-logs-${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Init & Tab Change ──────────────────────────────────

function logsInit() {
  if (logsState.initialized) return;
  logsState.initialized = true;
  logsRenderSources();
  logsRenderFilterBar();
  logsRenderTable();
}

function logsActivate() {
  logsInit();
  if (onlineState && onlineState.connected) {
    logsStartPolling();
  }
}

function logsDeactivate() {
  logsStopPolling();
}

document.addEventListener("ide-tab-change", (e) => {
  if (e.detail?.tab === "logs") {
    logsActivate();
  } else {
    logsDeactivate();
  }
});

document.addEventListener("ide-runtime-connected", () => {
  const target = (typeof onlineState === "object" && onlineState)
    ? (onlineState.runtimeName || onlineState.address || "runtime")
    : "runtime";
  logsAddSystemEvent(`Connected to ${target}`);
  logsState.lastRuntimeStatus = null;
  const stateLabel = String(onlineState?.runtimeStatus || "running").toUpperCase();
  logsAddEntry({
    source: "runtime",
    level: stateLabel.includes("FAULT") ? "error" : "info",
    runtime: String(target),
    message: `Runtime state ${stateLabel}`,
  });
  const active = typeof ideGetActiveTab === "function"
    ? ideGetActiveTab()
    : document.querySelector(".ide-tab-btn.active")?.dataset?.tab;
  if (active === "logs") {
    logsStartPolling();
  }
});

document.addEventListener("ide-runtime-disconnected", () => {
  logsAddSystemEvent("Disconnected from runtime");
  logsState.lastRuntimeStatus = null;
  logsStopPolling();
});

document.addEventListener("ide-project-changed", (event) => {
  const path = String(
    event?.detail?.activeProject
    || event?.detail?.projectPath
    || event?.detail?.startupProject
    || ""
  ).trim();
  if (!path) return;
  logsAddSystemEvent(`Project opened: ${path}`);
});

document.addEventListener("ide-build-log", (event) => {
  const message = String(event?.detail?.message || "").trim();
  if (!message) return;
  const level = String(event?.detail?.level || "info").toLowerCase();
  logsAddBuildEvent(message, level);
});

function logsSyncInitialTabActivation(retryCount) {
  const attempts = Number(retryCount) || 0;
  if (typeof el !== "object" || !el || !el.logsSources || !el.logsFilterBar || !el.logsTablePanel) {
    if (attempts < 80) {
      setTimeout(() => logsSyncInitialTabActivation(attempts + 1), 25);
    }
    return;
  }
  const active = typeof ideGetActiveTab === "function"
    ? ideGetActiveTab()
    : document.querySelector(".ide-tab-btn.active")?.dataset?.tab;
  if (active === "logs" || window.location.pathname.startsWith("/ide/logs")) {
    logsActivate();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => logsSyncInitialTabActivation(0), 0);
  });
} else {
  setTimeout(() => logsSyncInitialTabActivation(0), 0);
}
