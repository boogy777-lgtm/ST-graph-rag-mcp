// Contract markers for integration tests:
// hmi.schema.get
// hmi.values.get
// hmi.trends.get
// hmi.alarms.get
// hmi.alarm.ack
// connectWebSocketTransport
// /ws/hmi
// hmi.values.delta
// hmi.schema.revision
// renderProcessPage
// function renderProcessPage
// /hmi/assets/
// section-grid
// section-widget-grid
// createGaugeRenderer
// createSparklineRenderer
// kind === 'sparkline'
// createBarRenderer
// createTankRenderer
// createIndicatorRenderer
// createToggleRenderer
// createSliderRenderer
const POLL_MS = 500;
const WS_ROUTE = '/ws/hmi';
const WS_MAX_FAILURES_BEFORE_POLL = 3;
const WS_RECONNECT_BASE_MS = 500;
const WS_RECONNECT_MAX_MS = 5000;
const HMI_MODE_STORAGE_KEY = 'trust.hmi.mode';
const ROUTE_PAGE_PARAM = 'page';
const ROUTE_SIGNAL_PARAM = 'signal';
const ROUTE_FOCUS_PARAM = 'focus';
const ROUTE_TARGET_PARAM = 'target';
const ROUTE_VIEWPORT_PARAM = 'viewport';

const state = {
  schema: null,
  descriptor: null,
  cards: new Map(),
  moduleCards: new Map(),
  sparklines: new Map(),
  latestValues: new Map(),
  pollHandle: null,
  ws: null,
  wsConnected: false,
  wsFailures: 0,
  wsReconnectHandle: null,
  schemaRevision: 0,
  schemaRefreshInFlight: false,
  lastAlarmResult: null,
  processView: null,
  processSvgCache: new Map(),
  processRenderSeq: 0,
  descriptorError: null,
  currentPage: null,
  routeSignal: null,
  routeFocus: null,
  routeTarget: null,
  trendDurationMs: null,
  processBindingMisses: 0,
  presentationMode: 'operator',
  layoutEditMode: false,
  responsiveMode: 'auto',
  ackInFlight: new Set(),
};

/* Dark mode — matches runtime styles.css body[data-theme="dark"] */
const CONTROL_ROOM_THEME = Object.freeze({
  '--bg': '#0f1115',
  '--bg-2': '#141821',
  '--bg-3': '#11151d',
  '--surface': '#171a21',
  '--surface-soft': '#1f2430',
  '--text': '#f2f2f2',
  '--muted': '#9ca3af',
  '--muted-strong': '#cbd5f5',
  '--border': 'rgba(255, 255, 255, 0.08)',
  '--accent': '#14b8a6',
  '--accent-strong': '#0d9488',
  '--accent-soft': 'rgba(20, 184, 166, 0.18)',
  '--ok': '#14b8a6',
  '--warn': '#f97316',
  '--bad': '#f87171',
  '--danger': '#f87171',
  '--mix-base': '#0f1115',
  '--shadow-sm': '0 1px 3px rgba(0,0,0,0.3)',
  '--shadow-md': '0 4px 12px rgba(0,0,0,0.4)',
  '--shadow-lg': '0 18px 40px rgba(0,0,0,0.45)',
});

const THEME_CYCLE = ['dark', 'light'];
const THEME_STORAGE_KEY = 'trust.hmi.theme';

function byId(id) {
  return document.getElementById(id);
}

function parseRouteState() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get(ROUTE_PAGE_PARAM);
  const signal = params.get(ROUTE_SIGNAL_PARAM);
  const focus = params.get(ROUTE_FOCUS_PARAM);
  const target = params.get(ROUTE_TARGET_PARAM);
  return {
    page: page && page.trim() ? page.trim() : null,
    signal: signal && signal.trim() ? signal.trim() : null,
    focus: focus && focus.trim() ? focus.trim() : null,
    target: target && target.trim() ? target.trim() : null,
  };
}

function syncStateFromRoute() {
  const route = parseRouteState();
  state.routeSignal = route.signal;
  state.routeFocus = route.focus;
  state.routeTarget = route.target;
  if (route.page) {
    state.currentPage = route.page;
  }
}

function applyRoute(next, replace = false) {
  const params = new URLSearchParams(window.location.search);
  const setParam = (key, value) => {
    if (value === null || value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  };
  setParam(ROUTE_PAGE_PARAM, next.page ?? state.currentPage);
  setParam(ROUTE_SIGNAL_PARAM, next.signal);
  setParam(ROUTE_FOCUS_PARAM, next.focus);
  setParam(ROUTE_TARGET_PARAM, next.target);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
  const historyApi = window.history;
  if (historyApi && typeof historyApi.replaceState === 'function' && typeof historyApi.pushState === 'function') {
    if (replace) {
      historyApi.replaceState({}, '', url);
    } else {
      historyApi.pushState({}, '', url);
    }
  }
  syncStateFromRoute();
}

function setConnection(status) {
  const pill = byId('connectionState');
  if (!pill) {
    return;
  }
  pill.classList.remove('connected', 'stale', 'disconnected');
  if (status === 'connected') {
    pill.classList.add('connected');
    pill.textContent = 'Connected';
  } else if (status === 'stale') {
    pill.classList.add('stale');
    pill.textContent = 'Stale';
  } else {
    pill.classList.add('disconnected');
    pill.textContent = 'Disconnected';
  }
}

function setFreshness(timestampMs) {
  const freshness = byId('freshnessState');
  if (!freshness) {
    return;
  }
  if (!timestampMs) {
    freshness.textContent = 'freshness: n/a';
    return;
  }
  const age = Math.max(0, Date.now() - Number(timestampMs));
  freshness.textContent = `freshness: ${age} ms`;
}

function updateDiagnosticsPill() {
  const pill = byId('diagnosticState');
  if (!pill) {
    return;
  }
  const descriptorError = typeof state.descriptorError === 'string' && state.descriptorError.trim()
    ? state.descriptorError.trim()
    : null;
  if (state.presentationMode !== 'engineering' && !descriptorError) {
    pill.classList.add('hidden');
    pill.title = '';
    return;
  }
  let stale = 0;
  let bad = 0;
  for (const refs of state.cards.values()) {
    const quality = refs?.card?.dataset?.quality;
    if (quality === 'stale') {
      stale += 1;
    } else if (quality === 'bad') {
      bad += 1;
    }
  }
  const missing = Number(state.processBindingMisses) || 0;
  pill.classList.remove('hidden');
  if (state.presentationMode === 'engineering') {
    pill.textContent = descriptorError
      ? `diag: stale ${stale} · bad ${bad} · bind-miss ${missing} · descriptor error`
      : `diag: stale ${stale} · bad ${bad} · bind-miss ${missing}`;
  } else {
    pill.textContent = 'descriptor error';
  }
  pill.title = descriptorError || '';
}

function setEmptyMessage(text) {
  const empty = byId('emptyState');
  if (!empty) {
    return;
  }
  empty.classList.remove('hidden');
  empty.textContent = text;
}

function hideEmptyMessage() {
  const empty = byId('emptyState');
  if (empty) {
    empty.classList.add('hidden');
  }
}

function setThemeVariables(root, values) {
  if (!root || !root.style || typeof root.style.setProperty !== 'function') {
    return;
  }
  for (const [key, value] of Object.entries(values)) {
    root.style.setProperty(key, value);
  }
}

function removeThemeVariables(root, keys) {
  if (!root || !root.style || typeof root.style.removeProperty !== 'function') {
    return;
  }
  for (const key of keys) {
    root.style.removeProperty(key);
  }
}

function isControlRoomTheme(theme) {
  if (!theme || typeof theme !== 'object') {
    return false;
  }
  const style = typeof theme.style === 'string' ? theme.style.trim().toLowerCase() : '';
  return style === 'control-room' || style === 'dark';
}

function flashValueUpdate(element) {
  if (!element || !element.classList) {
    return;
  }
  element.classList.remove('value-updated');
  if (typeof element.offsetWidth === 'number') {
    void element.offsetWidth;
  }
