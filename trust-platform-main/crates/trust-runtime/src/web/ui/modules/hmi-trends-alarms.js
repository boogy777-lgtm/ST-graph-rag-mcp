function resolveTrendIds(page) {
  const focusedSignal = state.routeSignal;
  if (focusedSignal) {
    const byPath = new Map((state.schema?.widgets || []).map((widget) => [widget.path, widget.id]));
    const focusedId = byPath.get(focusedSignal) || focusedSignal;
    return [focusedId];
  }
  if (!Array.isArray(page?.signals) || !page.signals.length) {
    return undefined;
  }
  const byPath = new Map((state.schema?.widgets || []).map((widget) => [widget.path, widget.id]));
  const ids = page.signals
    .map((signal) => {
      if (typeof signal !== 'string') {
        return undefined;
      }
      return byPath.get(signal) || signal;
    })
    .filter((value) => typeof value === 'string' && value.length > 0);
  return ids.length ? ids : undefined;
}

function trendSvg(points) {
  if (!Array.isArray(points) || !points.length) {
    return '<svg class="trend-svg" viewBox="0 0 300 92"></svg>';
  }
  const width = 300;
  const height = 92;
  const values = points.flatMap((point) => [Number(point.min), Number(point.max), Number(point.value)]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);
  const toY = (value) => {
    const normalized = (value - min) / span;
    return Math.round((height - 6) - normalized * (height - 14));
  };
  const toX = (index) => {
    if (points.length <= 1) {
      return 0;
    }
    return Math.round((index / (points.length - 1)) * width);
  };

  const avgPoints = points.map((point, idx) => ({
    x: toX(idx),
    y: toY(Number(point.value)),
  }));
  const avg = avgPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const upper = points
    .map((point, idx) => `${toX(idx)},${toY(Number(point.max))}`)
    .join(' ');
  const lower = [...points]
    .reverse()
    .map((point, idx) => {
      const x = toX(points.length - 1 - idx);
      return `${x},${toY(Number(point.min))}`;
    })
    .join(' ');
  const band = `${upper} ${lower}`;
  return `<svg class="trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><polygon class="trend-band" points="${band}"></polygon><polyline class="trend-line" points="${avg}"></polyline></svg>`;
}

function renderTrends(page, result) {
  const panel = byId('trendPanel');
  if (!panel) {
    return;
  }
  panel.classList.remove('hidden');
  panel.innerHTML = '';

  const title = document.createElement('h2');
  title.className = 'panel-head';
  title.textContent = page?.title || 'Trends';
  panel.appendChild(title);

  const presetWrap = document.createElement('div');
  presetWrap.className = 'trend-presets';
  for (const preset of [
    { label: '1m', ms: 60 * 1000 },
    { label: '10m', ms: 10 * 60 * 1000 },
    { label: '1h', ms: 60 * 60 * 1000 },
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'trend-preset';
    button.textContent = preset.label;
    const activeDuration = Number.isFinite(state.trendDurationMs) && state.trendDurationMs > 0
      ? state.trendDurationMs
      : (Number(page?.duration_ms) || 10 * 60 * 1000);
    if (activeDuration === preset.ms) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => {
      state.trendDurationMs = preset.ms;
      void refreshTrends(page);
    });
    presetWrap.appendChild(button);
  }
  panel.appendChild(presetWrap);

  const series = Array.isArray(result?.series) ? result.series : [];
  if (!series.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No numeric signals available for trend visualization.';
    panel.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'trend-grid';
  const focusedSignal = state.routeSignal;
  const focusedWidgetId = focusedSignal
    ? (state.schema?.widgets || []).find((widget) => widget.path === focusedSignal || widget.id === focusedSignal)?.id || focusedSignal
    : null;

  for (const entry of series) {
    const card = document.createElement('article');
    card.className = 'trend-card';
    if (focusedWidgetId && entry.id === focusedWidgetId) {
      card.classList.add('focused');
    }

    const heading = document.createElement('h3');
    heading.textContent = entry.label || entry.id;

    const meta = document.createElement('p');
    meta.className = 'trend-meta';
    const last = Array.isArray(entry.points) && entry.points.length
      ? Number(entry.points[entry.points.length - 1].value)
      : undefined;
    meta.textContent = `last: ${last === undefined ? '--' : formatValue(last)}${entry.unit ? ` ${entry.unit}` : ''}`;

    const svgHost = document.createElement('div');
    svgHost.innerHTML = trendSvg(Array.isArray(entry.points) ? entry.points : []);

    card.appendChild(heading);
    card.appendChild(meta);
    card.appendChild(svgHost);
    grid.appendChild(card);
  }

  panel.appendChild(grid);
}

async function refreshTrends(page) {
  const selectedDuration = Number.isFinite(state.trendDurationMs) && state.trendDurationMs > 0
    ? state.trendDurationMs
    : (Number(page?.duration_ms) || 10 * 60 * 1000);
  const params = {
    duration_ms: selectedDuration,
    buckets: 120,
  };
  const ids = resolveTrendIds(page);
  if (ids) {
    params.ids = ids;
  }
  try {
    const response = await apiControl('hmi.trends.get', params);
    if (!response.ok) {
      throw new Error(response.error || 'trends request failed');
    }
    const result = response.result || {};
    setConnection(result.connected ? 'connected' : 'stale');
    setFreshness(result.timestamp_ms || null);
    renderTrends(page, result);
  } catch (_error) {
    setConnection('disconnected');
    setFreshness(null);
    setEmptyMessage('Trend data unavailable.');
  }
}

