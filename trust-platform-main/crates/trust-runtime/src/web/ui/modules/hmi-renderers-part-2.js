function createBarRenderer(widget, host) {
  host.classList.add('widget-bar');
  const track = document.createElement('div');
  track.className = 'widget-bar-track';
  const fill = document.createElement('div');
  fill.className = 'widget-bar-fill';
  track.appendChild(fill);
  const label = document.createElement('div');
  label.className = 'widget-bar-label';
  host.appendChild(track);
  host.appendChild(label);

  const range = numericRange(widget);
  return (entry) => {
    const numeric = numericFromEntry(entry);
    if (numeric === null) {
      fill.style.width = '0%';
      label.textContent = '--';
      return;
    }
    const norm = clamp01((numeric - range.min) / (range.max - range.min));
    fill.style.width = `${(norm * 100).toFixed(2)}%`;
    fill.style.background = zoneColorForValue(widget, numeric, 'var(--accent)');
    label.textContent = `${formatValue(numeric)}${widget.unit ? ` ${widget.unit}` : ''}`;
  };
}

function createTankRenderer(widget, host) {
  host.classList.add('widget-tank');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'widget-tank-svg');
  svg.setAttribute('viewBox', '0 0 100 116');

  const defs = document.createElementNS(ns, 'defs');
  const gradId = `tank-grad-${domSafeToken(widget?.id || Math.random().toString(36))}`;
  const grad = document.createElementNS(ns, 'linearGradient');
  grad.id = gradId;
  grad.setAttribute('x1', '0');
  grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0');
  grad.setAttribute('y2', '1');
  const ts1 = document.createElementNS(ns, 'stop');
  ts1.setAttribute('offset', '0%');
  ts1.setAttribute('stop-color', 'var(--accent)');
  ts1.setAttribute('stop-opacity', '0.65');
  const ts2 = document.createElementNS(ns, 'stop');
  ts2.setAttribute('offset', '100%');
  ts2.setAttribute('stop-color', 'var(--accent)');
  ts2.setAttribute('stop-opacity', '0.95');
  grad.appendChild(ts1);
  grad.appendChild(ts2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  const frame = document.createElementNS(ns, 'rect');
  frame.setAttribute('class', 'widget-tank-frame');
  frame.setAttribute('x', '28');
  frame.setAttribute('y', '8');
  frame.setAttribute('width', '42');
  frame.setAttribute('height', '96');
  frame.setAttribute('rx', '4');

  const fill = document.createElementNS(ns, 'rect');
  fill.setAttribute('class', 'widget-tank-fill');
  fill.setAttribute('x', '28');
  fill.setAttribute('y', '104');
  fill.setAttribute('width', '42');
  fill.setAttribute('height', '0');
  fill.setAttribute('rx', '2');
  fill.setAttribute('fill', `url(#${gradId})`);

  svg.appendChild(frame);
  svg.appendChild(fill);
  const label = document.createElement('div');
  label.className = 'widget-tank-label';
  host.appendChild(svg);
  host.appendChild(label);

  const range = numericRange(widget);
  return (entry) => {
    const numeric = numericFromEntry(entry);
    if (numeric === null) {
      fill.setAttribute('y', '104');
      fill.setAttribute('height', '0');
      label.textContent = '--';
      return;
    }
    const norm = clamp01((numeric - range.min) / (range.max - range.min));
    const height = 96 * norm;
    const y = 104 - height;
    fill.setAttribute('y', y.toFixed(3));
    fill.setAttribute('height', height.toFixed(3));
    label.textContent = `${formatValue(numeric)}${widget.unit ? ` ${widget.unit}` : ''}`;
  };
}

function createToggleRenderer(widget, host) {
  host.classList.add('widget-toggle');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'widget-toggle-control';
  const stateLabel = document.createElement('span');
  stateLabel.className = 'widget-toggle-label';
  host.appendChild(button);
  host.appendChild(stateLabel);

  let current = false;
  const writable = widget.writable === true && state.schema?.read_only !== true;
  const requiresConfirm = commandKeywordMatch(`${widget.path || ''} ${widget.label || ''}`);

  button.disabled = !writable;
  button.addEventListener('click', async () => {
    if (!writable) {
      return;
    }
    button.disabled = true;
    const next = !current;
    if (requiresConfirm) {
      const verb = next ? 'enable' : 'disable';
      const label = widget.label || widget.path || 'this command';
      if (!window.confirm(`Confirm ${verb} ${label}?`)) {
        button.disabled = !writable;
        return;
      }
    }
    const ok = await writeWidgetValue(widget, next);
    if (ok) {
      current = next;
      button.classList.toggle('active', current);
      stateLabel.textContent = current ? 'ON' : 'OFF';
    }
    button.disabled = !writable;
  });

  return (entry) => {
    current = entry && entry.v === true;
    button.classList.toggle('active', current);
    stateLabel.textContent = entry ? (current ? 'ON' : 'OFF') : '--';
    button.disabled = !writable;
  };
}

function createSliderRenderer(widget, host) {
