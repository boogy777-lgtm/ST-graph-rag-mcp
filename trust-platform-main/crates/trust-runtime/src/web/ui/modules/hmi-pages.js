function renderSidebar() {
  const sidebar = byId('pageSidebar');
  if (!sidebar) {
    return;
  }
  sidebar.innerHTML = '';
  ensureCurrentPage();

  const entries = pages().filter((p) => !p.hidden);
  if (!entries.length) {
    sidebar.classList.add('hidden');
    return;
  }
  sidebar.classList.remove('hidden');

  for (const page of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'page-button';
    if (page.id === state.currentPage) {
      button.classList.add('active');
    }

    const title = document.createElement('span');
    title.className = 'page-title';
    title.textContent = page.title || page.id;

    const kind = document.createElement('span');
    kind.className = 'page-kind';
    kind.textContent = page.kind || 'dashboard';

    button.appendChild(title);
    button.appendChild(kind);
    button.addEventListener('click', async () => {
      state.currentPage = page.id;
      applyRoute({ page: page.id, signal: null, focus: null, target: null });
      renderSidebar();
      renderCurrentPage();
      applyPresentationMode(state.presentationMode);
      await refreshActivePage({ forceValues: true });
    });
    sidebar.appendChild(button);
  }
}

function hideContentPanels() {
  const groups = byId('hmiGroups');
  const trend = byId('trendPanel');
  const alarm = byId('alarmPanel');
  if (groups) {
    groups.classList.add('hidden');
    groups.innerHTML = '';
  }
  if (trend) {
    trend.classList.add('hidden');
    trend.innerHTML = '';
  }
  if (alarm) {
    alarm.classList.add('hidden');
    alarm.innerHTML = '';
  }
  state.cards.clear();
  state.moduleCards.clear();
  state.sparklines.clear();
  state.processView = null;
  state.processBindingMisses = 0;
}

function visibleWidgets() {
  if (!state.schema || !Array.isArray(state.schema.widgets)) {
    return [];
  }
  if (!state.currentPage) {
    return state.schema.widgets;
  }
  // Include widgets referenced by this page's sections (e.g. shared
  // between overview and hidden equipment detail pages).
  const page = currentPage();
  const sectionIds = new Set();
  if (page && Array.isArray(page.sections)) {
    for (const s of page.sections) {
      if (Array.isArray(s.widget_ids)) {
        for (const id of s.widget_ids) sectionIds.add(id);
      }
    }
  }
  return state.schema.widgets.filter(
    (widget) => widget.page === state.currentPage || sectionIds.has(widget.id),
  );
}

function renderCurrentPage() {
  hideContentPanels();
  ensureCurrentPage();

  if (!state.currentPage) {
    setEmptyMessage('No pages configured.');
    updateDiagnosticsPill();
    return;
  }

  hideEmptyMessage();
  const page = currentPage();
  const kind = currentPageKind();

  if (kind === 'trend') {
    const panel = byId('trendPanel');
    if (panel) {
      panel.classList.remove('hidden');
      panel.innerHTML = `<h2 class="panel-head">${page?.title || 'Trends'}</h2><div class="empty">Collecting trend samples...</div>`;
    }
    updateDiagnosticsPill();
    return;
  }

  if (kind === 'alarm') {
    const panel = byId('alarmPanel');
    if (panel) {
      if (state.lastAlarmResult) {
        renderAlarmTable(state.lastAlarmResult);
      } else {
        panel.classList.remove('hidden');
        panel.innerHTML = '<h2 class="panel-head">Alarms</h2><div class="empty">Loading alarms...</div>';
      }
    }
    updateDiagnosticsPill();
    return;
  }

  if (kind === 'process') {
    void renderProcessPage(page);
    updateDiagnosticsPill();
    return;
  }

  renderWidgets();
  updateDiagnosticsPill();
}

async function refreshActivePage(options = {}) {
  if (!state.schema) {
    return;
  }
  const page = currentPage();
  const kind = currentPageKind();
  const forceValues = options.forceValues === true;

  if (kind === 'trend') {
    await refreshTrends(page);
    return;
  }
  if (kind === 'alarm') {
    await refreshAlarms();
    return;
  }
  if (kind === 'process') {
    await refreshProcessValues();
    return;
  }
  if (state.wsConnected && !forceValues) {
    return;
  }
  await refreshValues();
}

function renderSchema(schema) {
  state.schema = schema;
  state.schemaRevision = Number(schema?.schema_revision) || 0;
  state.descriptorError = typeof schema?.descriptor_error === 'string'
    ? schema.descriptor_error
    : null;
  const mode = byId('modeLabel');
  if (mode) {
    mode.textContent = schema.read_only ? 'read-only' : 'read-write';
  }

  const exportLink = byId('exportLink');
  if (exportLink) {
    if (schema.export && schema.export.enabled && typeof schema.export.route === 'string') {
      exportLink.href = schema.export.route;
      exportLink.classList.remove('hidden');
    } else {
      exportLink.classList.add('hidden');
    }
  }

  applyTheme(schema.theme);
  applyResponsiveLayout();
  ensureCurrentPage();
  applyRoute(
    {
      page: state.currentPage,
      signal: state.routeSignal,
      focus: state.routeFocus,
      target: state.routeTarget,
    },
    true,
  );
  renderSidebar();
  renderCurrentPage();
}
