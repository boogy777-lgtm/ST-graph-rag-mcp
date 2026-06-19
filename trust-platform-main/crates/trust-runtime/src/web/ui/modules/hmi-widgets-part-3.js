function applyValues(payload) {
  if (!payload || typeof payload !== 'object') {
    setConnection('disconnected');
    setFreshness(null);
    return;
  }

  const connected = payload.connected === true;
  setConnection(connected ? 'connected' : 'stale');
  setFreshness(payload.timestamp_ms);

  const values = payload.values && typeof payload.values === 'object' ? payload.values : {};
  state.latestValues.clear();
  for (const [id, entry] of Object.entries(values)) {
    state.latestValues.set(id, entry);
  }
  for (const [id, refs] of state.cards.entries()) {
    const entry = values[id];
    applyCardEntry(refs, entry);
  }
  for (const [id, refs] of state.moduleCards.entries()) {
    const entry = values[id];
    applyCardEntry(refs, entry);
  }
  updateDiagnosticsPill();
}

async function refreshValues() {
  const ids = Array.from(new Set([...state.cards.keys(), ...state.moduleCards.keys()]));
  const extraIds = [];
  for (const refs of state.cards.values()) {
    const peerId = setpointPeerWidgetId(refs.widget);
    if (peerId && !ids.includes(peerId) && !extraIds.includes(peerId)) {
      extraIds.push(peerId);
    }
  }
  const requestIds = ids.concat(extraIds);
  if (!requestIds.length) {
    setConnection('stale');
    setFreshness(null);
    return;
  }
  try {
    const response = await apiControl('hmi.values.get', { ids: requestIds });
    if (!response.ok) {
      throw new Error(response.error || 'values request failed');
    }
    applyValues(response.result);
  } catch (_error) {
    setConnection('disconnected');
    setFreshness(null);
  }
}

