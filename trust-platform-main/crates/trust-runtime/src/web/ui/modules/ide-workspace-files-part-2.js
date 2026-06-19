async function createPath(kind) {
  const base = selectedDirectory();
  const defaultPath = kind === "directory"
    ? (base ? `${base}/new_folder` : "new_folder")
    : (base ? `${base}/new_file.st` : "new_file.st");
  const input = await idePrompt(kind === "directory" ? "Create folder path:" : "Create file path:", defaultPath);
  if (!input) {
    return;
  }
  const payload = {
    path: input.trim(),
    kind,
  };
  if (kind === "file") {
    payload.content = "";
  }
  await apiJson("/api/ide/fs/create", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(payload),
  });
  setStatus(`${kind === "directory" ? "Folder" : "File"} created: ${payload.path}`);
  await bootstrapFiles();
  if (kind === "file") {
    selectPath(payload.path);
    await openFile(payload.path);
  } else {
    selectPath(payload.path);
    state.expandedDirs.add(payload.path);
    renderFileTree();
  }
}

async function renameSelectedPath() {
  const sourcePath = state.selectedPath || state.activePath;
  if (!sourcePath) {
    setStatus("Select a file or folder first.");
    return;
  }
  const nextPath = await idePrompt("Rename/move path to:", sourcePath);
  if (!nextPath || nextPath.trim() === sourcePath) {
    return;
  }
  const result = await apiJson("/api/ide/fs/rename", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      path: sourcePath,
      new_path: nextPath.trim(),
    }),
  });
  const isDirectory = result.kind === "directory";
  remapOpenTabs(sourcePath, result.path, isDirectory);
  selectPath(result.path);
  setStatus(`Renamed: ${sourcePath} -> ${result.path}`);
  await bootstrapFiles();
  if (state.activePath && state.openTabs.has(state.activePath)) {
    await switchTab(state.activePath, {preserveSelection: true});
  } else if (state.files.length > 0) {
    await openFile(state.files[0]);
  }
}

async function deleteSelectedPath() {
  const path = state.selectedPath || state.activePath;
  if (!path) {
    setStatus("Select a file or folder first.");
    return;
  }
  const confirmed = await ideConfirm("Delete", `Delete ${path}?`);
  if (!confirmed) {
    return;
  }
  const isDirectory = nodeKindForPath(path) !== "file";
  await apiJson("/api/ide/fs/delete", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({path}),
  });
  removeTabsForPath(path, isDirectory);
  selectPath(null);
  setStatus(`Deleted: ${path}`);
  await bootstrapFiles();
  if (!state.activePath && state.files.length > 0) {
    await openFile(state.files[0]);
  } else {
    renderTabs();
  }
}

