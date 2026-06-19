  const word = model.getWordAtPosition(position);
  if (!word || !word.word) {
    return null;
  }
  return {
    range: new monaco.Range(
      position.lineNumber,
      word.startColumn,
      position.lineNumber,
      word.endColumn,
    ),
    contents: [{value: `\`\`\`st\n${word.word}\n\`\`\``}],
  };
}

function defineMonacoThemes() {
  monaco.editor.defineTheme("trust-light", {
    base: "vs",
    inherit: true,
    rules: [
      {token: "keyword.st", foreground: "0f766e", fontStyle: "bold"},
      {token: "number.st", foreground: "875f00"},
    ],
    colors: {
      "editor.background": "#ffffff",
      "editorCursor.foreground": "#0f766e",
      "editorLineNumber.foreground": "#7e8aa1",
      "editorLineNumber.activeForeground": "#213047",
      "editorGutter.background": "#f6f3ee",
      "editor.selectionBackground": "#0f766e22",
      "editor.inactiveSelectionBackground": "#0f766e11",
      "editor.wordHighlightBackground": "#0f766e30",
      "editor.wordHighlightStrongBackground": "#0f766e45",
      "editor.selectionHighlightBackground": "#0f766e20",
      "editor.selectionHighlightBorder": "#0f766e50",
      "editorWidget.background": "#f4f2ef",
      "editorWidget.foreground": "#1b1a18",
      "editorWidget.border": "#c8d8d4",
      "editorHoverWidget.background": "#f4f2ef",
      "editorHoverWidget.foreground": "#1b1a18",
      "editorHoverWidget.border": "#c8d8d4",
      "editorSuggestWidget.background": "#f4f2ef",
      "editorSuggestWidget.foreground": "#1b1a18",
      "editorSuggestWidget.border": "#c8d8d4",
      "editorSuggestWidget.selectedBackground": "#d9ece8",
      "editorSuggestWidget.highlightForeground": "#0f766e",
    },
  });
  monaco.editor.defineTheme("trust-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      {token: "keyword.st", foreground: "14b8a6", fontStyle: "bold"},
      {token: "number.st", foreground: "e0c95a"},
    ],
    colors: {
      "editor.background": "#0f1115",
      "editorCursor.foreground": "#14b8a6",
      "editorLineNumber.foreground": "#6f7d9b",
      "editorLineNumber.activeForeground": "#dce6ff",
      "editorGutter.background": "#141821",
      "editor.selectionBackground": "#14b8a633",
      "editor.inactiveSelectionBackground": "#14b8a619",
      "editor.wordHighlightBackground": "#14b8a635",
      "editor.wordHighlightStrongBackground": "#14b8a650",
      "editor.selectionHighlightBackground": "#14b8a625",
      "editor.selectionHighlightBorder": "#14b8a655",
      "editorWidget.background": "#1f2430",
      "editorWidget.foreground": "#f2f2f2",
      "editorWidget.border": "#3c4b66",
      "editorHoverWidget.background": "#1f2430",
      "editorHoverWidget.foreground": "#f2f2f2",
      "editorHoverWidget.border": "#3c4b66",
      "editorSuggestWidget.background": "#1f2430",
      "editorSuggestWidget.foreground": "#f2f2f2",
      "editorSuggestWidget.border": "#3c4b66",
      "editorSuggestWidget.selectedBackground": "#1f3c4a",
      "editorSuggestWidget.highlightForeground": "#5eead4",
    },
  });
}

