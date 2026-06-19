function hideBrowseListing() {
  if (el.browseListing) {
    el.browseListing.style.display = "none";
  }
  state.browseVisible = false;
}

async function browseTo(dirPath) {
  try {
    const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : "";
    const result = await apiJson(`/api/ide/browse${params}`, {
      method: "GET",
      headers: apiHeaders(),
      timeoutMs: 3000,
    });
    renderBrowseEntries(result);
    if (el.browseListing) {
      el.browseListing.style.display = "";
    }
    state.browseVisible = true;
  } catch (error) {
    setStatus(`Browse failed: ${error.message || error}`);
  }
}

function renderBrowseBreadcrumbs(currentPath) {
  el.browseBreadcrumbs.innerHTML = "";
  const segments = currentPath.split("/").filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "ide-browse-sep";
      sep.textContent = "/";
      el.browseBreadcrumbs.appendChild(sep);
    }
    const crumb = document.createElement("button");
    crumb.type = "button";
    crumb.className = "ide-browse-crumb";
    crumb.textContent = segments[i];
    const targetPath = "/" + segments.slice(0, i + 1).join("/");
    crumb.addEventListener("click", () => browseTo(targetPath));
    el.browseBreadcrumbs.appendChild(crumb);
  }
  if (segments.length === 0) {
    el.browseBreadcrumbs.textContent = "/";
  }
}

function renderBrowseEntries(data) {
  if (!el.browseEntries || !el.browseBreadcrumbs) {
    return;
  }
  const currentPath = data.current_path || "/";
  const parentPath = data.parent_path || null;
  const entries = Array.isArray(data.entries) ? data.entries : [];

  renderBrowseBreadcrumbs(currentPath);

  el.browseEntries.innerHTML = "";
  if (parentPath !== null) {
    const up = document.createElement("button");
    up.type = "button";
    up.className = "ide-browse-entry directory";
    up.innerHTML = `<svg viewBox="0 0 16 16"><path d="M8 12V4M4 8l4-4 4 4"/></svg>`;
    const label = document.createElement("span");
    label.textContent = "..";
    up.appendChild(label);
    up.addEventListener("click", () => browseTo(parentPath));
    el.browseEntries.appendChild(up);
  }

  for (const entry of entries) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `ide-browse-entry${entry.kind === "directory" ? " directory" : ""}`;
    if (entry.kind === "directory") {
      row.innerHTML = `<svg viewBox="0 0 16 16"><path d="M2 13V4a1 1 0 0 1 1-1h3.5l2 2H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/></svg>`;
    } else {
      row.innerHTML = `<svg viewBox="0 0 16 16"><path d="M4 2h5l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M9 2v4h4"/></svg>`;
    }
    const label = document.createElement("span");
    label.textContent = entry.name;
    row.appendChild(label);

    // US-2.2: Show .st file count for directories
    if (entry.kind === "directory" && entry.st_count != null) {
      const badge = document.createElement("span");
      badge.className = "ide-browse-st-count";
      badge.textContent = entry.st_count > 0 ? `${entry.st_count} .st` : "no .st";
      if (entry.st_count === 0) badge.classList.add("empty");
      row.appendChild(badge);
    }

    row.addEventListener("click", () => {
      el.openProjectInput.value = entry.path;
    });
    row.addEventListener("dblclick", () => {
      if (entry.kind === "directory") {
        browseTo(entry.path);
      }
    });
    el.browseEntries.appendChild(row);
  }
}

