// ── Theme & Layout ─────────────────────────────────────

function applyTheme(theme) {
  const next = theme || "light";
  document.body.dataset.theme = next;
  localStorage.setItem(THEME_STORAGE_KEY, next);
  el.themeToggle.textContent = next === "dark" ? "Light mode" : "Dark mode";
  if (monaco) {
    monaco.editor.setTheme(next === "dark" ? "trust-dark" : "trust-light");
  }
}

function toggleTheme() {
  const active = document.body.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(active === "dark" ? "light" : "dark");
}

function applyWorkbenchSizing() {
  const left = Number(localStorage.getItem(IDE_LEFT_WIDTH_KEY) || 290);
  const right = Number(localStorage.getItem(IDE_RIGHT_WIDTH_KEY) || 320);
  document.documentElement.style.setProperty("--ide-left-width", `${clamp(left, 220, 520)}px`);
  document.documentElement.style.setProperty("--ide-right-width", `${clamp(right, 250, 520)}px`);
}

function bindResizeHandles() {
  const startDrag = (kind, event) => {
    if (window.matchMedia && window.matchMedia("(max-width: 1160px)").matches) {
      return;
    }
    event.preventDefault();
    const handle = kind === "left" ? el.sidebarResizeHandle : el.insightResizeHandle;
    handle.classList.add("dragging");

    const onMove = (moveEvent) => {
      if (kind === "left") {
        const width = clamp(moveEvent.clientX, 220, 520);
        document.documentElement.style.setProperty("--ide-left-width", `${width}px`);
        localStorage.setItem(IDE_LEFT_WIDTH_KEY, String(width));
        return;
      }
      const shellRect = document.querySelector(".ide-shell")?.getBoundingClientRect();
      if (!shellRect) {
        return;
      }
      const width = clamp(shellRect.right - moveEvent.clientX, 250, 520);
      document.documentElement.style.setProperty("--ide-right-width", `${width}px`);
      localStorage.setItem(IDE_RIGHT_WIDTH_KEY, String(width));
    };

    const onUp = () => {
      handle.classList.remove("dragging");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  el.sidebarResizeHandle.addEventListener("mousedown", (event) => startDrag("left", event));
  el.insightResizeHandle.addEventListener("mousedown", (event) => startDrag("right", event));
}

function updateConnectionBadge() {
  const runtimeConnected = (typeof onlineState === "object" && onlineState)
    ? !!onlineState.connected
    : !!state.online;
  const connectionState = (typeof onlineState === "object" && onlineState && onlineState.connectionState)
    ? onlineState.connectionState
    : (runtimeConnected ? "online" : "offline");
  const runtimeTarget = (typeof onlineState === "object" && onlineState)
    ? String(onlineState.address || onlineState.target || "").replace(/^https?:\/\//, "")
    : String(state.connectionAddress || "");

  if (el.connectionPill) {
    el.connectionPill.dataset.state = connectionState;
  }
  if (el.connectionPillText) {
    if (connectionState === "online") {
      const suffix = runtimeTarget ? ` ${runtimeTarget}` : "";
      el.connectionPillText.textContent = `ONLINE${suffix}`;
    } else if (connectionState === "reconnecting") {
      el.connectionPillText.textContent = "RECONNECTING...";
    } else if (connectionState === "lost") {
      el.connectionPillText.textContent = "CONNECTION LOST";
    } else {
      el.connectionPillText.textContent = "OFFLINE";
    }
  }
  if (connectionState === "offline") {
    if (el.statusText) {
      el.statusText.textContent = "No runtime connected";
    }
    if (el.runtimeState) {
      el.runtimeState.textContent = "";
    }
  } else if ((connectionState === "reconnecting" || connectionState === "lost") && el.statusText) {
    const suffix = runtimeTarget || "runtime";
    el.statusText.textContent = `Connection lost to ${suffix}`;
  }
}

function updateSaveBadge(kind, text) {
  if (!el.draftInfo) return;
  el.draftInfo.dataset.state = kind || "idle";
  el.draftInfo.textContent = text;
}

function updateLatencyBadge() {
  if (!el.statusLatency) return;
  if (state.analysis.degraded) {
    el.statusLatency.className = "ide-badge warn";
    el.statusLatency.textContent = "analysis degraded";
    return;
  }
  if (state.latencySamples.length === 0) {
    el.statusLatency.textContent = "latency --";
    return;
  }
  const sorted = [...state.latencySamples].sort((a, b) => a - b);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Index];
  el.statusLatency.textContent = `diag p95 ${Math.round(p95)}ms`;
  if (p95 > 280) {
    el.statusLatency.className = "ide-badge warn";
  } else {
    el.statusLatency.className = "ide-badge ok";
  }
}

function updateAnalysisModeBadge() {
  if (!el.statusLatency) return;
  if (state.analysis.degraded) {
    el.statusLatency.className = "ide-badge warn";
    el.statusLatency.textContent = "analysis degraded";
    return;
  }
  updateLatencyBadge();
}

// ── Toast Notifications ─────────────────────────────────

let ideToastTimer = null;

function showIdeToast(message, type) {
  const toast = el.ideToast;
  if (!toast) return;
  toast.textContent = message;
  toast.className = `ide-toast visible ${type || ""}`.trim();
  clearTimeout(ideToastTimer);
  ideToastTimer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3500);
}

// ── Project Status Dot ──────────────────────────────────

function updateProjectStatusDot(status, tooltip) {
  let dot = document.querySelector(".ide-project-status-dot");
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "ide-project-status-dot";
    dot.setAttribute("role", "button");
    dot.setAttribute("tabindex", "0");
    dot.setAttribute("aria-label", "Validate project");
    dot.addEventListener("click", () => {
      const validateBtn = document.getElementById("validateBtn");
      if (validateBtn) validateBtn.click();
    });
    dot.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const validateBtn = document.getElementById("validateBtn");
      if (validateBtn) validateBtn.click();
    });
    const title = el.ideTitle;
    if (title) title.appendChild(dot);
  }
  dot.dataset.status = status || "pending";
  dot.title = tooltip || "Not validated yet. Click to validate.";
}

function setProjectValidationPending(reason) {
  const suffix = reason ? String(reason) : "Project changed since last validation.";
  updateProjectStatusDot("pending", `${suffix} Click to validate.`);
}

function updateIdeTitleWithProject() {
  if (!el.ideTitle) return;
  const name = state.activeProject
    ? state.activeProject.split("/").filter(Boolean).pop()
    : null;
  const textNode = el.ideTitle.firstChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    textNode.textContent = name ? `truST IDE \u2014 ${name}` : "truST IDE";
  } else {
    const existing = el.ideTitle.querySelector(".ide-project-status-dot");
    el.ideTitle.textContent = name ? `truST IDE \u2014 ${name}` : "truST IDE";
    if (existing) el.ideTitle.appendChild(existing);
  }
}
