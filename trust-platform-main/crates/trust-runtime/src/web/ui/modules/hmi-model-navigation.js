function pageIdByKind(kind) {
  const match = pages().find((page) => String(page.kind || '').toLowerCase() === kind);
  return match ? match.id : null;
}

function navigateToPage(pageId, route = {}, replace = false) {
  if (!pageId) {
    return;
  }
  state.currentPage = pageId;
  applyRoute(
    {
      page: pageId,
      signal: route.signal ?? null,
      focus: route.focus ?? null,
      target: route.target ?? null,
    },
    replace,
  );
  renderSidebar();
  renderCurrentPage();
  void refreshActivePage({ forceValues: true });
  applyPresentationMode(state.presentationMode);
}

