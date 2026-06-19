async function renderProcessPage(page) {
  const groups = byId('hmiGroups');
  if (!groups) {
    return;
  }
  const renderSeq = state.processRenderSeq + 1;
  state.processRenderSeq = renderSeq;
  groups.classList.remove('hidden');
  groups.innerHTML = '<section class="process-panel"><div class="empty">Loading process view...</div></section>';
  hideEmptyMessage();

  try {
    const svgText = await fetchProcessSvg(page);
    if (renderSeq !== state.processRenderSeq || state.currentPage !== page?.id) {
      return;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('invalid SVG payload');
    }
    const svgRoot = doc.documentElement;
    if (!svgRoot || svgRoot.tagName.toLowerCase() !== 'svg') {
      throw new Error('missing svg root');
    }
    for (const tag of ['script', 'foreignObject', 'iframe', 'object', 'embed']) {
      for (const node of Array.from(svgRoot.querySelectorAll(tag))) {
        node.remove();
      }
    }
    rewriteProcessAssetReferences(svgRoot, page.svg);

    const bindings = buildProcessBindings(page, svgRoot);
    state.processView = {
      pageId: page.id,
      widgetIds: bindings.widgetIds,
      bindingsByWidgetId: bindings.bindingsByWidgetId,
    };
    state.processBindingMisses = bindings.missingBindings;
    applyProcessFocusTarget(state.processView, state.routeFocus);
    updateDiagnosticsPill();

    const panel = document.createElement('section');
    panel.className = 'process-panel';
    const heading = document.createElement('h2');
    heading.className = 'panel-head';
    heading.textContent = page?.title || 'Process';
    const host = document.createElement('div');
    host.className = 'process-svg-host';
    host.appendChild(svgRoot);
    panel.appendChild(heading);
    panel.appendChild(host);
    groups.innerHTML = '';
    groups.appendChild(panel);
    await refreshProcessValues();
  } catch (error) {
    state.processView = null;
    if (renderSeq !== state.processRenderSeq || state.currentPage !== page?.id) {
      return;
    }
    setEmptyMessage(`Process view unavailable: ${error}`);
  }
}

