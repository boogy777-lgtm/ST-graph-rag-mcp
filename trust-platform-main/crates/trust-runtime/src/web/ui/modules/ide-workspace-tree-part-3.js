  const path = String(pathStr || "").trim();
  if (!path) return;

  // US-2.2: Prompt to save unsaved changes before switching projects
  const dirtyCount = [...state.openTabs.values()].filter((t) => t.dirty).length;
  if (dirtyCount > 0) {
    const save = await ideConfirm("Unsaved Changes", `Save ${dirtyCount} unsaved file(s) before switching projects?`);
    if (save) {
      await flushDirtyTabs();
    }
  }

  // US-2.2: Warn if the folder has no .st files
  try {
    const browseResult = await apiJson(`/api/ide/browse?path=${encodeURIComponent(path)}`, {
      method: "GET",
      headers: apiHeaders(),
      timeoutMs: 2000,
    });
    const entries = Array.isArray(browseResult.entries) ? browseResult.entries : [];
    const hasSt = entries.some((e) =>
      e.kind === "file" && e.name.toLowerCase().endsWith(".st")
    );
    if (!hasSt) {
      const proceed = await ideConfirm("No ST files", "No .st files found in this folder. Open anyway?");
      if (!proceed) return;
    }
  } catch {
    // Ignore browse errors and proceed with open
  }

  const selection = await apiJson("/api/ide/project/open", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({path}),
  });
  applyProjectSelection(selection || {});
  saveRecentProject(state.activeProject || path);

  state.tree = [];
  state.files = [];
  state.openTabs.clear();
  state.secondaryOpenTabs.clear();
  state.activePath = null;
  state.selectedPath = null;
  state.secondaryPath = null;
  state.references = [];
  state.searchHits = [];
  showWelcomeScreen();
  renderFileTree();
  renderTabs();
  renderBreadcrumbs(null);
  renderReferences([]);
  renderSearchHits([]);
  if (state.editorView) {
    state.suppressEditorChange = true;
    state.editorView.setValue("");
    state.suppressEditorChange = false;
    applyMonacoMarkers([], activeModel());
  }
  updateDraftInfo();
  setStatus(`Opened project: ${state.activeProject || path}`);
  await bootstrapFiles();
}

async function openProjectFlow() {
  openProjectPanel();
}

async function bootstrapFiles() {
  if (!state.activeProject) {
    state.tree = [];
    state.files = [];
    renderFileTree();
    renderBreadcrumbs(null);
    return;
  }
  let result;
  try {
    result = await apiJson("/api/ide/tree", {
      method: "GET",
      headers: apiHeaders(),
    });
  } catch (error) {
    const message = String(error?.message || error).toLowerCase();
    if (message.includes("project root unavailable")) {
      applyProjectSelection({active_project: null, startup_project: state.startupProject});
      state.tree = [];
      state.files = [];
      renderFileTree();
      renderBreadcrumbs(null);
      setStatus("No project selected. Use Open Folder.");
      return;
    }
    throw error;
  }
  state.tree = Array.isArray(result.tree) ? result.tree : [];
  state.files = flattenFiles(state.tree, []).sort((a, b) => a.localeCompare(b));
  renderFileTree();
  if (!state.activePath && state.files.length > 0) {
    await openFile(state.files[0]);
  } else if (!state.activePath) {
    renderBreadcrumbs(null);
  }
}
