// ── Monaco / Editor ────────────────────────────────────

function monacoLanguageForPath(path) {
  const normalized = String(path || "").toLowerCase();
  if (normalized.endsWith(".st")) return ST_LANGUAGE_ID;
  if (normalized.endsWith(".json")) return "json";
  if (normalized.endsWith(".toml")) return "ini";
  if (normalized.endsWith(".md")) return "markdown";
  if (normalized.endsWith(".yaml") || normalized.endsWith(".yml")) return "yaml";
  if (normalized.endsWith(".xml")) return "xml";
  if (normalized.endsWith(".js")) return "javascript";
  if (normalized.endsWith(".ts")) return "typescript";
  if (normalized.endsWith(".css")) return "css";
  if (normalized.endsWith(".html")) return "html";
  return "plaintext";
}

function activeModel() {
  return state.editorView ? state.editorView.getModel() : null;
}

function fromMonacoPosition(position) {
  if (!position) {
    return {line: 0, character: 0};
  }
  return {
    line: Math.max(0, Number(position.lineNumber || 1) - 1),
    character: Math.max(0, Number(position.column || 1) - 1),
  };
}

function toMonacoPosition(position, model) {
  const safeModel = model || activeModel();
  const maxLines = safeModel ? safeModel.getLineCount() : 1;
  const line = clamp(Number(position?.line ?? 0) + 1, 1, Math.max(1, maxLines));
  const maxColumn = safeModel ? safeModel.getLineMaxColumn(line) : 1;
  const column = clamp(Number(position?.character ?? 0) + 1, 1, Math.max(1, maxColumn));
  return new monaco.Position(line, column);
}

function toMonacoRange(range, model) {
  const safeModel = model || activeModel();
  const start = toMonacoPosition(range?.start || {line: 0, character: 0}, safeModel);
  const end = toMonacoPosition(range?.end || range?.start || {line: 0, character: 1}, safeModel);
  return new monaco.Range(
    start.lineNumber,
    start.column,
    Math.max(start.lineNumber, end.lineNumber),
    end.lineNumber < start.lineNumber ? start.column : Math.max(start.column, end.column),
  );
}

function positionToContentOffset(content, position) {
  const targetLine = Number(position?.line ?? 0);
  const targetChar = Number(position?.character ?? 0);
  let line = 0;
  let character = 0;
  for (let i = 0; i < content.length; i++) {
    if (line === targetLine && character === targetChar) {
      return i;
    }
    if (content[i] === "\n") {
      if (line === targetLine) {
        return i;
      }
      line++;
      character = 0;
    } else {
      character++;
    }
  }
  if (line === targetLine) {
    return content.length;
  }
  return null;
}

function monacoCompletionKind(kind) {
  const value = String(kind || "").toLowerCase();
  if (value.includes("function")) return monaco.languages.CompletionItemKind.Function;
  if (value.includes("method")) return monaco.languages.CompletionItemKind.Method;
  if (value.includes("class")) return monaco.languages.CompletionItemKind.Class;
  if (value.includes("module")) return monaco.languages.CompletionItemKind.Module;
  if (value.includes("field")) return monaco.languages.CompletionItemKind.Field;
  if (value.includes("property")) return monaco.languages.CompletionItemKind.Property;
  if (value.includes("variable")) return monaco.languages.CompletionItemKind.Variable;
  if (value.includes("enum")) return monaco.languages.CompletionItemKind.Enum;
  if (value.includes("keyword")) return monaco.languages.CompletionItemKind.Keyword;
  if (value.includes("snippet")) return monaco.languages.CompletionItemKind.Snippet;
  if (value.includes("type")) return monaco.languages.CompletionItemKind.TypeParameter;
  return monaco.languages.CompletionItemKind.Text;
}

function monacoMarkerSeverity(severity) {
  const value = String(severity || "").toLowerCase();
  if (value.includes("error")) return monaco.MarkerSeverity.Error;
  if (value.includes("info")) return monaco.MarkerSeverity.Info;
  if (value.includes("hint")) return monaco.MarkerSeverity.Hint;
  return monaco.MarkerSeverity.Warning;
}

function extractLocalCompletionCandidates(model) {
  if (!model) {
    return [];
  }
  const text = model.getValue();
  const identifiers = new Set();
  const matches = text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g);
  for (const match of matches) {
    if (match && match[0]) {
      identifiers.add(match[0]);
    }
  }
  const stKeywords = [
    "PROGRAM", "END_PROGRAM", "FUNCTION", "END_FUNCTION", "FUNCTION_BLOCK",
    "END_FUNCTION_BLOCK", "VAR", "END_VAR", "VAR_INPUT", "VAR_OUTPUT",
    "VAR_IN_OUT", "VAR_GLOBAL", "IF", "THEN", "ELSE", "ELSIF", "END_IF",
    "CASE", "OF", "END_CASE", "FOR", "TO", "BY", "DO", "END_FOR",
    "WHILE", "END_WHILE", "REPEAT", "UNTIL", "END_REPEAT", "TRUE", "FALSE",
    "BOOL", "INT", "DINT", "UINT", "UDINT", "REAL", "LREAL", "STRING",
  ];
  for (const keyword of stKeywords) {
    identifiers.add(keyword);
  }
  return Array.from(identifiers).sort((a, b) => a.localeCompare(b));
}

function fallbackCompletionRange(model, position) {
  const word = model.getWordUntilPosition(position);
  return new monaco.Range(
    position.lineNumber,
    word.startColumn || position.column,
    position.lineNumber,
    word.endColumn || position.column,
  );
}

function buildLocalCompletionSuggestions(model, position, limit = 120) {
  const range = fallbackCompletionRange(model, position);
  return extractLocalCompletionCandidates(model)
    .slice(0, limit)
    .map((label) => ({
      label,
      kind: /^[A-Z_]+$/.test(label)
        ? monaco.languages.CompletionItemKind.Keyword
        : monaco.languages.CompletionItemKind.Variable,
      detail: "local symbol",
      insertText: label,
      range,
    }));
}

function normalizeHoverContentValue(contents) {
  if (typeof contents === "string") {
    return contents.trim();
  }
  if (Array.isArray(contents)) {
    const parts = contents
      .map((entry) => {
        if (typeof entry === "string") {
          return entry.trim();
        }
        if (entry && typeof entry.value === "string") {
          return entry.value.trim();
        }
        return "";
      })
      .filter((value) => value.length > 0);
    return parts.join("\n\n").trim();
  }
  if (contents && typeof contents === "object" && typeof contents.value === "string") {
    return contents.value.trim();
  }
  return "";
}

function buildFallbackHover(model, position) {
