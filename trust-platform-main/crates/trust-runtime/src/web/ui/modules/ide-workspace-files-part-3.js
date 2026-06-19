async function openFile(path, {targetPane} = {}) {
  const pane = targetPane || state.activePane;

  // Ensure the file is loaded into openTabs
  if (!state.openTabs.has(path)) {
    setStatus(`Opening ${path}...`);
    const snapshot = await apiJson(`/api/ide/file?path=${encodeURIComponent(path)}`, {
      method: "GET",
      headers: apiHeaders(),
    });
    const draft = loadDraft(path);
    const content = draft ?? snapshot.content;
    state.openTabs.set(path, {
      path,
      version: Number(snapshot.version),
      savedContent: snapshot.content,
      content,
      dirty: draft !== null && draft !== snapshot.content,
      readOnly: Boolean(snapshot.read_only),
    });
    syncDocumentsToWasm();
  }

  // Route to the correct pane
  if (state.splitEnabled && pane === "secondary") {
    const tab = state.openTabs.get(path);
    openInSecondaryPane(path, tab.content);
    renderTabs();
    return;
  }

  await switchTab(path);
}

function showWelcomeScreen() {
  el.editorWelcome.style.display = "";
  el.editorGrid.style.display = "none";
}

async function switchTab(path, {preserveSelection = false} = {}) {
  const tab = state.openTabs.get(path);
  if (!tab) {
    return;
  }

  if (state.activePath && state.editorView) {
    const previous = state.openTabs.get(state.activePath);
    if (previous) {
      previous.content = state.editorView.getValue();
    }
  }

  state.activePath = path;
  state.selectedPath = path;
  document.dispatchEvent(new CustomEvent("ide-active-path-change", {
    detail: {
      path,
    },
  }));
  renderBreadcrumbs(path);
  el.editorTitle.textContent = `Editor - ${path}`;
  el.editorWelcome.style.display = "none";
  el.editorGrid.style.display = "";

  if (!state.editorView) {
    state.editorView = createEditor(tab.content, tab.path);
  } else {
    setEditorContent(tab.content);
    setModelLanguageForPath(activeModel(), tab.path);
  }
  state.editorView.updateOptions({
    readOnly: !state.writeEnabled || Boolean(tab.readOnly),
  });

  if (!preserveSelection) {
    const model = activeModel();
    const firstColumn = model ? model.getLineFirstNonWhitespaceColumn(1) || 1 : 1;
    const position = new monaco.Position(1, firstColumn);
    state.editorView.setPosition(position);
    state.editorView.revealPositionInCenter(position);
  }

  state.editorView.focus();
  renderFileTree();
  renderTabs();
  syncSecondaryEditor();
  updateCursorLabel();
  scheduleCursorInsights(cursorPosition());
  updateDraftInfo();
  updateSaveBadge(tab.dirty ? "warn" : "ok", tab.dirty ? "dirty" : "saved");
  scheduleDiagnostics({immediate: true});
  setStatus(`Active file: ${path}`);
  postPresenceEvent(path);
  refreshMultiTabCollision();
}
