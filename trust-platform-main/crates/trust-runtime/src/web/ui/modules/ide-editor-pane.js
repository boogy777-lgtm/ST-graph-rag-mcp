function syncDocumentsToWasm() {
  if (!wasmClient) {
    return;
  }
  const documents = [];
  for (const [path, tab] of state.openTabs) {
    if (isStructuredTextPath(path)) {
      documents.push({ uri: path, text: tab.content });
    }
  }
  if (documents.length === 0) {
    return;
  }
  wasmClient.applyDocuments(documents).catch((error) => {
    console.warn("[IDE] WASM document sync failed:", error);
  });
}

function editorText() {
  return state.editorView ? state.editorView.getValue() : "";
}

function setActiveContent(content) {
  if (!state.editorView) {
    return;
  }
  const current = state.editorView.getValue();
  if (current === content) {
    return;
  }
  state.suppressEditorChange = true;
  state.editorView.setValue(content);
  state.suppressEditorChange = false;
}

function updateCursorLabel() {
  if (!state.editorView) {
    return;
  }
  const pos = fromMonacoPosition(state.editorView.getPosition());
  el.cursorLabel.textContent = `Ln ${pos.line + 1}, Col ${pos.character + 1}`;
}

function cursorPosition() {
  if (!state.editorView) {
    return null;
  }
  return fromMonacoPosition(state.editorView.getPosition());
}

function applyMonacoMarkers(items, model) {
  if (!monaco || !model) {
    return;
  }
  const markers = Array.isArray(items)
    ? items.map((item) => {
      const range = toMonacoRange(item.range || {}, model);
      return {
        startLineNumber: range.startLineNumber,
        startColumn: range.startColumn,
        endLineNumber: range.endLineNumber,
        endColumn: Math.max(range.startColumn + 1, range.endColumn),
        severity: monacoMarkerSeverity(item.severity),
        message: item.message || "diagnostic",
        code: item.code ? String(item.code) : undefined,
      };
    })
    : [];
  monaco.editor.setModelMarkers(model, MONACO_MARKER_OWNER, markers);
}

function setModelLanguageForPath(model, path) {
  if (!monaco || !model) {
    return;
  }
  monaco.editor.setModelLanguage(model, monacoLanguageForPath(path));
}

function disposeEditorDisposables() {
  for (const disposable of state.editorDisposables) {
    try {
      disposable.dispose();
    } catch {
      // no-op
    }
  }
  state.editorDisposables = [];
}

function scheduleAutoCompletionTrigger() {
  if (completionTriggerTimer) {
    clearTimeout(completionTriggerTimer);
    completionTriggerTimer = null;
  }
  completionTriggerTimer = setTimeout(() => {
    startCompletion();
  }, 120);
}

function maybeTriggerCompletionOnEdit(event) {
  const tab = activeTab();
  if (!tab || !isStructuredTextPath(tab.path) || !state.editorView) {
    return;
  }
  if (!Array.isArray(event?.changes) || event.changes.length !== 1) {
    return;
  }
  const change = event.changes[0];
  if (!change || typeof change.text !== "string") {
    return;
  }
  if (change.text.length !== 1) {
    return;
  }
  if (!/[A-Za-z0-9_.]/.test(change.text)) {
    return;
  }
  scheduleAutoCompletionTrigger();
}

function clearHoverPopupTimer() {
  if (cursorHoverPopupTimer) {
    clearTimeout(cursorHoverPopupTimer);
    cursorHoverPopupTimer = null;
  }
}

function scheduleHoverPopupOnMouse(event) {
  clearHoverPopupTimer();
  const tab = activeTab();
  if (!tab || !isStructuredTextPath(tab.path) || !state.editorView) {
    return;
  }
  const target = event?.target;
  const position = target?.position;
  if (!position) {
    return;
  }
  if (monaco?.editor?.MouseTargetType && typeof target?.type === "number") {
    const type = target.type;
    const allowed = new Set([
      monaco.editor.MouseTargetType.CONTENT_TEXT,
      monaco.editor.MouseTargetType.CONTENT_EMPTY,
    ]);
    if (!allowed.has(type)) {
      return;
    }
  }
  cursorHoverPopupTimer = setTimeout(() => {
    if (!state.editorView) {
      return;
    }
    state.editorView.trigger("mouse", "editor.action.showHover", {
      lineNumber: position.lineNumber,
      column: position.column,
    });
  }, 260);
}

function scheduleDocumentHighlight(editor) {
  if (documentHighlightTimer) {
    clearTimeout(documentHighlightTimer);
    documentHighlightTimer = null;
  }
  documentHighlightTimer = setTimeout(() => {
    updateDocumentHighlights(editor);
  }, 150);
}

async function updateDocumentHighlights(editor) {
  if (!wasmClient || !editor) {
    return;
  }
  const model = editor.getModel();
  if (!model) {
    documentHighlightDecorations = editor.deltaDecorations(documentHighlightDecorations, []);
    return;
  }
  const tab = activeTab();
  if (!tab || !isStructuredTextPath(tab.path)) {
    documentHighlightDecorations = editor.deltaDecorations(documentHighlightDecorations, []);
    return;
  }
  const position = fromMonacoPosition(editor.getPosition());
  try {
    const highlights = await wasmClient.documentHighlight(tab.path, position);
    if (!Array.isArray(highlights) || highlights.length === 0) {
      documentHighlightDecorations = editor.deltaDecorations(documentHighlightDecorations, []);
      return;
    }
    const decorations = highlights.map((h) => ({
      range: toMonacoRange(h.range, model),
      options: {
        className: h.kind === "write" ? "ide-document-highlight-write" : "ide-document-highlight-read",
        overviewRuler: {color: "#14b8a680", position: monaco.editor.OverviewRulerLane.Center},
      },
    }));
    documentHighlightDecorations = editor.deltaDecorations(documentHighlightDecorations, decorations);
  } catch {
    documentHighlightDecorations = editor.deltaDecorations(documentHighlightDecorations, []);
  }
}

