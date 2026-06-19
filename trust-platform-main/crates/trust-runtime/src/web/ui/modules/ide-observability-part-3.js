  if (!path) {
    return;
  }
  const payload = {
    type: "active-file",
    tab_id: state.tabId,
    path,
    ts: Date.now(),
  };
  try {
    if (state.presenceChannel) {
      state.presenceChannel.postMessage(payload);
    }
  } catch {
    // no-op
  }
  try {
    localStorage.setItem(IDE_PRESENCE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
}

function consumePresencePayload(payload) {
  if (!payload || payload.type !== "active-file") {
    return;
  }
  if (payload.tab_id === state.tabId) {
    return;
  }
  if (!payload.path || typeof payload.path !== "string") {
    return;
  }
  state.peerClaims.set(payload.path, {
    tabId: payload.tab_id,
    ts: Number(payload.ts || Date.now()),
  });
  refreshMultiTabCollision();
}

function refreshMultiTabCollision() {
  const now = Date.now();
  for (const [path, claim] of state.peerClaims.entries()) {
    if (!claim || now - claim.ts > IDE_PRESENCE_CLAIM_TTL_MS) {
      state.peerClaims.delete(path);
    }
  }
  const active = state.activePath;
  if (!active) {
    state.collisionPath = null;
    return;
  }
  const claim = state.peerClaims.get(active);
  if (claim) {
    state.collisionPath = active;
    updateSaveBadge("warn", "multi-tab");
    setStatus(`Multi-tab warning: ${active} is open in another browser tab.`);
    return;
  }
  state.collisionPath = null;
}

// Presence model stub
async function loadPresenceModel() {
  // UI badge removed in phase-2 polish; presence data not shown.
}

