async function addUnplacedSignalToCurrentPage() {
  const pageId = state.currentPage;
  if (!pageId) {
    return;
  }
  const descriptor = ensureDescriptorModel();
  const page = ensurePageDescriptor(descriptor, pageId);
  if (!page) {
    return;
  }
  if (!Array.isArray(page.sections) || page.sections.length === 0) {
    page.sections = [{ title: 'Process Variables', span: 12, widgets: [] }];
  }
  const sectionTitles = page.sections.map((section) => section.title || 'Section');
  const targetSectionTitle = promptChoice('Section', sectionTitles, sectionTitles[0]);
  if (!targetSectionTitle) {
    return;
  }
  const candidates = unplacedSchemaWidgets(descriptor);
  if (!candidates.length) {
    setEmptyMessage('All discovered signals are already placed.');
    return;
  }
  const selectedPath = promptSignalPath(candidates);
  if (!selectedPath) {
    return;
  }
  const schemaWidget = schemaWidgetByPath(selectedPath);
  if (!schemaWidget) {
    setEmptyMessage(`Unknown signal "${selectedPath}".`);
    return;
  }
  addWidgetPlacement(descriptor, pageId, schemaWidget, targetSectionTitle);
  try {
    await saveDescriptorAndRefresh(descriptor);
    await refreshDescriptorModel();
    renderCurrentPage();
  } catch (error) {
    setEmptyMessage(`Layout update failed: ${error}`);
  }
}

async function runSectionLayoutAction(pageId, sectionIndex, action) {
  const descriptor = ensureDescriptorModel();
  const page = ensurePageDescriptor(descriptor, pageId);
  if (!page || !Array.isArray(page.sections)) {
    return;
  }
  const index = Number(sectionIndex);
  if (!Number.isInteger(index) || index < 0 || index >= page.sections.length) {
    return;
  }
  const section = page.sections[index];
  if (!section) {
    return;
  }

  if (action === 'rename') {
    const title = window.prompt('Section title', section.title || 'Section');
    if (!title || !title.trim()) {
      return;
    }
    section.title = title.trim();
  } else if (action === 'up') {
    if (index === 0) {
      return;
    }
    const previous = page.sections[index - 1];
    page.sections[index - 1] = section;
    page.sections[index] = previous;
  } else if (action === 'down') {
    if (index >= page.sections.length - 1) {
      return;
    }
    const next = page.sections[index + 1];
    page.sections[index + 1] = section;
    page.sections[index] = next;
  } else if (action === 'add') {
    const candidates = unplacedSchemaWidgets(descriptor);
    if (!candidates.length) {
      setEmptyMessage('All discovered signals are already placed.');
      return;
    }
    const selectedPath = promptSignalPath(candidates);
    if (!selectedPath) {
      return;
    }
    const schemaWidget = schemaWidgetByPath(selectedPath);
    if (!schemaWidget) {
      setEmptyMessage(`Unknown signal "${selectedPath}".`);
      return;
    }
    section.widgets = Array.isArray(section.widgets) ? section.widgets : [];
    section.widgets.push(descriptorWidgetFromSchema(schemaWidget));
  } else {
    return;
  }

  try {
    await saveDescriptorAndRefresh(descriptor);
    await refreshDescriptorModel();
    renderCurrentPage();
  } catch (error) {
    setEmptyMessage(`Section update failed: ${error}`);
  }
}

async function resetDescriptorToScaffoldDefaults() {
  if (!window.confirm('Reset HMI descriptors to scaffold defaults? A backup snapshot will be created.')) {
    return;
  }
  try {
    const response = await apiControl('hmi.scaffold.reset', { mode: 'reset' });
    if (!response.ok) {
      throw new Error(response.error || 'reset failed');
    }
    const nextRevision = Number(response.result?.schema_revision);
    if (Number.isFinite(nextRevision)) {
      await refreshSchemaForRevision(nextRevision);
    } else {
      const schema = await apiControl('hmi.schema.get');
      if (schema.ok) {
        renderSchema(schema.result || {});
      }
    }
    await refreshDescriptorModel();
    renderSidebar();
    renderCurrentPage();
    await refreshActivePage({ forceValues: true });
  } catch (error) {
    setEmptyMessage(`Reset failed: ${error}`);
  }
}
