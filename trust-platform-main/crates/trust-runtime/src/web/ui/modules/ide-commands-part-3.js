function openQuickOpenPalette() {
  if (state.files.length === 0) {
    setStatus("No files available. Open a project folder first.");
    return;
  }
  state.commands = state.files.map((path) => ({
    id: `open:${path}`,
    label: `Open ${path}`,
    run: () => openFile(path),
  }));
  state.commandFilter = "";
  state.selectedCommandIndex = 0;
  renderCommandList();
  el.commandPalette.classList.add("open");
  el.commandInput.focus();
}

function paletteCommands() {
  return [
    {id: "save", label: "Save active file", run: () => saveActiveTab({explicit: true})},
    {id: "save-all", label: "Save all open files", run: () => flushDirtyTabs()},
    {id: "new-project", label: "New project", run: () => newProjectFlow()},
    {id: "open-project", label: "Open project folder", run: () => openProjectFlow()},
    {id: "format-document", label: "Format document", run: () => formatActiveDocument()},
    {id: "quick-open", label: "Quick open file", run: () => openQuickOpenPalette()},
    {id: "file-symbols", label: "File symbols", run: () => fileSymbolSearchFlow()},
    {id: "workspace-symbols", label: "Workspace symbols", run: () => workspaceSymbolSearchFlow()},
    {id: "goto-definition", label: "Go to definition", run: () => gotoDefinitionAtCursor()},
    {id: "find-references", label: "Find references", run: () => findReferencesAtCursor()},
    {id: "rename-symbol", label: "Rename symbol", run: () => renameSymbolAtCursor()},
    {id: "workspace-search", label: "Workspace search", run: () => workspaceSearchFlow()},
    {id: "fs-audit", label: "Filesystem audit log", run: () => loadFsAuditLog()},
    {id: "validate", label: "Validate project", run: () => startTask("validate")},
    {id: "build", label: "Build project", run: () => startTask("build")},
    {id: "test", label: "Run project tests", run: () => startTask("test")},
    {id: "retry-last", label: "Retry last failed action", run: () => retryLastFailedAction()},
    {id: "toggle-split", label: "Toggle split editor", run: () => toggleSplitEditor()},
    {id: "theme", label: "Toggle dark/light mode", run: () => toggleTheme()},
    {id: "next-tab", label: "Next tab", run: () => nextTab()},
    {id: "prev-tab", label: "Previous tab", run: () => previousTab()},
    {id: "refresh-files", label: "Refresh file tree", run: () => bootstrapFiles()},
    {
      id: "recover-analysis",
      label: "Recover analysis mode",
      run: () => {
        state.analysis.degraded = false;
        state.analysis.consecutiveFailures = 0;
        state.analysis.lastNoticeAtMs = 0;
        updateLatencyBadge();
        setStatus("Analysis mode reset.");
      },
    },
    {id: "a11y", label: "Show accessibility baseline path", run: () => setStatus(`Accessibility baseline: ${A11Y_REPORT_LINK}`)},
    {id: "completion", label: "Trigger completion", run: () => state.editorView && startCompletion(state.editorView)},
  ];
}

function renderCommandList() {
  const filter = state.commandFilter.trim().toLowerCase();
  const commands = state.commands.filter((cmd) => {
    if (!filter) return true;
    return cmd.label.toLowerCase().includes(filter);
  });
  if (commands.length === 0) {
    el.commandList.innerHTML = "<div class='muted'>No matching commands.</div>";
    return;
  }
  state.selectedCommandIndex = Math.min(state.selectedCommandIndex, commands.length - 1);
  el.commandList.innerHTML = "";
  commands.forEach((command, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ide-command${index === state.selectedCommandIndex ? " active" : ""}`;
    button.textContent = command.label;
    button.addEventListener("mouseenter", () => {
      state.selectedCommandIndex = index;
      renderCommandList();
    });
    button.addEventListener("click", async () => {
      closePalette();
      await command.run();
    });
    el.commandList.appendChild(button);
  });
}

function openCommandPalette() {
  state.commands = paletteCommands();
  state.commandFilter = "";
  state.selectedCommandIndex = 0;
  renderCommandList();
  el.commandPalette.classList.add("open");
  el.commandInput.focus();
}

async function runSelectedCommand() {
  const filter = state.commandFilter.trim().toLowerCase();
  const commands = state.commands.filter((cmd) => {
    if (!filter) return true;
    return cmd.label.toLowerCase().includes(filter);
  });
  if (commands.length === 0) {
    return;
  }
  const selected = commands[state.selectedCommandIndex] || commands[0];
  closePalette();
  await selected.run();
}
