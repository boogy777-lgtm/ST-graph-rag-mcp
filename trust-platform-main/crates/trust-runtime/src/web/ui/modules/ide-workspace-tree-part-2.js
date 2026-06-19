function markTabDirty(path, dirty) {
  const tab = state.openTabs.get(path);
  if (!tab) {
    return;
  }
  const nextDirty = !!dirty;
  if (tab.dirty === nextDirty) {
    return;
  }
  tab.dirty = nextDirty;
  renderTabs();
  if (nextDirty && typeof setProjectValidationPending === "function") {
    setProjectValidationPending();
  }
  document.dispatchEvent(new CustomEvent("ide-tab-dirty-change", {
    detail: {
      path,
      dirty: nextDirty,
    },
  }));
}

function updateDraftInfo() {
  const dirtyTabs = [...state.openTabs.values()].filter((tab) => tab.dirty).length;
  if (typeof ideSetCodeTabDirty === "function") {
    ideSetCodeTabDirty(dirtyTabs > 0);
  }
  if (dirtyTabs === 0) {
    el.draftInfo.textContent = "Draft sync idle";
    return;
  }
  el.draftInfo.textContent = `${dirtyTabs} unsynced draft(s)`;
}


function applyProjectSelection(selection) {
  const active = selection?.active_project ? String(selection.active_project) : "";
  const startup = selection?.startup_project ? String(selection.startup_project) : "";
  state.activeProject = active || null;
  state.startupProject = startup || null;

  if (typeof updateIdeTitleWithProject === "function") {
    updateIdeTitleWithProject();
    if (typeof setProjectValidationPending === "function") {
      setProjectValidationPending("Not validated yet.");
    }
  } else {
    const projectPath = state.activeProject || state.startupProject || "";
    const projectName = projectPath ? projectPath.split("/").filter(Boolean).pop() || projectPath : "";
    el.ideTitle.textContent = projectName || "truST IDE";
  }
  el.statusProject.textContent = state.activeProject || "--";
  if (state.activeProject) {
    const shortName = state.activeProject.split("/").filter(Boolean).pop() || state.activeProject;
    el.scopeNote.textContent = shortName;
  } else {
    el.scopeNote.textContent = "No project";
  }

  document.dispatchEvent(new CustomEvent("ide-project-changed", {
    detail: {
      activeProject: state.activeProject,
      startupProject: state.startupProject,
    },
  }));
}

async function refreshProjectSelection() {
  const selection = await apiJson("/api/ide/project", {
    method: "GET",
    headers: apiHeaders(),
  });
  applyProjectSelection(selection || {});
  return selection;
}

function loadRecentProjects() {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentProject(path) {
  const recent = loadRecentProjects().filter((item) => item.path !== path);
  recent.unshift({path, ts: Date.now()});
  if (recent.length > MAX_RECENT_PROJECTS) recent.length = MAX_RECENT_PROJECTS;
  try {
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent));
  } catch {
    // quota exceeded
  }
}

function renderRecentProjects(onSelect) {
  const recent = loadRecentProjects();
  el.openProjectRecent.innerHTML = "";
  if (recent.length === 0) {
    const hint = document.createElement("div");
    hint.className = "muted";
    hint.style.padding = "6px 0";
    hint.textContent = "No recent projects. Enter a path above.";
    el.openProjectRecent.appendChild(hint);
    return;
  }
  state._recentItems = [];
  for (const item of recent) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "ide-recent-item";
    row.innerHTML = `<svg viewBox="0 0 16 16"><path d="M2 13V4a1 1 0 0 1 1-1h3.5l2 2H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/></svg>`;
    const label = document.createElement("span");
    label.textContent = item.path;
    row.appendChild(label);
    const ts = document.createElement("span");
    ts.className = "recent-ts";
    ts.textContent = item.ts ? new Date(item.ts).toLocaleDateString() : "";
    row.appendChild(ts);
    row.addEventListener("click", () => onSelect(item.path));
    el.openProjectRecent.appendChild(row);
    state._recentItems.push(row);
  }
}

function openProjectPanel() {
  state._recentSelectedIndex = -1;
  el.openProjectInput.value = state.activeProject || state.startupProject || "";
  renderRecentProjects((path) => {
    closeOpenProjectPanel();
    doOpenProject(path);
  });
  hideBrowseListing();
  el.openProjectPanel.classList.add("open");
  el.openProjectInput.focus();
  el.openProjectInput.select();
}

function closeOpenProjectPanel() {
  el.openProjectPanel.classList.remove("open");
  state._recentSelectedIndex = -1;
  hideBrowseListing();
}

// ── New Project Flow ─────────────────────────────────────

function updateNewProjectPreview() {
  const preview = el.newProjectPreview;
  if (!preview) return;
  const name = String(el.newProjectName?.value || "").trim();
  const location = String(el.newProjectLocation?.value || "").trim();
  if (!name || !location) {
    preview.textContent = "Will create: --";
    return;
  }
  const normalizedLocation = location.replace(/[\\/]+$/, "");
  preview.textContent = `Will create: ${normalizedLocation}/${name}`;
}

function openNewProjectModal(locationOverride) {
  el.newProjectName.value = "";
  const fallbackLocation = state.activeProject
    ? state.activeProject.split("/").slice(0, -1).join("/")
    : "";
  el.newProjectLocation.value = String(locationOverride || "").trim() || fallbackLocation;
  el.newProjectTemplate.value = "empty";
  updateNewProjectPreview();
  el.newProjectModal.classList.add("open");
  el.newProjectName.focus();
}

function closeNewProjectModal() {
  el.newProjectModal.classList.remove("open");
}

async function newProjectFlow() {
  openNewProjectModal();
}

async function submitNewProject() {
  const name = el.newProjectName.value.trim();
  const location = el.newProjectLocation.value.trim();
  const template = el.newProjectTemplate.value || "empty";
  if (!name) {
    setStatus("Project name is required.");
    el.newProjectName.focus();
    return;
  }
  if (!location) {
    setStatus("Project location is required.");
    el.newProjectLocation.focus();
    return;
  }
  closeNewProjectModal();
  setStatus(`Creating project "${name}"...`);
  const selection = await apiJson("/api/ide/project/create", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({name, location, template}),
  });
  applyProjectSelection(selection || {});
  saveRecentProject(state.activeProject || `${location}/${name}`);
  state.tree = [];
  state.files = [];
  state.openTabs.clear();
  state.secondaryOpenTabs.clear();
  state.activePath = null;
  state.selectedPath = null;
  state.secondaryPath = null;
  state.references = [];
  state.searchHits = [];
  showWelcomeScreen();
  renderFileTree();
  renderTabs();
  renderBreadcrumbs(null);
  renderReferences([]);
  renderSearchHits([]);
  if (state.editorView) {
    state.suppressEditorChange = true;
    state.editorView.setValue("");
    state.suppressEditorChange = false;
    applyMonacoMarkers([], activeModel());
  }
  updateDraftInfo();
  setStatus(`Created project: ${state.activeProject || name}`);
  if (typeof showIdeToast === "function") {
    showIdeToast(`Project "${name}" created`, "success");
  }
  await bootstrapFiles();
}

async function doOpenProject(pathStr) {
