function createEditor(initialContent, path) {
  const model = monaco.editor.createModel(initialContent, monacoLanguageForPath(path));
  const view = monaco.editor.create(el.editorMount, {
    model,
    readOnly: !state.writeEnabled,
    automaticLayout: true,
    minimap: {enabled: true, scale: 1, showSlider: "mouseover"},
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    fontFamily: "JetBrains Mono, Fira Code, IBM Plex Mono, monospace",
    fontSize: 13,
    lineHeight: 20,
    tabSize: 2,
    insertSpaces: true,
    quickSuggestions: {other: true, comments: false, strings: true},
    quickSuggestionsDelay: 120,
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: "off",
    parameterHints: {enabled: true},
    snippetSuggestions: "inline",
    hover: {enabled: "on", delay: 250, sticky: true},
    occurrencesHighlight: "singleFile",
    selectionHighlight: true,
    bracketPairColorization: {enabled: true},
    smoothScrolling: true,
    renderLineHighlight: "all",
    padding: {top: 8, bottom: 8},
    theme: document.body.dataset.theme === "dark" ? "trust-dark" : "trust-light",
  });

  disposeEditorDisposables();

  state.editorDisposables.push(view.onDidChangeModelContent((event) => {
    if (state.suppressEditorChange) {
      return;
    }
    const tab = activeTab();
    if (!tab) {
      return;
    }
    tab.content = view.getValue();
    const dirty = tab.content !== tab.savedContent;
    markTabDirty(tab.path, dirty);
    updateDraftInfo();
    if (dirty) {
      const draftStored = saveDraft(tab.path, tab.content);
      scheduleAutosave();
      if (draftStored) {
        updateSaveBadge(state.online ? "warn" : "err", state.online ? "dirty" : "offline draft");
      }
    } else {
      clearDraft(tab.path);
      updateSaveBadge("ok", "saved");
    }
    syncSecondaryEditor();
    updateCursorLabel();
    syncDocumentsToWasm();
    scheduleDiagnostics();
    maybeTriggerCompletionOnEdit(event);
  }));

  state.editorDisposables.push(view.onDidType((text) => {
    const tab = activeTab();
    if (!tab || !isStructuredTextPath(tab.path)) {
      return;
    }
    const char = String(text || "").slice(-1);
    if (/[A-Za-z0-9_.]/.test(char)) {
      scheduleAutoCompletionTrigger();
    }
  }));

  state.editorDisposables.push(view.onDidChangeCursorPosition((event) => {
    updateCursorLabel();
    scheduleCursorInsights(fromMonacoPosition(event.position));
    scheduleDocumentHighlight(view);
  }));

  state.editorDisposables.push(view.onMouseMove((event) => {
    scheduleHoverPopupOnMouse(event);
  }));

  state.editorDisposables.push(view.onMouseLeave(() => {
    clearHoverPopupTimer();
  }));

  view.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    saveActiveTab({explicit: true}).catch(() => {});
  });
  view.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
    startCompletion();
  });
  view.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
    openCommandPalette();
  });

  return view;
}

function createSecondaryEditor(initialContent, path) {
  const model = monaco.editor.createModel(initialContent, monacoLanguageForPath(path));
  return monaco.editor.create(el.editorMountSecondary, {
    model,
    readOnly: true,
    automaticLayout: true,
    minimap: {enabled: false},
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    fontFamily: "JetBrains Mono, Fira Code, IBM Plex Mono, monospace",
    fontSize: 13,
    lineHeight: 20,
    renderLineHighlight: "none",
    padding: {top: 8, bottom: 8},
    theme: document.body.dataset.theme === "dark" ? "trust-dark" : "trust-light",
  });
}

function setSecondaryEditorContent(text, path) {
  if (!state.secondaryEditorView) {
    state.secondaryEditorView = createSecondaryEditor(text, path);
    return;
  }
  setModelLanguageForPath(state.secondaryEditorView.getModel(), path);
  const current = state.secondaryEditorView.getValue();
  if (current === text) {
    return;
  }
  state.secondaryEditorView.setValue(text);
}

function setActivePane(pane) {
  state.activePane = pane;
  el.editorPanePrimary.classList.toggle("pane-active", pane === "primary");
  el.editorPaneSecondary.classList.toggle("pane-active", pane === "secondary");
}

function syncSecondaryEditor() {
