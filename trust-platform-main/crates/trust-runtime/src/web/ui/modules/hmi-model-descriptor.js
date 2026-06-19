function pages() {
  const value = state.schema?.pages;
  return Array.isArray(value) ? value : [];
}

function currentPage() {
  return pages().find((page) => page.id === state.currentPage);
}

function currentPageKind() {
  return (currentPage()?.kind || 'dashboard').toLowerCase();
}

function ensureCurrentPage() {
  const entries = pages();
  if (!entries.length) {
    state.currentPage = null;
    return;
  }
  const exists = entries.some((page) => page.id === state.currentPage);
  if (!exists) {
    state.currentPage = entries[0].id;
  }
}


function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return null;
  }
}

function descriptorWidgetFromSchema(widget) {
  return {
    widget_type: String(widget.widget || 'value'),
    bind: String(widget.path || ''),
    label: widget.label || undefined,
    unit: widget.unit || undefined,
    min: Number.isFinite(widget.min) ? Number(widget.min) : undefined,
    max: Number.isFinite(widget.max) ? Number(widget.max) : undefined,
    span: Number.isFinite(widget.widget_span) ? Math.max(1, Math.min(12, Math.trunc(Number(widget.widget_span)))) : undefined,
    on_color: widget.on_color || undefined,
    off_color: widget.off_color || undefined,
    inferred_interface: widget.inferred_interface === true ? true : undefined,
    zones: Array.isArray(widget.zones) ? widget.zones : [],
  };
}

function descriptorPageFromSchema(page, allWidgets) {
  const widgets = allWidgets.filter((widget) => widget.page === page.id);
  const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));
  const sections = [];
  if (Array.isArray(page.sections) && page.sections.length) {
    for (const section of page.sections) {
      const sectionWidgets = [];
      for (const id of Array.isArray(section.widget_ids) ? section.widget_ids : []) {
        const widget = widgetsById.get(id);
        if (!widget) {
          continue;
        }
        sectionWidgets.push(descriptorWidgetFromSchema(widget));
      }
      if (!sectionWidgets.length) {
        continue;
      }
      sections.push({
        title: section.title || 'Section',
        span: Number.isFinite(section.span) ? Math.max(1, Math.min(12, Math.trunc(Number(section.span)))) : 12,
        widgets: sectionWidgets,
      });
    }
  }
  if (!sections.length) {
    const grouped = new Map();
    for (const widget of widgets) {
      const group = widget.group || 'General';
      if (!grouped.has(group)) {
        grouped.set(group, []);
      }
      grouped.get(group).push(descriptorWidgetFromSchema(widget));
    }
    for (const [group, groupWidgets] of grouped.entries()) {
      sections.push({
        title: group,
        span: 12,
        widgets: groupWidgets,
      });
    }
  }
  return {
    id: page.id,
    title: page.title || page.id,
    icon: page.icon || undefined,
    order: Number.isFinite(page.order) ? Number(page.order) : 0,
    kind: page.kind || 'dashboard',
    duration_ms: Number.isFinite(page.duration_ms) ? Number(page.duration_ms) : undefined,
    svg: page.svg || undefined,
    signals: Array.isArray(page.signals) ? page.signals.filter((entry) => typeof entry === 'string' && entry.trim()) : [],
    sections,
    bindings: Array.isArray(page.bindings) ? page.bindings : [],
  };
}

function descriptorFromSchema(schema) {
  const widgets = Array.isArray(schema?.widgets) ? schema.widgets : [];
  const pages = Array.isArray(schema?.pages) ? schema.pages : [];
  return {
    config: {
      theme: {
        style: schema?.theme?.style || 'classic',
        accent: schema?.theme?.accent || '#0ea5b7',
      },
      layout: {},
      write: {},
      alarm: [],
    },
    pages: pages.map((page) => descriptorPageFromSchema(page, widgets)),
  };
}

function ensureDescriptorModel() {
  if (state.descriptor && typeof state.descriptor === 'object') {
    const cloned = cloneJson(state.descriptor);
    if (cloned) {
      return cloned;
    }
  }
  return descriptorFromSchema(state.schema);
}

function normalizeDescriptorPage(page, schemaPage) {
  if (!Array.isArray(page.sections)) {
    page.sections = [];
  }
  if (!Array.isArray(page.bindings)) {
    page.bindings = Array.isArray(schemaPage?.bindings) ? schemaPage.bindings : [];
  }
  if (!Array.isArray(page.signals)) {
    page.signals = Array.isArray(schemaPage?.signals) ? schemaPage.signals : [];
  }
  if (!page.kind) {
    page.kind = schemaPage?.kind || 'dashboard';
  }
  if (!Number.isFinite(page.order)) {
    page.order = Number.isFinite(schemaPage?.order) ? Number(schemaPage.order) : 0;
  }
  if (!page.title) {
    page.title = schemaPage?.title || page.id;
  }
  return page;
}

function ensurePageDescriptor(descriptor, pageId) {
  if (!descriptor || !Array.isArray(descriptor.pages)) {
    return null;
  }
  const existing = descriptor.pages.find((page) => page.id === pageId);
  if (existing) {
    return normalizeDescriptorPage(existing, pages().find((entry) => entry.id === pageId));
  }
  const schemaPage = pages().find((entry) => entry.id === pageId);
  const created = normalizeDescriptorPage({
    id: pageId,
    title: schemaPage?.title || pageId,
    icon: schemaPage?.icon || undefined,
    order: Number.isFinite(schemaPage?.order) ? Number(schemaPage.order) : (descriptor.pages.length * 10),
    kind: schemaPage?.kind || 'dashboard',
    duration_ms: Number.isFinite(schemaPage?.duration_ms) ? Number(schemaPage.duration_ms) : undefined,
    svg: schemaPage?.svg || undefined,
    signals: Array.isArray(schemaPage?.signals) ? schemaPage.signals.slice() : [],
    sections: [],
    bindings: Array.isArray(schemaPage?.bindings) ? schemaPage.bindings.slice() : [],
  }, schemaPage);
  descriptor.pages.push(created);
  return created;
}

function trimEmptySections(descriptor) {
  if (!descriptor || !Array.isArray(descriptor.pages)) {
    return;
  }
  for (const page of descriptor.pages) {
    if (!Array.isArray(page.sections)) {
      page.sections = [];
      continue;
    }
    page.sections = page.sections.filter((section) => Array.isArray(section.widgets) && section.widgets.length > 0);
  }
}

function removeWidgetPlacements(descriptor, path) {
  for (const page of descriptor.pages || []) {
    for (const section of page.sections || []) {
      if (!Array.isArray(section.widgets)) {
        section.widgets = [];
      }
      section.widgets = section.widgets.filter((widget) => widget.bind !== path);
    }
  }
  trimEmptySections(descriptor);
}

function removeWidgetPlacementFromPage(descriptor, pageId, path) {
  for (const page of descriptor.pages || []) {
    if (page.id !== pageId) {
      continue;
    }
    for (const section of page.sections || []) {
      if (!Array.isArray(section.widgets)) {
        section.widgets = [];
      }
      section.widgets = section.widgets.filter((widget) => widget.bind !== path);
    }
  }
  trimEmptySections(descriptor);
}

function ensureSection(page, title) {
  if (!Array.isArray(page.sections)) {
    page.sections = [];
  }
  let section = page.sections.find((entry) => entry.title === title);
  if (!section) {
    section = {
      title,
      span: 12,
      widgets: [],
    };
    page.sections.push(section);
  }
  if (!Array.isArray(section.widgets)) {
    section.widgets = [];
  }
  return section;
}

function addWidgetPlacement(descriptor, pageId, widget, sectionTitle) {
  const page = ensurePageDescriptor(descriptor, pageId);
  if (!page) {
    return;
  }
  const section = ensureSection(page, sectionTitle || widget.group || 'Process Variables');
  if (section.widgets.some((entry) => entry.bind === widget.path)) {
    return;
  }
  section.widgets.push(descriptorWidgetFromSchema(widget));
}

function updateWidgetPlacements(descriptor, path, updater) {
  for (const page of descriptor.pages || []) {
    for (const section of page.sections || []) {
      for (const widget of section.widgets || []) {
        if (widget.bind !== path) {
          continue;
        }
        updater(widget, page, section);
      }
    }
  }
}

function widgetPinnedOnOverview(descriptor, widgetPath) {
  const overview = (descriptor.pages || []).find((page) => page.id === 'overview');
  if (!overview) {
    return false;
  }
  for (const section of overview.sections || []) {
    for (const widget of section.widgets || []) {
      if (widget.bind === widgetPath) {
        return true;
      }
    }
  }
  return false;
}

function placedWidgetPaths(descriptor) {
  const paths = new Set();
  for (const page of descriptor.pages || []) {
    for (const section of page.sections || []) {
      for (const widget of section.widgets || []) {
        if (widget && typeof widget.bind === 'string' && widget.bind.trim()) {
          paths.add(widget.bind.trim());
        }
      }
    }
  }
  return paths;
}
