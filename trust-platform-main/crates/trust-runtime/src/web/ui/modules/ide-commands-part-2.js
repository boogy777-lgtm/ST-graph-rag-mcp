async function workspaceSearchFlow() {
  const query = await idePrompt("Workspace search query:");
  if (!query || !query.trim()) {
    return;
  }
  const include = await idePrompt("Include glob (optional, e.g. **/*.st):", "**/*.st");
  const exclude = await idePrompt("Exclude glob (optional):", "");
  const params = new URLSearchParams({
    q: query.trim(),
    limit: "120",
  });
  if (include && include.trim()) {
    params.set("include", include.trim());
  }
  if (exclude && exclude.trim()) {
    params.set("exclude", exclude.trim());
  }
  const result = await apiJson(`/api/ide/search?${params.toString()}`, {
    method: "GET",
    headers: apiHeaders(),
  });
  state.searchHits = Array.isArray(result) ? result : [];
  renderSearchHits(state.searchHits);
  setStatus(`Search results: ${state.searchHits.length}`);
}

async function fetchSymbols(query = "", path = "") {
  const scoped = path ? `&path=${encodeURIComponent(path)}` : "";
  const result = await apiJson(`/api/ide/symbols?q=${encodeURIComponent(query)}&limit=120${scoped}`, {
    method: "GET",
    headers: apiHeaders(),
  });
  return Array.isArray(result) ? result : [];
}

async function fileSymbolSearchFlow() {
  const path = activeTab()?.path;
  if (!path) {
    setStatus("Open a file first to search file symbols.");
    return;
  }
  if (!isStructuredTextPath(path)) {
    setStatus("File symbol search is available for .st files.");
    return;
  }
  const query = await idePrompt(`File symbol query (${path}):`, "");
  if (query === null) {
    return;
  }
  const symbols = await fetchSymbols(query.trim(), path);
  renderSymbolHits(symbols);
  setStatus(`File symbols: ${symbols.length}`);
}

async function workspaceSymbolSearchFlow() {
  const query = await idePrompt("Workspace symbol query:", "");
  if (query === null) {
    return;
  }
  const symbols = await fetchSymbols(query.trim(), "");
  renderSymbolHits(symbols);
  setStatus(`Workspace symbols: ${symbols.length}`);
}

async function loadFsAuditLog() {
  const events = await apiJson("/api/ide/fs/audit?limit=80", {
    method: "GET",
    headers: apiHeaders(),
  });
  el.searchPanel.innerHTML = "";
  if (!Array.isArray(events) || events.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No filesystem mutation events.";
    el.searchPanel.appendChild(empty);
    return;
  }
  for (const event of events) {
    const row = document.createElement("div");
    row.className = "muted";
    row.textContent = `${event.ts_secs || 0}  ${event.action || "event"}  ${event.path || ""}`;
    el.searchPanel.appendChild(row);
  }
  setStatus(`Filesystem audit events: ${events.length}`);
}

function idePrompt(title, defaultValue = "") {
  return new Promise((resolve) => {
    el.inputModalTitle.textContent = title;
    el.inputModalField.value = defaultValue;
    el.inputModal.classList.add("open");
    el.inputModalField.focus();
    el.inputModalField.select();

    const cleanup = () => {
      el.inputModal.classList.remove("open");
      el.inputModalOk.removeEventListener("click", onOk);
      el.inputModalCancel.removeEventListener("click", onCancel);
      el.inputModalField.removeEventListener("keydown", onKey);
      el.inputModal.removeEventListener("click", onBackdrop);
    };
    const onOk = () => { cleanup(); resolve(el.inputModalField.value); };
    const onCancel = () => { cleanup(); resolve(null); };
    const onKey = (e) => {
      if (e.key === "Enter") { e.preventDefault(); onOk(); }
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    };
    const onBackdrop = (e) => { if (e.target === el.inputModal) onCancel(); };
    el.inputModalOk.addEventListener("click", onOk);
    el.inputModalCancel.addEventListener("click", onCancel);
    el.inputModalField.addEventListener("keydown", onKey);
    el.inputModal.addEventListener("click", onBackdrop);
  });
}

function ideConfirm(title, message) {
  return new Promise((resolve) => {
    el.confirmModalTitle.textContent = title;
    el.confirmModalMessage.textContent = message;
    el.confirmModal.classList.add("open");
    el.confirmModalOk.focus();

    const cleanup = () => {
      el.confirmModal.classList.remove("open");
      el.confirmModalOk.removeEventListener("click", onOk);
      el.confirmModalCancel.removeEventListener("click", onCancel);
      el.confirmModal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
    };
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onKey = (e) => {
      if (e.key === "Enter") { e.preventDefault(); onOk(); }
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    };
    const onBackdrop = (e) => { if (e.target === el.confirmModal) onCancel(); };
    el.confirmModalOk.addEventListener("click", onOk);
    el.confirmModalCancel.addEventListener("click", onCancel);
    el.confirmModal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

// ── Command Palette ────────────────────────────────────

function nextTab() {
  const paths = [...state.openTabs.keys()];
  if (paths.length <= 1 || !state.activePath) {
    return;
  }
  const index = paths.indexOf(state.activePath);
  const next = paths[(index + 1) % paths.length];
  switchTab(next).catch(() => {});
}

function previousTab() {
  const paths = [...state.openTabs.keys()];
  if (paths.length <= 1 || !state.activePath) {
    return;
  }
  const index = paths.indexOf(state.activePath);
  const prev = paths[(index - 1 + paths.length) % paths.length];
  switchTab(prev).catch(() => {});
}

function closePalette() {
  el.commandPalette.classList.remove("open");
  el.commandInput.value = "";
  state.commandFilter = "";
}

