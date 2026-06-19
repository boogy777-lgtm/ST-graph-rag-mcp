  element.classList.add('value-updated');
}

function applyTheme(theme) {
  if (!theme || typeof theme !== 'object') {
    return;
  }
  const root = document.documentElement;
  const controlRoom = isControlRoomTheme(theme);
  if (controlRoom) {
    setThemeVariables(root, CONTROL_ROOM_THEME);
    root.style.colorScheme = 'dark';
  } else {
    removeThemeVariables(root, Object.keys(CONTROL_ROOM_THEME));
    root.style.colorScheme = 'light';
    root.style.setProperty('--mix-base', '#ffffff');
    if (typeof theme.background === 'string') {
      root.style.setProperty('--bg', theme.background);
    }
    if (typeof theme.surface === 'string') {
      root.style.setProperty('--surface', theme.surface);
    }
    if (typeof theme.text === 'string') {
      root.style.setProperty('--text', theme.text);
    }
    if (typeof theme.accent === 'string') {
      root.style.setProperty('--accent', theme.accent);
    }
  }
  document.body.classList.toggle('theme-dark', controlRoom);
  document.body.dataset.theme = controlRoom ? 'dark' : 'light';
  if (typeof theme.style === 'string') {
    const label = byId('themeLabel');
    if (label) {
      label.textContent = controlRoom ? 'Dark mode' : 'Light mode';
    }
  }
}

function parsePresentationOverride() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get('mode');
  if (!value) {
    return undefined;
  }
  const lower = value.trim().toLowerCase();
  if (lower === 'engineering' || lower === 'operator') {
    return lower;
  }
  return undefined;
}

function readStoredPresentationMode() {
  try {
    const value = window.localStorage.getItem(HMI_MODE_STORAGE_KEY);
    if (!value) {
      return undefined;
    }
    const lower = value.trim().toLowerCase();
    if (lower === 'engineering' || lower === 'operator') {
      return lower;
    }
  } catch (_error) {
    return undefined;
  }
  return undefined;
}

function persistPresentationMode(mode) {
  try {
    window.localStorage.setItem(HMI_MODE_STORAGE_KEY, mode);
  } catch (_error) {
    // ignore local storage failures
  }
}

function applyPresentationMode(mode) {
  state.presentationMode = mode === 'engineering' ? 'engineering' : 'operator';
  document.body.classList.remove('operator-mode', 'engineering-mode');
  document.body.classList.add(`${state.presentationMode}-mode`);
  if (state.presentationMode !== 'engineering') {
    state.layoutEditMode = false;
    document.body.classList.remove('layout-edit-mode');
  }
  const toggle = byId('modeToggle');
  if (toggle) {
    toggle.textContent = state.presentationMode === 'engineering' ? 'Operator Mode' : 'Engineering Mode';
  }
  const layoutToggle = byId('layoutToggle');
  if (layoutToggle) {
    if (state.presentationMode === 'engineering') {
      layoutToggle.classList.remove('hidden');
      layoutToggle.textContent = state.layoutEditMode ? 'Done Editing' : 'Edit Layout';
    } else {
      layoutToggle.classList.add('hidden');
    }
  }
  const addSignalButton = byId('addSignalButton');
  if (addSignalButton) {
    if (state.presentationMode === 'engineering' && state.layoutEditMode) {
      addSignalButton.classList.remove('hidden');
    } else {
      addSignalButton.classList.add('hidden');
    }
  }
  const resetLayoutButton = byId('resetLayoutButton');
  if (resetLayoutButton) {
    if (state.presentationMode === 'engineering') {
      resetLayoutButton.classList.remove('hidden');
    } else {
      resetLayoutButton.classList.add('hidden');
    }
  }
  const backButton = byId('backButton');
  if (backButton) {
    const historyLength = Number(window.history && window.history.length);
    backButton.classList.toggle('hidden', !Number.isFinite(historyLength) || historyLength <= 1);
  }
  updateDiagnosticsPill();
}

function togglePresentationMode() {
  const next = state.presentationMode === 'engineering' ? 'operator' : 'engineering';
  persistPresentationMode(next);
  applyPresentationMode(next);
  renderCurrentPage();
}

function cycleTheme() {
  const currentStyle = state.schema?.theme?.style || 'dark';
  const currentLower = currentStyle.trim().toLowerCase();
  const idx = THEME_CYCLE.indexOf(currentLower);
  const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
  if (state.schema) {
    if (!state.schema.theme) { state.schema.theme = {}; }
    state.schema.theme.style = next;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch (_err) { /* ignore */ }
  applyTheme({ style: next, accent: '', background: '', surface: '', text: '' });
  void apiControl('hmi.descriptor.update', {
    theme: { style: next },
  });
}

function toggleLayoutMode() {
  if (state.presentationMode !== 'engineering') {
    return;
  }
  state.layoutEditMode = !state.layoutEditMode;
  document.body.classList.toggle('layout-edit-mode', state.layoutEditMode);
  applyPresentationMode(state.presentationMode);
}

function parseResponsiveOverride() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(ROUTE_VIEWPORT_PARAM);
  if (!value) {
    return undefined;
  }
  const lower = value.trim().toLowerCase();
  if (lower === 'auto' || lower === 'mobile' || lower === 'tablet' || lower === 'kiosk') {
    return lower;
  }
  return undefined;
}

function viewportForWidth(width, mobileMax, tabletMax) {
  if (width <= mobileMax) {
    return 'mobile';
  }
  if (width <= tabletMax) {
    return 'tablet';
  }
  return 'desktop';
}

function applyResponsiveLayout() {
  const responsive = state.schema?.responsive ?? {};
  const configured = (typeof responsive.mode === 'string' ? responsive.mode.toLowerCase() : 'auto');
  const override = parseResponsiveOverride();
  const mode = override || configured;
  state.responsiveMode = mode;

  document.body.classList.remove('viewport-mobile', 'viewport-tablet', 'viewport-kiosk');
  if (mode === 'kiosk') {
    document.body.classList.add('viewport-kiosk');
    return;
  }
  const mobileMax = Number(responsive.mobile_max_px) || 680;
  const tabletMax = Number(responsive.tablet_max_px) || 1024;
  const resolved = mode === 'auto' ? viewportForWidth(window.innerWidth, mobileMax, tabletMax) : mode;
  if (resolved === 'mobile') {
    document.body.classList.add('viewport-mobile');
  } else if (resolved === 'tablet') {
    document.body.classList.add('viewport-tablet');
  }
}

function initModeControls() {
  const fromQuery = parsePresentationOverride();
  const fromStorage = readStoredPresentationMode();
  const mode = fromQuery || fromStorage || 'operator';
  if (fromQuery) {
    persistPresentationMode(fromQuery);
  }
  applyPresentationMode(mode);

  const modeToggle = byId('modeToggle');
  if (modeToggle) {
    modeToggle.addEventListener('click', () => {
      togglePresentationMode();
    });
  }
  const layoutToggle = byId('layoutToggle');
  if (layoutToggle) {
    layoutToggle.addEventListener('click', () => {
      toggleLayoutMode();
      renderCurrentPage();
    });
  }
  const addSignalButton = byId('addSignalButton');
  if (addSignalButton) {
    addSignalButton.addEventListener('click', () => {
      void addUnplacedSignalToCurrentPage();
    });
  }
  const resetLayoutButton = byId('resetLayoutButton');
  if (resetLayoutButton) {
    resetLayoutButton.addEventListener('click', () => {
      void resetDescriptorToScaffoldDefaults();
    });
  }
  const backButton = byId('backButton');
  if (backButton) {
    backButton.addEventListener('click', () => {
      if (window.history && typeof window.history.back === 'function') {
        window.history.back();
      }
