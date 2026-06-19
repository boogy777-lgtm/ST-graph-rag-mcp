function formatValue(value) {
  if (value === null || value === undefined) {
    return '--';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

function widgetMeta(widget) {
  const parts = [`${widget.data_type} · ${widget.access}`];
  if (widget.inferred_interface === true) {
    parts.push('inferred interface');
  }
  if (widget.unit) {
    parts.push(widget.unit);
  }
  if (typeof widget.min === 'number' || typeof widget.max === 'number') {
    const min = typeof widget.min === 'number' ? widget.min : '-∞';
    const max = typeof widget.max === 'number' ? widget.max : '+∞';
    parts.push(`[${min}..${max}]`);
  }
  return parts.join(' · ');
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function numericRange(widget) {
  const min = Number.isFinite(widget?.min) ? Number(widget.min) : 0;
  const rawMax = Number.isFinite(widget?.max) ? Number(widget.max) : 100;
  const max = rawMax <= min ? min + 1 : rawMax;
  return { min, max };
}

function numericFromEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const numeric = Number(entry.v);
  return Number.isFinite(numeric) ? numeric : null;
}

function zoneColorForValue(widget, value, fallback) {
  if (!Array.isArray(widget?.zones) || value === null) {
    return fallback;
  }
  const match = widget.zones.find((zone) => Number(zone.from) <= value && value <= Number(zone.to));
  if (match && typeof match.color === 'string' && match.color.trim()) {
    return match.color.trim();
  }
  return fallback;
}

function writeWidgetValue(widget, value) {
  return apiControl('hmi.write', { id: widget.id, value })
    .then((response) => response && response.ok === true)
    .catch(() => false);
}

function polarPoint(cx, cy, radius, angleDeg) {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweep = endAngle > startAngle ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

function domSafeToken(value, fallback = 'widget') {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token || fallback;
}

function createDefaultRenderer(host) {
  return (entry) => {
    host.textContent = entry ? formatValue(entry.v) : '--';
    host.classList.remove('indicator-true', 'indicator-false');
  };
}

function createIndicatorRenderer(widget, host) {
  host.classList.add('widget-indicator');
  const dot = document.createElement('span');
  dot.className = 'widget-indicator-dot';
  const label = document.createElement('span');
  label.className = 'widget-indicator-label';
  host.appendChild(dot);
  host.appendChild(label);
  const onColor = typeof widget.on_color === 'string' ? widget.on_color : 'var(--ok)';
  const offColor = typeof widget.off_color === 'string' ? widget.off_color : 'var(--bad)';
  return (entry) => {
    const active = entry && entry.v === true;
    dot.style.background = active ? onColor : offColor;
    dot.style.color = active ? onColor : offColor;
    dot.classList.toggle('active', active);
    label.textContent = entry ? (active ? 'ON' : 'OFF') : '--';
  };
}

function createGaugeRenderer(widget, host) {
  host.classList.add('widget-gauge');
  const ns = 'http://www.w3.org/2000/svg';
  const centerX = 100;
  const centerY = 88;
  const radius = 56;
  const startAngle = 205;
  const endAngle = 335;

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'widget-gauge-svg');
  svg.setAttribute('viewBox', '0 0 200 120');

  const defs = document.createElementNS(ns, 'defs');
  const grad = document.createElementNS(ns, 'linearGradient');
  grad.id = `gauge-grad-${domSafeToken(widget?.id || Math.random().toString(36))}`;
  grad.setAttribute('x1', '0%');
  grad.setAttribute('y1', '0%');
  grad.setAttribute('x2', '100%');
  grad.setAttribute('y2', '0%');
  const stop1 = document.createElementNS(ns, 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', 'var(--accent)');
  stop1.setAttribute('stop-opacity', '0.7');
  const stop2 = document.createElementNS(ns, 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', 'var(--accent)');
  stop2.setAttribute('stop-opacity', '1');
  grad.appendChild(stop1);
  grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  const arcBase = document.createElementNS(ns, 'path');
  arcBase.setAttribute('class', 'widget-gauge-base');
  arcBase.setAttribute('d', describeArc(centerX, centerY, radius, startAngle, endAngle));

  const arcValue = document.createElementNS(ns, 'path');
  arcValue.setAttribute('class', 'widget-gauge-value');

  const centerValue = document.createElementNS(ns, 'text');
  centerValue.setAttribute('class', 'widget-gauge-center-value');
  centerValue.setAttribute('x', String(centerX));
  centerValue.setAttribute('y', '72');
  centerValue.textContent = '--';

  const unitText = document.createElementNS(ns, 'text');
  unitText.setAttribute('class', 'widget-gauge-unit');
  unitText.setAttribute('x', String(centerX));
  unitText.setAttribute('y', '88');
  unitText.setAttribute('text-anchor', 'middle');
  unitText.setAttribute('fill', 'var(--muted)');
  unitText.setAttribute('font-size', '9');
  unitText.setAttribute('font-family', 'var(--font-data)');
  unitText.textContent = widget.unit || '';

  svg.appendChild(arcBase);
  svg.appendChild(arcValue);
  svg.appendChild(centerValue);
  svg.appendChild(unitText);

  const label = document.createElement('div');
  label.className = 'widget-gauge-label';
  label.textContent = widget?.label || widget?.path || 'Gauge';
  host.appendChild(svg);
  host.appendChild(label);

  const range = numericRange(widget);
  return (entry) => {
    const numeric = numericFromEntry(entry);
    if (numeric === null) {
      arcValue.setAttribute('d', '');
      centerValue.textContent = '--';
      return;
    }
    const norm = clamp01((numeric - range.min) / (range.max - range.min));
    const angle = startAngle + (norm * (endAngle - startAngle));
    const color = zoneColorForValue(widget, numeric, `url(#${grad.id})`);
    arcValue.setAttribute('d', describeArc(centerX, centerY, radius, startAngle, angle));
    arcValue.setAttribute('stroke', color);
    centerValue.textContent = formatValue(numeric);
  };
}

function createSparklineRenderer(widget, host) {
  host.classList.add('widget-sparkline');
  const ns = 'http://www.w3.org/2000/svg';
  const svgW = 200;
  const svgH = 72;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'widget-sparkline-svg');
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

  const defs = document.createElementNS(ns, 'defs');
  const gradId = `spark-grad-${domSafeToken(widget?.id || Math.random().toString(36))}`;
  const grad = document.createElementNS(ns, 'linearGradient');
  grad.id = gradId;
  grad.setAttribute('x1', '0');
  grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0');
  grad.setAttribute('y2', '1');
  const s1 = document.createElementNS(ns, 'stop');
  s1.setAttribute('offset', '0%');
  s1.setAttribute('stop-color', 'var(--accent)');
  s1.setAttribute('stop-opacity', '0.25');
  const s2 = document.createElementNS(ns, 'stop');
  s2.setAttribute('offset', '100%');
  s2.setAttribute('stop-color', 'var(--accent)');
  s2.setAttribute('stop-opacity', '0.02');
  grad.appendChild(s1);
  grad.appendChild(s2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  const area = document.createElementNS(ns, 'polygon');
  area.setAttribute('class', 'widget-sparkline-area');
  area.setAttribute('fill', `url(#${gradId})`);
  svg.appendChild(area);

  const polyline = document.createElementNS(ns, 'polyline');
  polyline.setAttribute('class', 'widget-sparkline-line');
  svg.appendChild(polyline);
  const label = document.createElement('div');
  label.className = 'widget-sparkline-label';
  host.appendChild(svg);
  host.appendChild(label);

  if (!state.sparklines.has(widget.id)) {
    state.sparklines.set(widget.id, []);
  }

  const padTop = 6;
  const plotH = svgH - padTop - 8;

  return (entry) => {
    const samples = state.sparklines.get(widget.id) || [];
    const numeric = numericFromEntry(entry);
    if (numeric !== null) {
      samples.push(numeric);
      if (samples.length > 64) {
        samples.shift();
      }
      state.sparklines.set(widget.id, samples);
    }

    if (!samples.length) {
      polyline.setAttribute('points', '');
      area.setAttribute('points', '');
      label.textContent = '--';
      return;
    }

    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const span = Math.max(1e-9, max - min);
    const coords = samples.map((sample, index) => {
      const x = samples.length <= 1 ? 0 : (index / (samples.length - 1)) * svgW;
      const y = padTop + plotH - (((sample - min) / span) * plotH);
      return [x, y];
    });
    const linePoints = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    polyline.setAttribute('points', linePoints);

    const lastX = coords[coords.length - 1][0];
    const firstX = coords[0][0];
    const areaPoints = linePoints + ` ${lastX.toFixed(2)},${svgH} ${firstX.toFixed(2)},${svgH}`;
    area.setAttribute('points', areaPoints);

    label.textContent = `${formatValue(samples[samples.length - 1])}${widget.unit ? ` ${widget.unit}` : ''}`;
  };
}

