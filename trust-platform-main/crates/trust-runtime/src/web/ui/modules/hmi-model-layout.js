async function refreshDescriptorModel() {
  try {
    const response = await apiControl('hmi.descriptor.get');
    if (response.ok) {
      state.descriptor = response.result || null;
    }
  } catch (_error) {
    // descriptor curation stays disabled when endpoint is unavailable
  }
}

async function saveDescriptorAndRefresh(descriptor) {
  const response = await apiControl('hmi.descriptor.update', { descriptor });
  if (!response.ok) {
    throw new Error(response.error || 'descriptor update failed');
  }
  state.descriptor = descriptor;
  const nextRevision = Number(response.result?.schema_revision);
  if (Number.isFinite(nextRevision)) {
    await refreshSchemaForRevision(nextRevision);
  } else {
    await refreshActivePage({ forceValues: true });
  }
}

function promptChoice(title, values, current) {
  const normalized = Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim())))
    .map((value) => value.trim());
  const suggestion = normalized.join(', ');
  const value = window.prompt(`${title}\nOptions: ${suggestion}`, current || normalized[0] || '');
  if (!value) {
    return null;
  }
  return value.trim();
}

function widgetTypeOptionsFor(widget) {
  const dataType = String(widget?.data_type || '').toUpperCase();
  const options = new Set(['value', 'readout', 'text']);
  if (dataType.includes('BOOL')) {
    options.add('indicator');
    options.add('toggle');
  }
  if (/REAL|LREAL|INT|DINT|UDINT|UINT|SINT|USINT|LINT|ULINT|TIME|LTIME/.test(dataType)) {
    options.add('gauge');
    options.add('sparkline');
    options.add('bar');
    options.add('tank');
    options.add('slider');
  }
  if (Array.isArray(widget?.enum_values) && widget.enum_values.length) {
    options.add('selector');
  }
  return Array.from(options);
}

function setpointPeerWidgetId(widget) {
  const path = String(widget?.path || '');
  if (!path) {
    return null;
  }
  const candidates = [
    path.replace(/setpoint/gi, '').replace(/__+/g, '_').replace(/\._/g, '.').replace(/_$/g, ''),
    path.replace(/_setpoint/gi, '_pv'),
    path.replace(/setpoint/gi, 'pv'),
    path.replace(/_sp\b/gi, '_pv'),
    path.replace(/\.sp\b/gi, '.pv'),
  ]
    .map((value) => value.replace(/__+/g, '_').replace(/_\./g, '.').trim())
    .filter((value) => value && value !== path);
  if (!candidates.length) {
    return null;
  }
  const byPath = new Map((state.schema?.widgets || []).map((entry) => [entry.path, entry.id]));
  for (const candidate of candidates) {
    const id = byPath.get(candidate);
    if (id) {
      return id;
    }
  }
  return null;
}

function commandKeywordMatch(text) {
  const normalized = String(text || '').toLowerCase();
  return /(start|stop|reset|enable|disable|bypass|trip|shutdown)/.test(normalized);
}

async function runWidgetLayoutAction(widget, action) {
  const descriptor = ensureDescriptorModel();
  if (!descriptor || !Array.isArray(descriptor.pages)) {
    return;
  }

  if (action === 'hide') {
    if (!window.confirm(`Hide "${widget.label || widget.path}" from this page?`)) {
      return;
    }
    removeWidgetPlacementFromPage(descriptor, widget.page, widget.path);
  } else if (action === 'move') {
    const target = promptChoice('Move widget to page', pages().map((page) => page.id), widget.page);
    if (!target) {
      return;
    }
    removeWidgetPlacements(descriptor, widget.path);
    addWidgetPlacement(descriptor, target, widget, widget.group || 'Process Variables');
  } else if (action === 'pin') {
    if (widgetPinnedOnOverview(descriptor, widget.path)) {
      const overview = ensurePageDescriptor(descriptor, 'overview');
      if (overview) {
        for (const section of overview.sections || []) {
          section.widgets = (section.widgets || []).filter((entry) => entry.bind !== widget.path);
        }
        trimEmptySections(descriptor);
      }
    } else {
      addWidgetPlacement(descriptor, 'overview', widget, 'Pinned');
    }
  } else if (action === 'label') {
    const nextLabel = window.prompt('Widget label', widget.label || widget.path);
    if (!nextLabel) {
      return;
    }
    updateWidgetPlacements(descriptor, widget.path, (entry) => {
      entry.label = nextLabel.trim();
    });
  } else if (action === 'type') {
    const allowed = widgetTypeOptionsFor(widget);
    const nextType = promptChoice('Widget type', allowed, widget.widget || 'value');
    if (!nextType) {
      return;
    }
    updateWidgetPlacements(descriptor, widget.path, (entry) => {
      entry.widget_type = nextType;
    });
  } else if (action === 'span') {
    const preset = promptChoice('Widget size', ['small', 'medium', 'large'], 'medium');
    if (!preset) {
      return;
    }
    const span = preset.toLowerCase() === 'small' ? 3 : (preset.toLowerCase() === 'large' ? 8 : 5);
    updateWidgetPlacements(descriptor, widget.path, (entry) => {
      entry.span = span;
    });
  } else {
    return;
  }

  try {
    await saveDescriptorAndRefresh(descriptor);
    await refreshDescriptorModel();
    renderCurrentPage();
  } catch (error) {
    setEmptyMessage(`Layout update failed: ${error}`);
  }
}

function schemaWidgetByPath(path) {
  return (state.schema?.widgets || []).find((widget) => widget.path === path || widget.id === path);
}

function unplacedSchemaWidgets(descriptor) {
  const placed = placedWidgetPaths(descriptor);
  return (state.schema?.widgets || []).filter((widget) => !placed.has(widget.path));
}

function promptSignalPath(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) {
    return null;
  }
  const options = candidates.slice(0, 24).map((widget) => widget.path);
  return promptChoice('Signal path to place', options, options[0]);
}

