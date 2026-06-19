  if (!state.splitEnabled || !state.editorView) {
    return;
  }
  const path = state.secondaryPath;
  if (!path) {
    return;
  }
  const tab = state.openTabs.get(path);
  if (tab) {
    setSecondaryEditorContent(tab.content, tab.path);
  }
}

function openInSecondaryPane(path, content) {
  const tab = state.openTabs.get(path);
  if (!tab && !content) {
    return;
  }
  state.secondaryPath = path;
  state.secondaryOpenTabs.add(path);
  setSecondaryEditorContent(content || tab.content, path);
}

function toggleSplitEditor() {
  state.splitEnabled = !state.splitEnabled;
  el.editorGrid.classList.toggle("split", state.splitEnabled);
  el.editorPaneSecondary.classList.toggle("ide-hidden", !state.splitEnabled);
  el.splitBtn.setAttribute("aria-label", state.splitEnabled ? "Single editor" : "Toggle split editor");
  el.splitBtn.title = state.splitEnabled ? "Single" : "Split";
  if (state.splitEnabled) {
    // Show per-pane tab bars, hide the shared tab bar
    el.tabBar.classList.add("ide-hidden");
    el.tabBarPrimary.classList.remove("ide-hidden");

    setActivePane("primary");
    if (!state.secondaryPath || state.secondaryPath === state.activePath) {
      for (const [p] of state.openTabs) {
        if (p !== state.activePath) {
          state.secondaryPath = p;
          break;
        }
      }
    }
    // Seed secondary tab set
    if (state.secondaryPath) {
      state.secondaryOpenTabs.add(state.secondaryPath);
    }
    syncSecondaryEditor();
    renderTabs();
  } else {
    // Restore shared tab bar, hide per-pane tab bars
    el.tabBar.classList.remove("ide-hidden");
    el.tabBarPrimary.classList.add("ide-hidden");

    // Merge secondary tabs back into shared openTabs (they already share the Map)
    state.secondaryOpenTabs.clear();
    setActivePane("primary");
    renderTabs();
  }
}

function setEditorContent(text) {
  if (!state.editorView) {
    return;
  }
  const current = state.editorView.getValue();
  if (current === text) {
    return;
  }
  state.suppressEditorChange = true;
  state.editorView.setValue(text);
  state.suppressEditorChange = false;
  syncSecondaryEditor();
  scheduleDiagnostics({immediate: true});
}

