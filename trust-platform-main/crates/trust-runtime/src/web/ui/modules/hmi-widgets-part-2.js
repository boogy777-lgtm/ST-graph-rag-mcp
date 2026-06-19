function renderSectionWidgets(groupsRoot, widgets, page) {
  const sectionDefs = Array.isArray(page?.sections) ? page.sections : [];
  if (!sectionDefs.length) {
    renderGroupedWidgets(groupsRoot, widgets);
    return;
  }

  const widgetById = new Map(widgets.map((widget) => [widget.id, widget]));
  const used = new Set();
  const sectionGrid = document.createElement('div');
  sectionGrid.className = 'section-grid';

  const isDashboard = (page?.kind || 'dashboard').toLowerCase() === 'dashboard';

  for (let sectionIndex = 0; sectionIndex < sectionDefs.length; sectionIndex += 1) {
    const sectionDef = sectionDefs[sectionIndex];

    // On dashboard pages, hide sections where every widget is inferred
    if (isDashboard) {
      const ids = Array.isArray(sectionDef?.widget_ids) ? sectionDef.widget_ids : [];
      const resolved = ids.map((id) => widgetById.get(id)).filter(Boolean);
      if (resolved.length > 0 && resolved.every((w) => w.inferred_interface === true)) {
        continue;
      }
    }

    const section = document.createElement('section');
    section.className = 'group-section hmi-section';
    const span = Number.isFinite(sectionDef?.span)
      ? Math.max(1, Math.min(12, Math.trunc(Number(sectionDef.span))))
      : 12;
    section.style.setProperty('--section-span', String(span));
    if (sectionDef?.tier) {
      section.dataset.tier = sectionDef.tier;
    }

    const head = document.createElement('div');
    head.className = 'section-head';
    const heading = document.createElement('h2');
    heading.className = 'group-title';
    heading.textContent = sectionDef?.title || 'Section';
    head.appendChild(heading);

    const actions = document.createElement('div');
    actions.className = 'section-actions';
    for (const action of [
      { id: 'rename', label: 'Rename' },
      { id: 'up', label: 'Up' },
      { id: 'down', label: 'Down' },
      { id: 'add', label: 'Add' },
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'section-action';
      button.textContent = action.label;
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        await runSectionLayoutAction(page?.id, sectionIndex, action.id);
      });
      actions.appendChild(button);
    }
    head.appendChild(actions);
    section.appendChild(head);

    const widgetIds = Array.isArray(sectionDef?.widget_ids) ? sectionDef.widget_ids : [];
    const isModuleStrip = sectionDef?.tier === 'module';

    if (isModuleStrip) {
      const strip = document.createElement('div');
      strip.className = 'equipment-strip';
      const meta = Array.isArray(sectionDef?.module_meta) ? sectionDef.module_meta : [];
      const metaById = new Map(meta.map((m) => [m.id, m]));
      let blockCount = 0;
      for (const id of widgetIds) {
        if (typeof id !== 'string') continue;
        const widget = widgetById.get(id);
        if (!widget) continue;
        used.add(id);
        if (blockCount > 0) {
          const arrow = document.createElement('span');
          arrow.className = 'equipment-strip-arrow';
          arrow.textContent = '\u2192';
          strip.appendChild(arrow);
        }
        const m = metaById.get(id);
        const displayWidget = m
          ? { ...widget, label: m.label || widget.label, detail_page: m.detail_page || widget.detail_page, unit: m.unit || widget.unit }
          : widget;
        strip.appendChild(createEquipmentBlock(displayWidget));
        blockCount += 1;
      }
      if (!strip.childElementCount) continue;
      section.appendChild(strip);
    } else {
      const grid = document.createElement('div');
      grid.className = 'section-widget-grid';
      for (const id of widgetIds) {
        if (typeof id !== 'string') continue;
        const widget = widgetById.get(id);
        if (!widget) continue;
        used.add(id);
        grid.appendChild(createWidgetCard(widget));
      }
      if (!grid.childElementCount) continue;
      section.appendChild(grid);
    }
    sectionGrid.appendChild(section);
  }

  if (!sectionGrid.childElementCount || used.size === 0) {
    renderGroupedWidgets(groupsRoot, widgets);
    return;
  }

  groupsRoot.appendChild(sectionGrid);
}

function renderWidgets() {
  const groupsRoot = byId('hmiGroups');
  if (!groupsRoot) {
    return;
  }

  groupsRoot.classList.remove('hidden');
  groupsRoot.innerHTML = '';
  state.cards.clear();
  state.moduleCards.clear();

  const widgets = visibleWidgets();
  if (!widgets.length) {
    setEmptyMessage('No user-visible variables discovered for this page.');
    return;
  }
  hideEmptyMessage();

  renderSectionWidgets(groupsRoot, widgets, currentPage());
}

