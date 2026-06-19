function configureMonacoLanguageSupport() {
  if (!monaco) {
    return;
  }

  if (!monaco.languages.getLanguages().some((language) => language.id === ST_LANGUAGE_ID)) {
    monaco.languages.register({
      id: ST_LANGUAGE_ID,
      extensions: [".st"],
      aliases: ["Structured Text", "ST"],
    });
    monaco.languages.setMonarchTokensProvider(ST_LANGUAGE_ID, {
      defaultToken: "",
      keywords: [
        "PROGRAM", "END_PROGRAM", "FUNCTION", "END_FUNCTION", "FUNCTION_BLOCK",
        "END_FUNCTION_BLOCK", "CONFIGURATION", "END_CONFIGURATION", "TASK", "INTERVAL",
        "PRIORITY", "PROGRAM", "WITH", "VAR", "VAR_INPUT", "VAR_OUTPUT", "VAR_IN_OUT",
        "VAR_GLOBAL", "VAR_CONFIG", "VAR_ACCESS", "END_VAR", "IF", "THEN", "ELSIF",
        "ELSE", "END_IF", "CASE", "OF", "END_CASE", "FOR", "TO", "BY", "DO", "END_FOR",
        "WHILE", "END_WHILE", "REPEAT", "UNTIL", "END_REPEAT", "TRUE", "FALSE", "BOOL",
        "INT", "DINT", "UINT", "UDINT", "REAL", "LREAL", "STRING",
      ],
      operators: [":=", "=", "<>", "<=", ">=", "<", ">", "+", "-", "*", "/", "AND", "OR", "NOT"],
      tokenizer: {
        root: [
          [/[A-Za-z_][A-Za-z0-9_]*/, {
            cases: {
              "@keywords": "keyword.st",
              "@default": "identifier",
            },
          }],
          [/[0-9]+(\.[0-9]+)?/, "number.st"],
          [/\/\/.*$/, "comment"],
          [/\(\*[\s\S]*?\*\)/, "comment"],
          [/".*?"/, "string"],
          [/'[^']*'/, "string"],
          [/[+\-*\/=<>:]+/, "operator"],
        ],
      },
    });
    monaco.languages.setLanguageConfiguration(ST_LANGUAGE_ID, {
      comments: {
        lineComment: "//",
        blockComment: ["(*", "*)"],
      },
      brackets: [
        ["(", ")"],
        ["[", "]"],
      ],
    });
  }

  defineMonacoThemes();

  completionProviderDisposable?.dispose();
  hoverProviderDisposable?.dispose();

  const triggerCharacters = [
    "_", ".", ...Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"),
  ];

  completionProviderDisposable = monaco.languages.registerCompletionItemProvider(ST_LANGUAGE_ID, {
    triggerCharacters,
    async provideCompletionItems(model, position) {
      if (!state.editorView || model !== state.editorView.getModel()) {
        return {suggestions: []};
      }
      const tab = activeTab();
      if (!tab || !isStructuredTextPath(tab.path)) {
        return {suggestions: []};
      }
      const cursor = fromMonacoPosition(position);
      const localSuggestions = buildLocalCompletionSuggestions(model, position);
      try {
        const items = await fetchCompletion(cursor, 80);
        if (!Array.isArray(items) || items.length === 0) {
          return {suggestions: localSuggestions};
        }
        const fallbackRange = fallbackCompletionRange(model, position);
        const suggestions = items
          .filter((item) => item && typeof item.label === "string" && item.label.length > 0)
          .map((item) => {
            let range = fallbackRange;
            if (item.text_edit?.range) {
              const candidateRange = toMonacoRange(item.text_edit.range, model);
              if (candidateRange.containsPosition(position)) {
                range = candidateRange;
              }
            }
            const priority = Number(item.sort_priority);
            const sortText = item.sort_text || (Number.isFinite(priority) ? String(priority).padStart(6, "0") : undefined);
            return {
              label: item.label,
              kind: monacoCompletionKind(item.kind),
              detail: item.detail || "",
              documentation: item.documentation ? {value: String(item.documentation)} : undefined,
              insertText: item.text_edit?.new_text || item.insert_text || item.label,
              range,
              sortText,
              filterText: item.filter_text || undefined,
            };
          });
        if (suggestions.length === 0) {
          return {suggestions: localSuggestions};
        }
        return {suggestions};
      } catch (error) {
        console.warn("[ide] completion failed:", error);
        return {suggestions: localSuggestions};
      }
    },
  });

  hoverProviderDisposable = monaco.languages.registerHoverProvider(ST_LANGUAGE_ID, {
    async provideHover(model, position) {
      if (!state.editorView || model !== state.editorView.getModel()) {
        return null;
      }
      const tab = activeTab();
      if (!tab || !isStructuredTextPath(tab.path)) {
        return null;
      }
      try {
        const response = await fetchHover(fromMonacoPosition(position));
        if (!response || !response.contents) {
          return buildFallbackHover(model, position);
        }
        const hoverText = normalizeHoverContentValue(response.contents);
        if (!hoverText) {
          return buildFallbackHover(model, position);
        }
        const hover = {
          contents: [{value: hoverText}],
        };
        if (response.range) {
          hover.range = toMonacoRange(response.range, model);
        }
        return hover;
      } catch (err) {
        console.warn("[ide] hover failed:", err);
        return buildFallbackHover(model, position);
      }
    },
  });

}
