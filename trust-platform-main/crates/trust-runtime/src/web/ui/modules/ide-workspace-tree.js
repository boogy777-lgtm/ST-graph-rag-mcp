function flattenFiles(nodes, out = []) {
  for (const node of nodes) {
    if (node.kind === "file") {
      out.push(node.path);
    } else if (Array.isArray(node.children)) {
      flattenFiles(node.children, out);
    }
  }
  return out;
}

function nodeKindForPath(path, nodes = state.tree) {
  for (const node of nodes || []) {
    if (node.path === path) {
      return node.kind || null;
    }
    if (node.kind === "directory" && Array.isArray(node.children)) {
      const nested = nodeKindForPath(path, node.children);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function nodeMatchesFilter(node, filter) {
  if (!filter) {
    return true;
  }
  const name = String(node.name || "").toLowerCase();
  const path = String(node.path || "").toLowerCase();
  if (name.includes(filter) || path.includes(filter)) {
    return true;
  }
  return Array.isArray(node.children) && node.children.some((child) => nodeMatchesFilter(child, filter));
}

function selectPath(path) {
  state.selectedPath = path || null;
  renderFileTree();
}

function toggleDir(path) {
  if (state.expandedDirs.has(path)) {
    state.expandedDirs.delete(path);
  } else {
    state.expandedDirs.add(path);
  }
  renderFileTree();
}

function closeTreeContextMenu() {
  el.treeContextMenu.classList.add("ide-hidden");
  state.contextPath = null;
}

function openTreeContextMenu(path, x, y) {
  state.contextPath = path;
  selectPath(path);
  const writable = Boolean(state.writeEnabled);
  el.ctxNewFileBtn.disabled = !writable;
  el.ctxNewFolderBtn.disabled = !writable;
  el.ctxRenameBtn.disabled = !writable;
  el.ctxDeleteBtn.disabled = !writable;
  el.treeContextMenu.style.left = `${Math.max(8, Math.floor(x))}px`;
  el.treeContextMenu.style.top = `${Math.max(8, Math.floor(y))}px`;
  el.treeContextMenu.classList.remove("ide-hidden");
}

function renderTreeNode(node, depth) {
  if (!nodeMatchesFilter(node, state.fileFilter)) {
    return;
  }
  const row = document.createElement("button");
  row.type = "button";
  row.className = "ide-tree-row";
  row.setAttribute("role", "treeitem");
  row.style.paddingLeft = `${8 + depth * 14}px`;
  const isSelected = state.selectedPath === node.path || state.activePath === node.path;
  if (isSelected) {
    row.setAttribute("aria-current", "true");
  }

  const indent = document.createElement("span");
  indent.className = "ide-tree-indent";
  indent.textContent = "";
  row.appendChild(indent);

  const icon = document.createElement("span");
  icon.className = "ide-tree-icon";
  if (node.kind === "directory") {
    const expanded = state.expandedDirs.has(node.path) || state.fileFilter.length > 0;
    icon.classList.add(expanded ? "folder-open" : "folder-closed");
  } else {
    const ext = String(node.name || "").split(".").pop().toLowerCase();
    const iconMap = {st: "file-st", toml: "file-toml", md: "file-md", json: "file-json"};
    icon.classList.add(iconMap[ext] || "file-generic");
  }
  row.appendChild(icon);

  const label = document.createElement("span");
  label.textContent = node.name;
  row.appendChild(label);

  row.addEventListener("click", async () => {
    closeTreeContextMenu();
    selectPath(node.path);
    if (node.kind === "directory") {
      toggleDir(node.path);
    } else {
      await openFile(node.path);
    }
  });
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openTreeContextMenu(node.path, event.clientX, event.clientY);
  });
  el.fileTree.appendChild(row);

  if (node.kind === "directory" && (state.expandedDirs.has(node.path) || state.fileFilter.length > 0)) {
    for (const child of node.children || []) {
      renderTreeNode(child, depth + 1);
    }
  }
}

function renderFileTree() {
  el.fileTree.innerHTML = "";
  if (state.tree.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = state.activeProject
      ? "No visible files in project root."
      : "No project selected. Use Open Folder.";
    el.fileTree.appendChild(empty);
    return;
  }
  for (const node of state.tree) {
    renderTreeNode(node, 0);
  }
}

function renderTabs() {
  if (state.splitEnabled) {
    renderPrimaryTabs();
    renderSecondaryTabs();
  } else {
    // Single-editor mode: render into the shared tab bar
    el.tabBar.innerHTML = "";
    for (const [path, tab] of state.openTabs.entries()) {
      el.tabBar.appendChild(createTabButton(path, tab, path === state.activePath, async () => {
        await switchTab(path);
      }));
    }
  }
}

function createTabButton(path, tab, isActive, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `ide-tab${isActive ? " active" : ""}`;
  button.setAttribute("aria-label", `Open tab ${path}`);
  if (tab.dirty) {
    const dot = document.createElement("span");
    dot.className = "dirty-dot";
    button.appendChild(dot);
  }
  const label = document.createElement("span");
  label.textContent = path;
  button.appendChild(label);
  button.addEventListener("click", onClick);
  return button;
}

function renderPrimaryTabs() {
  el.tabBarPrimary.innerHTML = "";
  for (const [path, tab] of state.openTabs.entries()) {
    el.tabBarPrimary.appendChild(createTabButton(path, tab, path === state.activePath, async () => {
      await switchTab(path);
    }));
  }
}

function renderSecondaryTabs() {
  el.tabBarSecondary.innerHTML = "";
  for (const path of state.secondaryOpenTabs) {
    const tab = state.openTabs.get(path);
    if (!tab) continue;
    el.tabBarSecondary.appendChild(createTabButton(path, tab, path === state.secondaryPath, async () => {
      openInSecondaryPane(path, tab.content);
      renderSecondaryTabs();
    }));
  }
}

function renderBreadcrumbs(path) {
  el.breadcrumbBar.innerHTML = "";
  const projectRoot = state.activeProject || "project";
  const rootLabel = projectRoot.split("/").filter(Boolean).pop() || projectRoot;
  if (!path) {
    el.breadcrumbBar.textContent = rootLabel;
    return;
  }
  const parts = String(path).split("/").filter(Boolean);
  const root = document.createElement("span");
  root.textContent = rootLabel;
  el.breadcrumbBar.appendChild(root);
  for (const [index, part] of parts.entries()) {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "\u203A";
    el.breadcrumbBar.appendChild(sep);

    const item = document.createElement("span");
    item.textContent = part;
    if (index === parts.length - 1) {
      item.className = "current";
    }
    el.breadcrumbBar.appendChild(item);
  }
}

