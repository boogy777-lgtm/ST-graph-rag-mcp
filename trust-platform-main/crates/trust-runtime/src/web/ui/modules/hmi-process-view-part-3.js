async function refreshProcessValues() {
  const processView = state.processView;
  if (!processView || !Array.isArray(processView.widgetIds) || !processView.widgetIds.length) {
    setConnection('stale');
    return;
  }
  try {
    const response = await apiControl('hmi.values.get', { ids: processView.widgetIds });
    if (!response.ok) {
      throw new Error(response.error || 'process values request failed');
    }
    const result = response.result || {};
    setConnection(result.connected ? 'connected' : 'stale');
    setFreshness(result.timestamp_ms || null);
    const values = result.values && typeof result.values === 'object' ? result.values : {};
    applyProcessValueEntries(values, result.timestamp_ms || null);
  } catch (_error) {
    setConnection('disconnected');
    setFreshness(null);
  }
}
