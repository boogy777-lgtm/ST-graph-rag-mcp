const worker = new Worker("./worker.js", { type: "module" });
const pending = new Map();
let requestSequence = 0;
let lastRequestId = null;

const DEFAULT_SOURCE = `PROGRAM Main
VAR
    Counter : INT;
    SpeedA : INT;
END_VAR

Counter := Counter + 1;
Cou
END_PROGRAM
`;

const THEME_STORAGE_KEY = "trustTheme";
let theme = localStorage.getItem(THEME_STORAGE_KEY);

const statusPillEl = document.getElementById("statusPill");
const statusMetaEl = document.getElementById("statusMeta");
const statusUpdatedEl = document.getElementById("statusUpdated");
const connectionBadgeEl = document.getElementById("connectionBadge");
const themeToggleEl = document.getElementById("themeToggle");

const documentChipEl = document.getElementById("documentChip");
const sourceEl = document.getElementById("source");
const cursorLabelEl = document.getElementById("cursorLabel");
const editorWrapEl = document.getElementById("editorWrap");

const hoverPopoverEl = document.getElementById("hoverPopover");
const completionPopoverEl = document.getElementById("completionPopover");

const diagListEl = document.getElementById("diagList");
const hoverCardEl = document.getElementById("hoverCard");
const hoverRangeEl = document.getElementById("hoverRange");
const completionSummaryEl = document.getElementById("completionSummary");

let documentRevision = 0;
let appliedRevision = -1;
let applyInFlight = null;
let applyInFlightRevision = -1;

let diagnosticsTimer = null;
let completionTimer = null;
let hoverTimer = null;

let diagnosticsRequestSerial = 0;
let completionRequestSerial = 0;
let hoverRequestSerial = 0;

let completionItems = [];
let completionSelectedIndex = 0;

function nowLabel() {
  return new Date().toLocaleTimeString();
}

function updateLastUpdate() {
  statusUpdatedEl.textContent = `Last update: ${nowLabel()}`;
}

function setConnection(state) {
  connectionBadgeEl.dataset.state = state;
  connectionBadgeEl.textContent = state;
}

function setStatus(state, message) {
  statusPillEl.dataset.state = state;
  statusPillEl.textContent = state;
  statusMetaEl.textContent = message;
  updateLastUpdate();
}

function applyTheme(next) {
  theme = next || "light";
  document.body.dataset.theme = theme;
  themeToggleEl.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function toggleTheme() {
  applyTheme(theme === "dark" ? "light" : "dark");
}

function parseNumber(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function currentUri() {
  return documentChipEl.textContent.trim();
}

function currentDocument() {
  return {
    uri: currentUri(),
    text: sourceEl.value,
  };
}

function offsetToPosition(text, offset) {
  const capped = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let character = 0;

  for (let index = 0; index < capped; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1;
      character = 0;
    } else {
      character += 1;
    }
  }

  return { line, character };
}

function positionToOffset(text, position) {
  const targetLine = Math.max(0, parseNumber(position.line));
  const targetCharacter = Math.max(0, parseNumber(position.character));

  let offset = 0;
  let line = 0;
  while (offset < text.length && line < targetLine) {
    if (text.charCodeAt(offset) === 10) {
      line += 1;
    }
    offset += 1;
  }

  let character = 0;
  while (offset < text.length && character < targetCharacter) {
    if (text.charCodeAt(offset) === 10) {
      break;
    }
    offset += 1;
    character += 1;
  }

  return offset;
}

function currentPosition() {
  const offset = sourceEl.selectionStart ?? 0;
  return offsetToPosition(sourceEl.value, offset);
}

function clampPositionToDocument(position) {
  const lines = sourceEl.value.split("\n");
  const maxLine = Math.max(0, lines.length - 1);
  const line = Math.max(0, Math.min(position.line, maxLine));
  const maxCharacter = lines[line] ? lines[line].length : 0;
  const character = Math.max(0, Math.min(position.character, maxCharacter));
  return { line, character };
}

function syncCursorLabel() {
  const pos = currentPosition();
  cursorLabelEl.textContent = `Ln ${pos.line + 1}, Col ${pos.character + 1}`;
}

function request(method, params = {}, timeoutMs = 1500) {
  const id = `req-${++requestSequence}`;
  lastRequestId = id;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    worker.postMessage({ id, method, params, timeoutMs });
  });
}

function cancelLastRequest() {
  if (!lastRequestId) {
    return;
  }
  worker.postMessage({ method: "cancel", params: { requestId: lastRequestId } });
}

async function ensureApplied(revision) {
  if (appliedRevision === revision) {
    return;
  }

  if (applyInFlight && applyInFlightRevision === revision) {
    await applyInFlight;
    return;
  }

  applyInFlightRevision = revision;
  applyInFlight = request("applyDocuments", { documents: [currentDocument()] }, 2200)
    .then(() => {
      if (documentRevision === revision) {
        appliedRevision = revision;
      }
    })
    .finally(() => {
      if (applyInFlightRevision === revision) {
        applyInFlight = null;
      }
    });

  await applyInFlight;
}

function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function renderHint(el, text) {
  clearElement(el);
  const node = document.createElement("div");
  node.className = "hint";
  node.textContent = text;
  el.appendChild(node);
}

function severityClassName(severity) {
  const normalized = String(severity ?? "").toLowerCase();
  if (normalized.includes("error")) {
    return "sev-error";
  }
  return "sev-warning";
}

function formatRange(range) {
  if (!range?.start || !range?.end) {
    return "n/a";
  }
  return `${range.start.line}:${range.start.character} -> ${range.end.line}:${range.end.character}`;
}

function moveCaretTo(position) {
  const clamped = clampPositionToDocument(position);
  const offset = positionToOffset(sourceEl.value, clamped);
  sourceEl.focus();
  sourceEl.setSelectionRange(offset, offset);
  syncCursorLabel();
}

function renderDiagnostics(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    renderHint(diagListEl, "No diagnostics in current source.");
    return;
  }

  clearElement(diagListEl);
  for (const item of list) {
    const row = document.createElement("div");
    row.className = "diag-item";

    const title = document.createElement("p");
    title.className = "diag-title";

    const sev = document.createElement("span");
    sev.className = `sev ${severityClassName(item.severity)}`;
    sev.textContent = String(item.severity ?? "warn");

    title.appendChild(sev);
    title.appendChild(document.createTextNode(` ${item.message ?? "diagnostic"}`));

    const meta = document.createElement("p");
    meta.className = "diag-meta";
    meta.textContent = `${item.code ?? "unknown"} at ${formatRange(item.range)}`;

    row.appendChild(title);
    row.appendChild(meta);

    if (item?.range?.start) {
      row.addEventListener("click", () => {
        moveCaretTo(item.range.start);
        scheduleCompletion(20);
      });
    }

    diagListEl.appendChild(row);
  }
}

function renderHoverCard(item) {
  if (!item?.contents) {
    hoverCardEl.className = "hover-pre hint";
    hoverCardEl.textContent = "Hover over a symbol to inspect details.";
    hoverRangeEl.textContent = "";
    return;
  }

  hoverCardEl.className = "hover-pre";
  hoverCardEl.textContent = String(item.contents);
  hoverRangeEl.textContent = `range: ${formatRange(item.range)}`;
}

function renderCompletionSummary(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    renderHint(completionSummaryEl, "No completion suggestions at caret.");
    return;
  }

  clearElement(completionSummaryEl);
  for (const item of list.slice(0, 8)) {
    const row = document.createElement("div");
    row.className = "completion-summary-item";

    const label = document.createElement("p");
    label.className = "diag-title";
    label.textContent = `${item.label ?? "<unknown>"} (${item.kind ?? "item"})`;

    const detail = document.createElement("p");
    detail.className = "diag-meta";
    detail.textContent = item.detail
      ? String(item.detail)
      : item.documentation
        ? String(item.documentation).slice(0, 90)
        : "No extra detail";

    row.appendChild(label);
    row.appendChild(detail);
    completionSummaryEl.appendChild(row);
  }
}

function hideHoverPopover() {
  hoverPopoverEl.classList.add("is-hidden");
  hoverPopoverEl.textContent = "";
}

function showHoverPopover(contents, event) {
  if (!contents) {
    hideHoverPopover();
    return;
  }

  const rect = editorWrapEl.getBoundingClientRect();
  const left = Math.max(8, Math.min(event.clientX - rect.left + 12, editorWrapEl.clientWidth - 320));
  const top = Math.max(8, Math.min(event.clientY - rect.top + 14, editorWrapEl.clientHeight - 140));

  hoverPopoverEl.style.left = `${left}px`;
  hoverPopoverEl.style.top = `${top}px`;
  hoverPopoverEl.textContent = String(contents);
  hoverPopoverEl.classList.remove("is-hidden");
}

function completionVisible() {
  return !completionPopoverEl.classList.contains("is-hidden");
}

function hideCompletionPopover() {
  completionPopoverEl.classList.add("is-hidden");
  completionPopoverEl.innerHTML = "";
  completionItems = [];
  completionSelectedIndex = 0;
}

function refreshCompletionActiveState() {
  const rows = completionPopoverEl.querySelectorAll(".completion-item");
  rows.forEach((row, index) => {
    row.classList.toggle("active", index === completionSelectedIndex);
  });
}

function charMetrics() {
  const style = window.getComputedStyle(sourceEl);
  const lineHeight = Number.parseFloat(style.lineHeight) || 20;
  const font = style.font || `${style.fontSize} ${style.fontFamily}`;
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = font;
  const charWidth = measure.measureText("M").width || 8;
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  return { lineHeight, charWidth, paddingLeft, paddingTop };
}

function caretOverlayPosition(position) {
  const { lineHeight, charWidth, paddingLeft, paddingTop } = charMetrics();
  let left = paddingLeft + position.character * charWidth - sourceEl.scrollLeft;
  let top = paddingTop + (position.line + 1) * lineHeight - sourceEl.scrollTop + 2;

  left = Math.max(8, Math.min(left, editorWrapEl.clientWidth - 370));
  top = Math.max(8, Math.min(top, editorWrapEl.clientHeight - 220));

  return { left, top };
}

function mouseToPosition(event) {
  const rect = sourceEl.getBoundingClientRect();
  const { lineHeight, charWidth, paddingLeft, paddingTop } = charMetrics();

  const x = event.clientX - rect.left + sourceEl.scrollLeft - paddingLeft;
  const y = event.clientY - rect.top + sourceEl.scrollTop - paddingTop;

  const line = Math.max(0, Math.floor(y / lineHeight));
  const character = Math.max(0, Math.floor(x / charWidth));

  return clampPositionToDocument({ line, character });
}

function completionPrefix(text, position) {
  const offset = positionToOffset(text, position);
  let start = offset;
  while (start > 0 && /[A-Za-z0-9_]/.test(text.charAt(start - 1))) {
    start -= 1;
  }
  return text.slice(start, offset);
}

function isKeywordCompletionItem(item) {
  return String(item?.kind ?? "")
    .toLowerCase()
    .includes("keyword");
}

function normalizeLabel(item) {
  return String(item?.label ?? "").toLowerCase();
}

function sortCompletionItems(items, prefix) {
  const normalizedPrefix = String(prefix ?? "").toLowerCase();
  return [...items]
    .map((item, index) => {
      const label = normalizeLabel(item);
      const startsWithPrefix = normalizedPrefix.length > 0 && label.startsWith(normalizedPrefix);
      const containsPrefix = normalizedPrefix.length > 0 && label.includes(normalizedPrefix);
      const keywordPenalty = isKeywordCompletionItem(item) ? 1 : 0;
      const prefixScore = startsWithPrefix ? 0 : containsPrefix ? 1 : 2;
      return { item, index, prefixScore, keywordPenalty, label };
    })
    .sort((a, b) => {
      if (a.prefixScore !== b.prefixScore) {
        return a.prefixScore - b.prefixScore;
      }
      if (a.keywordPenalty !== b.keywordPenalty) {
        return a.keywordPenalty - b.keywordPenalty;
      }
      if (a.label !== b.label) {
        return a.label.localeCompare(b.label);
      }
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

function collectVarBlockSymbols(text) {
  const symbols = new Set();
  const lines = String(text ?? "").split("\n");
  let inVarBlock = false;

  for (const line of lines) {
    const trimmedUpper = line.trim().toUpperCase();

    if (trimmedUpper.startsWith("VAR")) {
      inVarBlock = true;
      continue;
    }
    if (trimmedUpper.startsWith("END_VAR")) {
      inVarBlock = false;
      continue;
    }
    if (!inVarBlock) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex <= 0) {
      continue;
    }
    const left = line.slice(0, colonIndex);
    for (const candidate of left.split(",")) {
      const name = candidate.trim().match(/^[A-Za-z_][A-Za-z0-9_]*$/);
      if (name) {
        symbols.add(name[0]);
      }
    }
  }

  return [...symbols];
}

function fallbackCompletionsFromDocument(text, prefix) {
  const normalizedPrefix = String(prefix ?? "").toLowerCase();
  if (!normalizedPrefix) {
    return [];
  }

  return collectVarBlockSymbols(text)
    .filter((name) => name.toLowerCase().startsWith(normalizedPrefix))
    .map((name) => ({
      label: name,
      kind: "variable",
      detail: "local symbol",
      documentation: "Fallback suggestion from active VAR block.",
      insert_text: name,
      sort_priority: 9,
    }));
}

async function applyCompletionItem(item) {
  const text = sourceEl.value;

  if (item?.text_edit?.range) {
    const start = positionToOffset(text, item.text_edit.range.start);
    const end = positionToOffset(text, item.text_edit.range.end);
    const newText = String(item.text_edit.new_text ?? "");
    sourceEl.value = `${text.slice(0, start)}${newText}${text.slice(end)}`;
    sourceEl.focus();
    sourceEl.setSelectionRange(start + newText.length, start + newText.length);
  } else {
    const insertText = String(item?.insert_text ?? item?.label ?? "");
    const offset = sourceEl.selectionStart ?? 0;
    sourceEl.value = `${text.slice(0, offset)}${insertText}${text.slice(offset)}`;
    sourceEl.focus();
    sourceEl.setSelectionRange(offset + insertText.length, offset + insertText.length);
  }

  documentRevision += 1;
  appliedRevision = -1;
  syncCursorLabel();
  hideCompletionPopover();
  scheduleDiagnostics(40);
  scheduleCompletion(55);
}

function renderCompletionPopover(items, anchorPosition) {
  completionItems = items.slice(0, 10);
  completionSelectedIndex = 0;

  if (completionItems.length === 0) {
    hideCompletionPopover();
    return;
  }

  const anchor = caretOverlayPosition(anchorPosition);
  completionPopoverEl.style.left = `${anchor.left}px`;
  completionPopoverEl.style.top = `${anchor.top}px`;
  completionPopoverEl.classList.remove("is-hidden");
  completionPopoverEl.innerHTML = "";

  completionItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `completion-item${index === 0 ? " active" : ""}`;

    const left = document.createElement("div");
    const label = document.createElement("p");
    label.className = "completion-label";
    label.textContent = String(item.label ?? "<unknown>");

    const detail = document.createElement("p");
    detail.className = "completion-detail";
    detail.textContent = item.detail
      ? String(item.detail)
      : item.documentation
        ? String(item.documentation).slice(0, 70)
        : "";

    left.appendChild(label);
    if (detail.textContent) {
      left.appendChild(detail);
    }

    const kind = document.createElement("span");
    kind.className = "completion-kind";
    kind.textContent = String(item.kind ?? "item");

    row.appendChild(left);
    row.appendChild(kind);

    row.addEventListener("mouseenter", () => {
      completionSelectedIndex = index;
      refreshCompletionActiveState();
    });

    row.addEventListener("mousedown", async (event) => {
      event.preventDefault();
      await applyCompletionItem(item);
    });

    completionPopoverEl.appendChild(row);
  });
}

async function refreshDiagnostics() {
  const revision = documentRevision;
  const serial = ++diagnosticsRequestSerial;

  try {
    await ensureApplied(revision);
    const diagnostics = await request("diagnostics", { uri: currentUri() }, 2100);

    if (serial !== diagnosticsRequestSerial || revision !== documentRevision) {
      return;
    }

    renderDiagnostics(diagnostics);
    setStatus("running", `Live analysis active. Diagnostics: ${Array.isArray(diagnostics) ? diagnostics.length : 0}`);
  } catch (error) {
    if (serial !== diagnosticsRequestSerial) {
      return;
    }
    setStatus("faulted", `Diagnostics failed: ${String(error?.message ?? error)}`);
  }
}

async function refreshCompletion() {
  const revision = documentRevision;
  const serial = ++completionRequestSerial;
  const position = currentPosition();
  const prefix = completionPrefix(sourceEl.value, position);

  if (!prefix) {
    hideCompletionPopover();
    renderCompletionSummary([]);
    return;
  }

  try {
    await ensureApplied(revision);
    const completion = await request(
      "completion",
      {
        uri: currentUri(),
        position,
        limit: 200,
      },
      1600,
    );

    if (serial !== completionRequestSerial || revision !== documentRevision) {
      return;
    }

    const rawList = Array.isArray(completion) ? completion : [];
    const sorted = sortCompletionItems(rawList, prefix);
    const prefixLower = String(prefix).toLowerCase();
    const hasPrefixMatch = sorted.some((item) => normalizeLabel(item).startsWith(prefixLower));
    const fallback = fallbackCompletionsFromDocument(sourceEl.value, prefix);

    let list = sorted;
    if (!hasPrefixMatch && fallback.length > 0) {
      const seen = new Set(sorted.map((item) => normalizeLabel(item)));
      const fallbackUnique = fallback.filter((item) => !seen.has(normalizeLabel(item)));
      list = sortCompletionItems([...fallbackUnique, ...sorted], prefix);
    }

    renderCompletionSummary(list);
    renderCompletionPopover(list, position);
  } catch (error) {
    if (serial !== completionRequestSerial) {
      return;
    }
    hideCompletionPopover();
  }
}

async function refreshHover(position, event) {
  const revision = documentRevision;
  const serial = ++hoverRequestSerial;

  try {
    await ensureApplied(revision);
    const hover = await request(
      "hover",
      {
        uri: currentUri(),
        position,
      },
      1200,
    );

    if (serial !== hoverRequestSerial || revision !== documentRevision) {
      return;
    }

    renderHoverCard(hover);
    if (hover?.contents) {
      showHoverPopover(hover.contents, event);
    } else {
      hideHoverPopover();
    }
  } catch {
    if (serial !== hoverRequestSerial) {
      return;
    }
    hideHoverPopover();
  }
}

function scheduleDiagnostics(delayMs = 140) {
  if (diagnosticsTimer) {
    clearTimeout(diagnosticsTimer);
  }
  diagnosticsTimer = setTimeout(() => {
    refreshDiagnostics().catch(() => {});
  }, delayMs);
}

function scheduleCompletion(delayMs = 110) {
  if (completionTimer) {
    clearTimeout(completionTimer);
  }
  completionTimer = setTimeout(() => {
    refreshCompletion().catch(() => {});
  }, delayMs);
}

function scheduleHover(position, event, delayMs = 120) {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
  }
  hoverTimer = setTimeout(() => {
    refreshHover(position, event).catch(() => {});
  }, delayMs);
}

function onEditorChanged() {
  documentRevision += 1;
  appliedRevision = -1;
  syncCursorLabel();
  scheduleDiagnostics();
  scheduleCompletion();
}

function onCaretChanged() {
  syncCursorLabel();
  scheduleCompletion(90);
}

function handleCompletionKeys(event) {
  if (!completionVisible() || completionItems.length === 0) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    completionSelectedIndex = (completionSelectedIndex + 1) % completionItems.length;
    refreshCompletionActiveState();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    completionSelectedIndex = (completionSelectedIndex - 1 + completionItems.length) % completionItems.length;
    refreshCompletionActiveState();
    return;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    applyCompletionItem(completionItems[completionSelectedIndex]).catch(() => {});
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    hideCompletionPopover();
  }
}

sourceEl.addEventListener("input", () => {
  onEditorChanged();
});

sourceEl.addEventListener("click", () => {
  onCaretChanged();
});

sourceEl.addEventListener("keyup", () => {
  onCaretChanged();
});

sourceEl.addEventListener("select", () => {
  onCaretChanged();
});

sourceEl.addEventListener("keydown", (event) => {
  handleCompletionKeys(event);
});

sourceEl.addEventListener("mousemove", (event) => {
  const position = mouseToPosition(event);
  scheduleHover(position, event);
});

sourceEl.addEventListener("mouseleave", () => {
  hideHoverPopover();
});

sourceEl.addEventListener("scroll", () => {
  hideHoverPopover();
  if (completionVisible()) {
    scheduleCompletion(20);
  }
});

sourceEl.addEventListener("blur", () => {
  setTimeout(() => {
    hideHoverPopover();
    hideCompletionPopover();
  }, 120);
});

themeToggleEl.addEventListener("click", () => {
  toggleTheme();
});

worker.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "ready") {
    setConnection("online");
    setStatus("running", "WASM worker online. Live diagnostics, hover, and completion enabled.");
    documentRevision += 1;
    appliedRevision = -1;
    scheduleDiagnostics(20);
    scheduleCompletion(80);
    return;
  }

  if (message.type === "startup_error") {
    setConnection("offline");
    setStatus("faulted", `Worker startup error: ${message.error}`);
    return;
  }

  if (!message.id || !pending.has(message.id)) {
    return;
  }

  const requestState = pending.get(message.id);
  pending.delete(message.id);

  if (message.error) {
    requestState.reject(
      new Error(`${requestState.method}: ${message.error.message || "unknown worker error"}`),
    );
    return;
  }

  requestState.resolve(message.result);
});

worker.addEventListener("error", (event) => {
  setConnection("offline");
  setStatus("faulted", `Worker crashed: ${event.message}`);
});

window.addEventListener("beforeunload", () => {
  cancelLastRequest();
});

if (!theme) {
  theme =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
}
applyTheme(theme);

sourceEl.value = DEFAULT_SOURCE;
sourceEl.focus();
const startupCaretOffset = sourceEl.value.lastIndexOf("Cou") + 3;
sourceEl.setSelectionRange(startupCaretOffset, startupCaretOffset);
syncCursorLabel();
renderHint(diagListEl, "Loading diagnostics...");
renderHoverCard(null);
renderHint(completionSummaryEl, "Type to get completion suggestions.");
setConnection("offline");
setStatus("loading", "Starting WASM worker...");
