  host.classList.add('widget-slider');
  const range = numericRange(widget);
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'widget-slider-control';
  input.min = String(range.min);
  input.max = String(range.max);
  input.step = /REAL|LREAL/i.test(String(widget.data_type || '')) ? '0.1' : '1';
  const label = document.createElement('div');
  label.className = 'widget-slider-label';
  const pvLabel = document.createElement('div');
  pvLabel.className = 'widget-slider-label';
  host.appendChild(input);
  host.appendChild(label);
  host.appendChild(pvLabel);

  let lastValue = range.min;
  const writable = widget.writable === true && state.schema?.read_only !== true;
  const peerId = setpointPeerWidgetId(widget);
  input.disabled = !writable;

  input.addEventListener('input', () => {
    label.textContent = `${formatValue(Number(input.value))}${widget.unit ? ` ${widget.unit}` : ''}`;
  });
  input.addEventListener('change', async () => {
    if (!writable) {
      return;
    }
    const next = Number(input.value);
    const ok = await writeWidgetValue(widget, next);
    if (!ok) {
      input.value = String(lastValue);
      label.textContent = `${formatValue(lastValue)}${widget.unit ? ` ${widget.unit}` : ''}`;
    }
  });

  return (entry) => {
    const numeric = numericFromEntry(entry);
    if (numeric === null) {
      label.textContent = '--';
      pvLabel.textContent = peerId ? 'PV: --' : '';
      input.disabled = !writable;
      return;
    }
    lastValue = numeric;
    input.value = String(numeric);
    label.textContent = `${formatValue(numeric)}${widget.unit ? ` ${widget.unit}` : ''}`;
    if (peerId) {
      const peerEntry = state.latestValues.get(peerId);
      pvLabel.textContent = `PV: ${peerEntry ? formatValue(peerEntry.v) : '--'}${widget.unit ? ` ${widget.unit}` : ''}`;
    } else {
      pvLabel.textContent = '';
    }
    input.disabled = !writable;
  };
}

function createModuleRenderer(widget, host) {
  host.classList.add('widget-module');
  const header = document.createElement('div');
  header.className = 'widget-module-header';
  const dot = document.createElement('span');
  dot.className = 'widget-module-status';
  dot.style.background = 'var(--muted)';
  const nameEl = document.createElement('span');
  nameEl.textContent = widget.label || widget.path || 'Module';
  header.appendChild(dot);
  header.appendChild(nameEl);
  host.appendChild(header);

  const metrics = document.createElement('div');
  metrics.className = 'widget-module-metrics';
  const metric1 = document.createElement('div');
  metric1.className = 'widget-module-metric';
  const val1 = document.createElement('span');
  val1.className = 'widget-module-metric-value';
  val1.textContent = '--';
  const lbl1 = document.createElement('span');
  lbl1.className = 'widget-module-metric-label';
  lbl1.textContent = widget.unit || 'value';
  metric1.appendChild(val1);
  metric1.appendChild(lbl1);
  metrics.appendChild(metric1);
  host.appendChild(metrics);

  return (entry) => {
    const active = entry && entry.v !== null && entry.v !== undefined;
    const isBool = entry && typeof entry.v === 'boolean';
    if (isBool) {
      dot.style.background = entry.v ? 'var(--ok)' : 'var(--muted)';
      dot.style.color = entry.v ? 'var(--ok)' : 'var(--muted)';
      dot.classList.toggle('active', entry.v === true);
      val1.textContent = entry.v ? 'Running' : 'Stopped';
    } else {
      dot.style.background = active ? 'var(--ok)' : 'var(--muted)';
      dot.style.color = active ? 'var(--ok)' : 'var(--muted)';
      dot.classList.toggle('active', active);
      val1.textContent = entry ? formatValue(entry.v) : '--';
    }
    const card = host.closest('.card');
    if (card) {
      const alarm = entry && (entry.q === 'bad' || entry.v === false);
      card.dataset.alarm = alarm ? 'true' : 'false';
    }
  };
}

function createWidgetRenderer(widget, host) {
  const kind = String(widget?.widget || '').toLowerCase();
  if (kind === 'gauge') {
    return createGaugeRenderer(widget, host);
  }
  if (kind === 'sparkline') {
    return createSparklineRenderer(widget, host);
  }
  if (kind === 'bar') {
    return createBarRenderer(widget, host);
  }
  if (kind === 'tank') {
    return createTankRenderer(widget, host);
  }
  if (kind === 'indicator') {
    return createIndicatorRenderer(widget, host);
  }
  if (kind === 'toggle') {
    return createToggleRenderer(widget, host);
  }
  if (kind === 'slider') {
    return createSliderRenderer(widget, host);
  }
  if (kind === 'module') {
    return createModuleRenderer(widget, host);
  }
  return createDefaultRenderer(host);
}

