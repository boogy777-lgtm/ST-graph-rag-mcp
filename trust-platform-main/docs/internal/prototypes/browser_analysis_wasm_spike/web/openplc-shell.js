import { TrustWasmAnalysisClient } from "./analysis-client.js";

const URI = "memory:///main.st";
const DEFAULT_SOURCE = `PROGRAM Main
VAR
    Counter : INT;
END_VAR

Counter := Counter + 1;
Cou
END_PROGRAM
`;

const client = new TrustWasmAnalysisClient({ workerUrl: "./worker.js", defaultTimeoutMs: 1500 });

const sourceEl = document.getElementById("source");
const editorWrapEl = document.getElementById("editorWrap");
const completionEl = document.getElementById("completion");
const diagnosticsEl = document.getElementById("diagnostics");
const hoverEl = document.getElementById("hover");
const completionSummaryEl = document.getElementById("completionSummary");
const statusTextEl = document.getElementById("statusText");
const readyPillEl = document.getElementById("readyPill");
const cursorLabelEl = document.getElementById("cursorLabel");

let revision = 0;
let appliedRevision = -1;
let applying = null;

let diagTimer = null;
let completionTimer = null;
let hoverTimer = null;

let completionItems = [];
let completionIndex = 0;

function setStatus(text) {
  statusTextEl.textContent = text;
}

function setReady(ready) {
  if (ready) {
    readyPillEl.textContent = "Analyzer online";
    readyPillEl.className = "pill ok";
  } else {
    readyPillEl.textContent = "Booting...";
    readyPillEl.className = "pill";
  }
}

function parseNumber(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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

function syncCursorLabel() {
  const pos = currentPosition();
  cursorLabelEl.textContent = `Ln ${pos.line + 1}, Col ${pos.character + 1}`;
}

function clear(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function renderHint(el, text) {
  clear(el);
  const node = document.createElement("div");
  node.className = "muted";
  node.textContent = text;
  el.appendChild(node);
}

async function ensureApplied(targetRevision) {
  if (appliedRevision === targetRevision) {
    return;
  }

  if (applying) {
    await applying;
    if (appliedRevision === targetRevision) {
      return;
    }
  }

  applying = client
    .applyDocuments([{ uri: URI, text: sourceEl.value }])
    .then(() => {
      if (revision === targetRevision) {
        appliedRevision = targetRevision;
      }
    })
    .finally(() => {
      applying = null;
    });

  await applying;
}

function formatRange(range) {
  if (!range?.start || !range?.end) {
    return "n/a";
  }
  return `${range.start.line}:${range.start.character} -> ${range.end.line}:${range.end.character}`;
}

function renderDiagnostics(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    renderHint(diagnosticsEl, "No diagnostics");
    return;
  }

  clear(diagnosticsEl);
  for (const item of list) {
    const row = document.createElement("div");
    row.className = "diag";

    const title = document.createElement("strong");
    const sev = document.createElement("span");
    const error = String(item.severity || "warning").toLowerCase().includes("error");
    sev.className = `sev ${error ? "error" : "warning"}`;
    sev.textContent = error ? "error" : "warning";

    title.appendChild(sev);
    title.appendChild(document.createTextNode(item.message || "diagnostic"));

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${item.code || "unknown"} at ${formatRange(item.range)}`;

    row.appendChild(title);
    row.appendChild(meta);
    diagnosticsEl.appendChild(row);
  }
}

function renderCompletionSummary(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    renderHint(completionSummaryEl, "No completion suggestions");
    return;
  }

  clear(completionSummaryEl);
  for (const item of list.slice(0, 8)) {
    const row = document.createElement("div");
    row.className = "diag";

    const title = document.createElement("strong");
    title.textContent = `${item.label || "<unknown>"} (${item.kind || "item"})`;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = item.detail
      ? String(item.detail)
      : item.documentation
        ? String(item.documentation).slice(0, 90)
        : "No extra detail";

    row.appendChild(title);
    row.appendChild(meta);
    completionSummaryEl.appendChild(row);
  }
}

function completionPrefix(text, position) {
  const offset = positionToOffset(text, position);
  let start = offset;
  while (start > 0 && /[A-Za-z0-9_]/.test(text.charAt(start - 1))) {
    start -= 1;
  }
  return text.slice(start, offset);
}

function hideCompletion() {
  completionEl.classList.add("hidden");
  completionEl.innerHTML = "";
  completionItems = [];
  completionIndex = 0;
}

function refreshCompletionActive() {
  const nodes = completionEl.querySelectorAll(".completion-item");
  nodes.forEach((node, index) => {
    node.classList.toggle("active", index === completionIndex);
  });
}

async function applyCompletion(item) {
  const text = sourceEl.value;
  if (item?.text_edit?.range) {
    const start = positionToOffset(text, item.text_edit.range.start);
    const end = positionToOffset(text, item.text_edit.range.end);
    const nextText = String(item.text_edit.new_text || "");
    sourceEl.value = `${text.slice(0, start)}${nextText}${text.slice(end)}`;
    sourceEl.setSelectionRange(start + nextText.length, start + nextText.length);
  } else {
    const insert = String(item?.insert_text || item?.label || "");
    const offset = sourceEl.selectionStart || 0;
    sourceEl.value = `${text.slice(0, offset)}${insert}${text.slice(offset)}`;
    sourceEl.setSelectionRange(offset + insert.length, offset + insert.length);
  }

  revision += 1;
  appliedRevision = -1;
  syncCursorLabel();
  hideCompletion();
  scheduleDiagnostics(40);
  scheduleCompletion(50);
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

function caretAnchor(position) {
  const { lineHeight, charWidth, paddingLeft, paddingTop } = charMetrics();
  let left = paddingLeft + position.character * charWidth - sourceEl.scrollLeft;
  let top = paddingTop + (position.line + 1) * lineHeight - sourceEl.scrollTop + 3;
  left = Math.max(8, Math.min(left, editorWrapEl.clientWidth - 328));
  top = Math.max(8, Math.min(top, editorWrapEl.clientHeight - 238));
  return { left, top };
}

function renderCompletionPopup(items, anchorPos) {
  completionItems = items.slice(0, 10);
  completionIndex = 0;

  if (completionItems.length === 0) {
    hideCompletion();
    return;
  }

  const anchor = caretAnchor(anchorPos);
  completionEl.style.left = `${anchor.left}px`;
  completionEl.style.top = `${anchor.top}px`;
  completionEl.classList.remove("hidden");
  completionEl.innerHTML = "";

  completionItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `completion-item${index === 0 ? " active" : ""}`;

    const label = document.createElement("strong");
    label.textContent = String(item.label || "<unknown>");

    const detail = document.createElement("span");
    detail.textContent = item.detail
      ? String(item.detail)
      : item.documentation
        ? String(item.documentation).slice(0, 70)
        : String(item.kind || "item");

    row.appendChild(label);
    row.appendChild(detail);

    row.addEventListener("mouseenter", () => {
      completionIndex = index;
      refreshCompletionActive();
    });

    row.addEventListener("mousedown", async (event) => {
      event.preventDefault();
      await applyCompletion(item);
    });

    completionEl.appendChild(row);
  });
}

async function refreshDiagnostics() {
  const targetRevision = revision;
  try {
    await ensureApplied(targetRevision);
    const diagnostics = await client.diagnostics(URI);
    if (targetRevision !== revision) {
      return;
    }
    renderDiagnostics(diagnostics);
    setStatus(`Diagnostics updated (${Array.isArray(diagnostics) ? diagnostics.length : 0})`);
  } catch (error) {
    setStatus(`Diagnostics error: ${String(error?.message || error)}`);
  }
}

async function refreshHover(position) {
  const targetRevision = revision;
  try {
    await ensureApplied(targetRevision);
    const hover = await client.hover(URI, position);
    if (targetRevision !== revision) {
      return;
    }
    if (hover?.contents) {
      hoverEl.textContent = String(hover.contents);
    } else {
      hoverEl.textContent = "Hover a symbol to inspect details.";
    }
  } catch {
    // Ignore transient hover failures.
  }
}

async function refreshCompletion() {
  const targetRevision = revision;
  const pos = currentPosition();
  const prefix = completionPrefix(sourceEl.value, pos);

  if (!prefix) {
    hideCompletion();
    renderCompletionSummary([]);
    return;
  }

  try {
    await ensureApplied(targetRevision);
    const completion = await client.completion(URI, pos, 25);
    if (targetRevision !== revision) {
      return;
    }
    const items = Array.isArray(completion) ? completion : [];
    renderCompletionSummary(items);
    renderCompletionPopup(items, pos);
  } catch {
    hideCompletion();
  }
}

function scheduleDiagnostics(delayMs = 140) {
  if (diagTimer) {
    clearTimeout(diagTimer);
  }
  diagTimer = setTimeout(() => {
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

function scheduleHover(position, delayMs = 130) {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
  }
  hoverTimer = setTimeout(() => {
    refreshHover(position).catch(() => {});
  }, delayMs);
}

sourceEl.addEventListener("input", () => {
  revision += 1;
  appliedRevision = -1;
  syncCursorLabel();
  scheduleDiagnostics();
  scheduleCompletion();
});

sourceEl.addEventListener("click", () => {
  syncCursorLabel();
  scheduleCompletion(80);
});

sourceEl.addEventListener("keyup", () => {
  syncCursorLabel();
  scheduleCompletion(80);
});

sourceEl.addEventListener("select", () => {
  syncCursorLabel();
});

sourceEl.addEventListener("mousemove", (event) => {
  const rect = sourceEl.getBoundingClientRect();
  const { lineHeight, charWidth, paddingLeft, paddingTop } = charMetrics();
  const x = event.clientX - rect.left + sourceEl.scrollLeft - paddingLeft;
  const y = event.clientY - rect.top + sourceEl.scrollTop - paddingTop;
  const line = Math.max(0, Math.floor(y / lineHeight));
  const character = Math.max(0, Math.floor(x / charWidth));
  scheduleHover({ line, character }, 150);
});

sourceEl.addEventListener("keydown", (event) => {
  if (completionEl.classList.contains("hidden") || completionItems.length === 0) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    completionIndex = (completionIndex + 1) % completionItems.length;
    refreshCompletionActive();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    completionIndex = (completionIndex - 1 + completionItems.length) % completionItems.length;
    refreshCompletionActive();
    return;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    applyCompletion(completionItems[completionIndex]).catch(() => {});
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    hideCompletion();
  }
});

sourceEl.addEventListener("blur", () => {
  setTimeout(() => {
    hideCompletion();
  }, 110);
});

sourceEl.addEventListener("scroll", () => {
  if (!completionEl.classList.contains("hidden")) {
    scheduleCompletion(20);
  }
});

client.onStatus((status) => {
  if (status.type === "ready") {
    setReady(true);
    setStatus("Analyzer online. Live mode active.");
    revision += 1;
    appliedRevision = -1;
    scheduleDiagnostics(20);
    scheduleCompletion(30);
    return;
  }

  if (status.type === "startup_error") {
    setReady(false);
    setStatus(`Startup error: ${status.error}`);
    return;
  }

  if (status.type === "worker_error") {
    setReady(false);
    setStatus(`Worker error: ${status.error}`);
  }
});

window.addEventListener("beforeunload", () => {
  client.dispose();
});

sourceEl.value = DEFAULT_SOURCE;
sourceEl.focus();
const startOffset = sourceEl.value.lastIndexOf("Cou") + 3;
sourceEl.setSelectionRange(startOffset, startOffset);
syncCursorLabel();
renderHint(diagnosticsEl, "Loading diagnostics...");
renderHint(completionSummaryEl, "Type to get completion suggestions");
setStatus("Starting analyzer...");
setReady(false);

client.ready().catch(() => {
  // status callback already reports startup errors.
});
