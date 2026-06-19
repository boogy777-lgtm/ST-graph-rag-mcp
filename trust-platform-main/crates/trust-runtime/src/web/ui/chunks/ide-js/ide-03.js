    flushDirtyTabs().catch(() => {});
    flushFrontendTelemetry().catch(() => {});
  });

  window.addEventListener("offline", () => {
    state.online = false;
    updateConnectionBadge();
    updateSaveBadge("err", "offline draft");
    setStatus("Connection lost. Drafts are stored locally.");
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== IDE_PRESENCE_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      consumePresencePayload(JSON.parse(event.newValue));
    } catch {
      // no-op
    }
  });

  window.addEventListener("keydown", (event) => {
    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && event.shiftKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      openCommandPalette();
      return;
    }
    if (isMod && event.shiftKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      if (typeof openConnectionDialog === "function") {
        openConnectionDialog();
      }
      return;
    }
    if (isMod && !event.shiftKey && event.altKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      fileSymbolSearchFlow().catch((error) => setStatus(`File symbols failed: ${error.message || error}`));
      return;
    }
    if (isMod && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      workspaceSearchFlow().catch((error) => setStatus(`Search failed: ${error.message || error}`));
      return;
    }
    if (isMod && !event.shiftKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      openQuickOpenPalette();
      return;
    }
    if (event.key === "F1") {
      event.preventDefault();
      openCommandPalette();
      return;
    }
    if (event.shiftKey && event.altKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      formatActiveDocument().catch((error) => setStatus(`Format failed: ${error.message || error}`));
      return;
    }
    if (isMod && !event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveActiveTab({explicit: true}).catch(() => {});
      return;
    }
    if (isMod && event.code === "Space") {
      event.preventDefault();
      startCompletion();
      return;
    }
    if (isMod && event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        previousTab();
      } else {
        nextTab();
      }
      return;
    }
    if (event.key === "F12" && !event.shiftKey) {
      event.preventDefault();
      gotoDefinitionAtCursor().catch((error) => setStatus(`Definition failed: ${error.message || error}`));
      return;
    }
    if (event.key === "F12" && event.shiftKey) {
      event.preventDefault();
      findReferencesAtCursor().catch((error) => setStatus(`References failed: ${error.message || error}`));
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      renameSymbolAtCursor().catch((error) => setStatus(`Rename failed: ${error.message || error}`));
    }
    if (event.key === "Escape" && el.openProjectPanel.classList.contains("open")) {
      closeOpenProjectPanel();
      return;
    }
    if (event.key === "Escape" && el.commandPalette.classList.contains("open")) {
      closePalette();
      return;
    }
    if (event.key === "Escape" && el.moreActionsBtn && el.moreActionsBtn.getAttribute("aria-expanded") === "true") {
      closeMoreActionsMenu();
      return;
    }
    if (event.key === "Escape" && !el.treeContextMenu.classList.contains("ide-hidden")) {
      closeTreeContextMenu();
    }
  });

  window.addEventListener("beforeunload", () => {
    flushFrontendTelemetry().catch(() => {});
    stopTaskPolling();
    disposeEditorDisposables();
    completionProviderDisposable?.dispose();
    hoverProviderDisposable?.dispose();
    if (cursorInsightTimer) {
      clearTimeout(cursorInsightTimer);
      cursorInsightTimer = null;
    }
    if (completionTriggerTimer) {
      clearTimeout(completionTriggerTimer);
      completionTriggerTimer = null;
    }
    if (cursorHoverPopupTimer) {
      clearHoverPopupTimer();
    }
    if (state.editorView) {
      state.editorView.dispose();
    }
    if (state.secondaryEditorView) {
      state.secondaryEditorView.dispose();
    }
    if (state.presenceChannel) {
      state.presenceChannel.close();
    }
  });
}

// ── Bootstrap ──────────────────────────────────────────

async function bootstrapUiMode() {
  try {
    const modePayload = await apiJson("/api/ui/mode", {
      method: "GET",
      timeoutMs: 3000,
    });
    state.uiMode = modePayload.mode || "runtime";
  } catch {
    state.uiMode = "runtime";
  }
  state.standaloneMode = state.uiMode === "standalone-ide";
  if (!state.standaloneMode) {
    return;
  }

  if (el.statusText) {
    el.statusText.textContent = "Standalone mode: runtime not connected";
  }
}

async function bootstrapSession() {
  const caps = await apiJson("/api/ide/capabilities");
  state.writeEnabled = caps.mode === "authoring";
  el.statusMode.textContent = state.writeEnabled ? "Authoring" : "Read-only";
  el.newFileBtn.disabled = !state.writeEnabled;
  el.newFolderBtn.disabled = !state.writeEnabled;
  el.renamePathBtn.disabled = !state.writeEnabled;
  el.deletePathBtn.disabled = !state.writeEnabled;
  el.saveBtn.disabled = !state.writeEnabled;
  el.saveAllBtn.disabled = !state.writeEnabled;
  el.validateBtn.disabled = !state.writeEnabled;
  el.buildBtn.disabled = !state.writeEnabled;
  el.testBtn.disabled = !state.writeEnabled;

  const role = state.writeEnabled ? "editor" : "viewer";
  let session = null;
  const stored = loadStoredIdeSession(role);
  if (stored && stored.token) {
    state.sessionToken = stored.token;
    try {
      await apiJson("/api/ide/project", {
        method: "GET",
        headers: apiHeaders(),
        timeoutMs: 3000,
        allowSessionRetry: false,
      });
      session = { token: stored.token, role: stored.role };
    } catch {
      state.sessionToken = null;
      clearStoredIdeSession();
    }
  }
  if (!session) {
    session = await requestNewSession(role);
  }
  state.sessionToken = session.token;
  persistIdeSession(state.sessionToken, session.role || role);
  setStatus(`Session ${session.role} active. ${state.writeEnabled ? "Autosave enabled." : "Read-only mode."}`);
  await refreshProjectSelection();
  document.dispatchEvent(new CustomEvent("ide-session-ready", {
    detail: {
      token: state.sessionToken,
      activeProject: state.activeProject,
      startupProject: state.startupProject,
    },
  }));
}

async function bootstrap() {
  updateConnectionBadge();
  applyWorkbenchSizing();
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (!storedTheme) {
    const preferred = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    applyTheme(preferred);
  } else {
    applyTheme(storedTheme);
  }

  bindGlobalEvents();
  try {
    await bootstrapUiMode();
    const modulesLoaded = await loadEditorModules();
    if (!modulesLoaded) {
      bumpTelemetry("bootstrap_failures");
      flushFrontendTelemetry().catch(() => {});
      return;
    }
    await bootstrapSession();
    await loadPresenceModel();
    await bootstrapFiles();
    await initWasmAnalysis();
    syncDocumentsToWasm();
    await pollHealth();
    scheduleHealthPoll();
    scheduleTelemetryFlush();
    renderReferences([]);
    renderSearchHits([]);
    renderTaskOutput(null);
    setRetryAction(null, null);
    el.splitBtn.title = "Split";
    if (typeof onlineState === "object" && onlineState && onlineState.connected) {
      setStatus("IDE ready.");
    } else {
      setStatus("No runtime connected");
    }
    updateSaveBadge("ok", state.writeEnabled ? "saved" : "read-only");
    state.ready = true;
  } catch (error) {
    bumpTelemetry("bootstrap_failures");
    const reason = String(error?.message || error);
    if (reason.toLowerCase().includes("too many active ide sessions")) {
      setStatus("IDE bootstrap failed: session limit reached. Close inactive tabs or restart runtime.");
    } else {
      setStatus(`IDE bootstrap failed: ${reason}`);
    }
    updateSaveBadge("err", "error");
    flushFrontendTelemetry().catch(() => {});
  }
}

bootstrap();
