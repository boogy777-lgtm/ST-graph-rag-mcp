pub fn update_live_state(
    state: &mut HmiLiveState,
    schema: &HmiSchemaResult,
    values: &HmiValuesResult,
) {
    state.last_connected = values.connected;
    state.last_timestamp_ms = values.timestamp_ms;
    let widgets = schema
        .widgets
        .iter()
        .map(|widget| (widget.id.as_str(), widget))
        .collect::<HashMap<_, _>>();

    for (id, value) in &values.values {
        let Some(widget) = widgets.get(id.as_str()) else {
            continue;
        };
        if value.q != "good" {
            continue;
        }
        let Some(numeric) = numeric_value_from_json(&value.v) else {
            continue;
        };
        if is_trend_capable_widget_schema(widget) {
            let samples = state.trend_samples.entry(id.clone()).or_default();
            samples.push_back(HmiTrendSample {
                ts_ms: value.ts_ms,
                value: numeric,
            });
            while samples.len() > TREND_HISTORY_LIMIT {
                let _ = samples.pop_front();
            }
        }
        if widget.min.is_some() || widget.max.is_some() {
            update_alarm_state(state, widget, numeric, value.ts_ms);
        }
    }
}

pub fn build_trends(
    state: &HmiLiveState,
    schema: &HmiSchemaResult,
    ids: Option<&[String]>,
    duration_ms: u64,
    buckets: usize,
) -> HmiTrendResult {
    let now_ms = if state.last_timestamp_ms > 0 {
        state.last_timestamp_ms
    } else {
        now_unix_ms()
    };
    let duration_ms = duration_ms.max(5_000);
    let buckets = buckets.clamp(8, 480);
    let cutoff = now_ms.saturating_sub(u128::from(duration_ms));
    let allowed_ids = ids
        .filter(|entries| !entries.is_empty())
        .map(|entries| entries.iter().map(String::as_str).collect::<HashSet<_>>());

    let series = schema
        .widgets
        .iter()
        .filter(|widget| is_trend_capable_widget_schema(widget))
        .filter(|widget| {
            allowed_ids
                .as_ref()
                .is_none_or(|entries| entries.contains(widget.id.as_str()))
        })
        .filter_map(|widget| {
            let samples = state.trend_samples.get(widget.id.as_str())?;
            let scoped = samples
                .iter()
                .filter(|sample| sample.ts_ms >= cutoff)
                .cloned()
                .collect::<Vec<_>>();
            let points = downsample_trend_samples(&scoped, buckets);
            if points.is_empty() {
                return None;
            }
            Some(HmiTrendSeries {
                id: widget.id.clone(),
                label: widget.label.clone(),
                unit: widget.unit.clone(),
                points,
            })
        })
        .collect::<Vec<_>>();

    HmiTrendResult {
        connected: state.last_connected,
        timestamp_ms: now_ms,
        duration_ms,
        buckets,
        series,
    }
}
