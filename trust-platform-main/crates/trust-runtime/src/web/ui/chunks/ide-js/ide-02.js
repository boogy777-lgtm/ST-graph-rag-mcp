    const message = payload.error || `session refresh failed (${response.status})`;
    clearStoredIdeSession();
    throw new Error(message);
  }
  const session = payload.result || {};
  state.sessionToken = session.token || null;
  if (state.sessionToken) {
    persistIdeSession(state.sessionToken, session.role || role);
  } else {
    clearStoredIdeSession();
  }
  return payload.result;
}

async function apiJson(url, options = {}) {
  const {
    timeoutMs = API_DEFAULT_TIMEOUT_MS,
    allowSessionRetry = true,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const opts = {
    method: "GET",
    ...fetchOptions,
    headers: {
      ...(fetchOptions.headers || {}),
    },
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, opts);
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {ok: false, error: text || "invalid response"};
    }
    if (!response.ok || payload.ok === false) {
      const message = payload.error || `request failed (${response.status})`;
      const normalizedMessage = String(message || "").toLowerCase();
      const sessionAuthError = (
        normalizedMessage.includes(SESSION_EXPIRED_TEXT) ||
        normalizedMessage.includes("missing x-trust-ide-session") ||
        normalizedMessage.includes("invalid session") ||
        normalizedMessage.includes("expired session")
      );
      if (allowSessionRetry && state.ready && sessionAuthError) {
        await requestNewSession();
        return await apiJson(url, {
          ...options,
          allowSessionRetry: false,
        });
      }
      throw new Error(message);
    }
    state.online = true;
    updateConnectionBadge();
    if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "result")) {
      return payload.result;
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`request timeout after ${timeoutMs}ms`);
    }
    if (error instanceof TypeError) {
      state.online = false;
      updateConnectionBadge();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}



// ── Event Binding ──────────────────────────────────────

function closeMoreActionsMenu() {
  if (!el.moreActionsMenu || !el.moreActionsBtn || !el.headerMoreActions) return;
  el.moreActionsMenu.hidden = true;
  el.moreActionsBtn.setAttribute("aria-expanded", "false");
  el.headerMoreActions.classList.remove("open");
}

function openMoreActionsMenu() {
  if (!el.moreActionsMenu || !el.moreActionsBtn || !el.headerMoreActions) return;
  el.moreActionsMenu.hidden = false;
  el.moreActionsBtn.setAttribute("aria-expanded", "true");
  el.headerMoreActions.classList.add("open");
}

function bindHeaderOverflowMenu() {
  if (!el.moreActionsBtn || !el.moreActionsMenu || !el.headerMoreActions) return;

  el.moreActionsBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const expanded = el.moreActionsBtn.getAttribute("aria-expanded") === "true";
    if (expanded) {
      closeMoreActionsMenu();
    } else {
      openMoreActionsMenu();
    }
  });

  el.moreActionsMenu.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("button")) {
      closeMoreActionsMenu();
    }
  });
}

function bindGlobalEvents() {
  bindResizeHandles();
  bindHeaderOverflowMenu();

  // DRY: action bindings
  bindAction(el.saveBtn, () => saveActiveTab({explicit: true}));
  bindAction(el.saveAllBtn, () => flushDirtyTabs());
  bindAction(el.buildBtn, () => startTask("build"), "Build failed");
  bindAction(el.validateBtn, () => startTask("validate"), "Validate failed");
  bindAction(el.testBtn, () => startTask("test"), "Test failed");
  bindAction(el.retryActionBtn, () => retryLastFailedAction(), "Retry failed");
  el.splitBtn.addEventListener("click", () => toggleSplitEditor());
  el.editorPanePrimary.addEventListener("mousedown", () => { if (state.splitEnabled) setActivePane("primary"); });
  el.editorPaneSecondary.addEventListener("mousedown", () => { if (state.splitEnabled) setActivePane("secondary"); });
  bindAction(el.newProjectBtn, () => newProjectFlow(), "New project failed");
  bindAction(el.openProjectBtn, () => openProjectFlow(), "Open folder failed");
  el.quickOpenBtn.addEventListener("click", () => openQuickOpenPalette());
  bindAction(el.welcomeNewProjectBtn, () => newProjectFlow(), "New project failed");
  bindAction(el.welcomeOpenBtn, () => openProjectFlow(), "Open folder failed");
  el.welcomeQuickOpenBtn.addEventListener("click", () => openQuickOpenPalette());
  bindAction(el.newFileBtn, () => createPath("file"), "Create file failed");
  bindAction(el.newFolderBtn, () => createPath("directory"), "Create folder failed");
  bindAction(el.renamePathBtn, () => renameSelectedPath(), "Rename failed");
  bindAction(el.deletePathBtn, () => deleteSelectedPath(), "Delete failed");

  el.fileFilterInput.addEventListener("input", (event) => {
    state.fileFilter = String(event.target.value || "").trim().toLowerCase();
    renderFileTree();
  });
  el.themeToggle.addEventListener("click", () => toggleTheme());
  el.cmdPaletteBtn.addEventListener("click", () => openCommandPalette());

  // Context menu actions
  el.ctxOpenBtn.addEventListener("click", () => {
    const path = state.contextPath;
    closeTreeContextMenu();
    if (!path) return;
    if (nodeKindForPath(path) === "file") {
      openFile(path).catch((error) => setStatus(`Open failed: ${error.message || error}`));
    } else {
      toggleDir(path);
    }
  });
  bindAction(el.ctxNewFileBtn, () => { closeTreeContextMenu(); return createPath("file"); }, "Create file failed");
  bindAction(el.ctxNewFolderBtn, () => { closeTreeContextMenu(); return createPath("directory"); }, "Create folder failed");
  bindAction(el.ctxRenameBtn, () => { closeTreeContextMenu(); return renameSelectedPath(); }, "Rename failed");
  bindAction(el.ctxDeleteBtn, () => { closeTreeContextMenu(); return deleteSelectedPath(); }, "Delete failed");

  // Open project panel
  el.openProjectOk.addEventListener("click", () => {
    const val = el.openProjectInput.value;
    const returnTo = el.openProjectOk.dataset.returnTo;
    delete el.openProjectOk.dataset.returnTo;
    closeOpenProjectPanel();
    if (returnTo === "newProject") {
      openNewProjectModal(val);
      return;
    }
    doOpenProject(val).catch((error) => setStatus(`Open folder failed: ${error.message || error}`));
  });
  el.openProjectCancel.addEventListener("click", () => closeOpenProjectPanel());

  // New project modal
  el.newProjectOk.addEventListener("click", () => {
    submitNewProject().catch((error) => setStatus(`Create project failed: ${error.message || error}`));
  });
  el.newProjectCancel.addEventListener("click", () => closeNewProjectModal());
  el.newProjectName.addEventListener("input", () => updateNewProjectPreview());
  el.newProjectLocation.addEventListener("input", () => updateNewProjectPreview());
  el.newProjectName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitNewProject().catch((error) => setStatus(`Create project failed: ${error.message || error}`));
    } else if (event.key === "Escape") {
      closeNewProjectModal();
    }
  });
  el.newProjectBrowseBtn.addEventListener("click", () => {
    closeNewProjectModal();
    openProjectPanel();
    el.openProjectOk.dataset.returnTo = "newProject";
  });

  // Browse button
  if (el.browseBtn) {
    el.browseBtn.addEventListener("click", () => {
      if (state.browseVisible) {
        hideBrowseListing();
      } else {
        const current = el.openProjectInput.value.trim() || undefined;
        browseTo(current);
      }
    });
  }

  el.openProjectInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const items = state._recentItems || [];
      const idx = state._recentSelectedIndex ?? -1;
      if (idx >= 0 && idx < items.length) {
        items[idx].click();
      } else {
        const val = el.openProjectInput.value;
        closeOpenProjectPanel();
        doOpenProject(val).catch((error) => setStatus(`Open folder failed: ${error.message || error}`));
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeOpenProjectPanel();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const items = state._recentItems || [];
      if (items.length > 0) {
        const idx = (state._recentSelectedIndex ?? -1) + 1;
        state._recentSelectedIndex = idx >= items.length ? 0 : idx;
        items.forEach((r, i) => r.classList.toggle("active", i === state._recentSelectedIndex));
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const items = state._recentItems || [];
      if (items.length > 0) {
        const idx = (state._recentSelectedIndex ?? 0) - 1;
        state._recentSelectedIndex = idx < 0 ? items.length - 1 : idx;
        items.forEach((r, i) => r.classList.toggle("active", i === state._recentSelectedIndex));
      }
    }
  });

  for (const header of document.querySelectorAll(".ide-section-header")) {
    header.addEventListener("click", () => {
      const section = header.closest(".ide-section");
      if (!section) return;
      const collapsed = section.classList.toggle("collapsed");
      header.setAttribute("aria-expanded", String(!collapsed));
    });
  }

  if (typeof BroadcastChannel !== "undefined") {
    try {
      state.presenceChannel = new BroadcastChannel(IDE_PRESENCE_CHANNEL);
      state.presenceChannel.onmessage = (event) => {
        consumePresencePayload(event.data);
      };
    } catch {
      state.presenceChannel = null;
    }
  }

  el.commandInput.addEventListener("input", (event) => {
    state.commandFilter = event.target.value || "";
    state.selectedCommandIndex = 0;
    renderCommandList();
  });

  el.commandInput.addEventListener("keydown", (event) => {
    const filter = state.commandFilter.trim().toLowerCase();
    const commands = state.commands.filter((cmd) => {
      if (!filter) return true;
      return cmd.label.toLowerCase().includes(filter);
    });
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (commands.length > 0) {
        state.selectedCommandIndex = (state.selectedCommandIndex + 1) % commands.length;
        renderCommandList();
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (commands.length > 0) {
        state.selectedCommandIndex = (state.selectedCommandIndex - 1 + commands.length) % commands.length;
        renderCommandList();
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      runSelectedCommand().catch(() => {});
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    }
  });

  el.commandPalette.addEventListener("click", (event) => {
    if (event.target === el.commandPalette) {
      closePalette();
    }
  });

  document.addEventListener("click", (event) => {
    if (el.moreActionsBtn && el.moreActionsBtn.getAttribute("aria-expanded") === "true") {
      const target = event.target;
      if (!(target instanceof Node) || !el.headerMoreActions || !el.headerMoreActions.contains(target)) {
        closeMoreActionsMenu();
      }
    }
    if (!el.treeContextMenu.classList.contains("ide-hidden")) {
      const target = event.target;
      if (target instanceof Node && !el.treeContextMenu.contains(target)) {
        closeTreeContextMenu();
      }
    }
  });

  window.addEventListener("online", () => {
    state.online = true;
    updateConnectionBadge();
    setStatus("Connection restored. Flushing dirty drafts...");
