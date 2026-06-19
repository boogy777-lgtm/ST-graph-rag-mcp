function activeTab() {
  if (!state.activePath) {
    return null;
  }
  return state.openTabs.get(state.activePath) || null;
}

function saveDraft(path, content) {
  try {
    localStorage.setItem(`${DRAFT_PREFIX}${path}`, content);
    return true;
  } catch (error) {
    const message = String(error?.message || error);
    bumpTelemetry("autosave_failures");
    updateSaveBadge("err", "draft full");
    setStatus(`Local draft storage failed: ${message}`);
    return false;
  }
}

function loadDraft(path) {
  return localStorage.getItem(`${DRAFT_PREFIX}${path}`);
}

function clearDraft(path) {
  localStorage.removeItem(`${DRAFT_PREFIX}${path}`);
}

async function saveActiveTab({explicit = false} = {}) {
  const tab = activeTab();
  if (!tab) {
    return;
  }
  if (!state.writeEnabled || tab.readOnly) {
    updateSaveBadge("warn", "read-only");
    return;
  }
  const latestContent = state.editorView.getValue();
  tab.content = latestContent;
  if (tab.content === tab.savedContent && !explicit) {
    updateSaveBadge("ok", "saved");
    return;
  }

  if (!state.online) {
    updateSaveBadge("err", "offline draft");
    saveDraft(tab.path, tab.content);
    updateDraftInfo();
    return;
  }

  updateSaveBadge("warn", "saving...");
  try {
    const result = await apiJson("/api/ide/file", {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        path: tab.path,
        expected_version: tab.version,
        content: tab.content,
      }),
    });
    tab.version = result.version;
    tab.savedContent = tab.content;
    tab.dirty = false;
    clearDraft(tab.path);
    renderTabs();
    updateDraftInfo();
    updateSaveBadge("ok", "saved");
    document.dispatchEvent(new CustomEvent("ide-file-saved", {
      detail: {
        path: tab.path,
        version: tab.version,
      },
    }));
    if (state.lastFailedAction?.kind === "save") {
      setRetryAction(null, `Saved ${tab.path}`);
    } else {
      setStatus(`Saved ${tab.path}`);
    }
  } catch (error) {
    const message = String(error.message || error);
    if (message.includes("current version")) {
      updateSaveBadge("err", "conflict");
      setRetryAction({kind: "save", path: tab.path}, `Save conflict on ${tab.path}. Retry after merge/reload.`);
    } else {
      bumpTelemetry("autosave_failures");
      updateSaveBadge("err", "save failed");
      setRetryAction({kind: "save", path: tab.path}, `Save failed: ${message}`);
    }
    saveDraft(tab.path, tab.content);
    updateDraftInfo();
  }
}

function scheduleAutosave() {
  if (state.autosaveTimer) {
    clearTimeout(state.autosaveTimer);
  }
  state.autosaveTimer = setTimeout(() => {
    saveActiveTab().catch(() => {});
  }, 800);
}

async function flushDirtyTabs() {
  for (const [path, tab] of state.openTabs.entries()) {
    if (!tab.dirty) {
      continue;
    }
    const prev = state.activePath;
    if (path !== state.activePath) {
      await switchTab(path, {preserveSelection: true});
    }
    await saveActiveTab();
    if (prev && prev !== state.activePath) {
      await switchTab(prev, {preserveSelection: true});
    }
  }
}

async function formatActiveDocument() {
  const tab = activeTab();
  if (!tab || !state.editorView) {
    return;
  }
  if (!isStructuredTextPath(tab.path)) {
    setStatus("Format document is available for .st files.");
    return;
  }
  const result = await apiJson("/api/ide/format", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      path: tab.path,
      content: editorText(),
    }),
    timeoutMs: 2500,
  });
  if (!result || typeof result.content !== "string") {
    setStatus("Format did not return document content.");
    return;
  }
  setEditorContent(result.content);
  const currentTab = activeTab();
  if (currentTab) {
    currentTab.content = result.content;
    const dirty = currentTab.content !== currentTab.savedContent;
    markTabDirty(currentTab.path, dirty);
    updateDraftInfo();
    if (dirty) {
      saveDraft(currentTab.path, currentTab.content);
      updateSaveBadge("warn", "dirty");
    } else {
      clearDraft(currentTab.path);
      updateSaveBadge("ok", "saved");
    }
  }
  setStatus(result.changed ? `Formatted ${tab.path}` : `No formatting changes for ${tab.path}`);
}

function parentDirectory(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "";
  }
  parts.pop();
  return parts.join("/");
}

function selectedDirectory() {
  if (state.selectedPath) {
    const selectedNode = state.selectedPath;
    const kind = nodeKindForPath(selectedNode);
    if (kind === "file") {
      return parentDirectory(selectedNode);
    }
    if (kind === "directory") {
      return selectedNode;
    }
  }
  if (state.activePath) {
    return parentDirectory(state.activePath);
  }
  return "";
}

function remapOpenTabs(oldPath, newPath, isDirectory) {
  const next = new Map();
  for (const [path, tab] of state.openTabs.entries()) {
    if (path === oldPath || (isDirectory && path.startsWith(`${oldPath}/`))) {
      const suffix = path.slice(oldPath.length);
      const mapped = `${newPath}${suffix}`;
      next.set(mapped, {...tab, path: mapped});
    } else {
      next.set(path, tab);
    }
  }
  state.openTabs = next;
  // Remap secondaryOpenTabs
  const nextSecondary = new Set();
  for (const path of state.secondaryOpenTabs) {
    if (path === oldPath || (isDirectory && path.startsWith(`${oldPath}/`))) {
      const suffix = path.slice(oldPath.length);
      nextSecondary.add(`${newPath}${suffix}`);
    } else {
      nextSecondary.add(path);
    }
  }
  state.secondaryOpenTabs = nextSecondary;
  if (state.activePath === oldPath || (isDirectory && state.activePath?.startsWith(`${oldPath}/`))) {
    const suffix = state.activePath.slice(oldPath.length);
    state.activePath = `${newPath}${suffix}`;
  }
  if (state.secondaryPath === oldPath || (isDirectory && state.secondaryPath?.startsWith(`${oldPath}/`))) {
    const suffix = state.secondaryPath.slice(oldPath.length);
    state.secondaryPath = `${newPath}${suffix}`;
  }
}

function removeTabsForPath(path, isDirectory) {
  for (const key of [...state.openTabs.keys()]) {
    if (key === path || (isDirectory && key.startsWith(`${path}/`))) {
      state.openTabs.delete(key);
      state.secondaryOpenTabs.delete(key);
    }
  }
  if (state.activePath === path || (isDirectory && state.activePath?.startsWith(`${path}/`))) {
    state.activePath = null;
  }
  if (state.secondaryPath === path || (isDirectory && state.secondaryPath?.startsWith(`${path}/`))) {
    state.secondaryPath = null;
  }
}
