pub fn build_alarm_view(state: &HmiLiveState, history_limit: usize) -> HmiAlarmResult {
    let mut active = state
        .alarms
        .values()
        .filter(|alarm| alarm.active)
        .map(to_alarm_record)
        .collect::<Vec<_>>();
    active.sort_by(|left, right| {
        left.acknowledged
            .cmp(&right.acknowledged)
            .then_with(|| right.last_change_ms.cmp(&left.last_change_ms))
            .then_with(|| left.id.cmp(&right.id))
    });

    let history_limit = history_limit.clamp(1, ALARM_HISTORY_LIMIT);
    let history = state
        .history
        .iter()
        .rev()
        .take(history_limit)
        .cloned()
        .collect::<Vec<_>>();

    HmiAlarmResult {
        connected: state.last_connected,
        timestamp_ms: if state.last_timestamp_ms > 0 {
            state.last_timestamp_ms
        } else {
            now_unix_ms()
        },
        active,
        history,
    }
}

pub fn acknowledge_alarm(
    state: &mut HmiLiveState,
    alarm_id: &str,
    timestamp_ms: u128,
) -> Result<(), String> {
    let (id, widget_id, path, label, value) = {
        let alarm = state
            .alarms
            .get_mut(alarm_id)
            .ok_or_else(|| format!("unknown alarm '{alarm_id}'"))?;
        if !alarm.active {
            return Err("alarm is not active".to_string());
        }
        if alarm.acknowledged {
            return Ok(());
        }
        alarm.acknowledged = true;
        alarm.last_change_ms = timestamp_ms;
        (
            alarm.id.clone(),
            alarm.widget_id.clone(),
            alarm.path.clone(),
            alarm.label.clone(),
            alarm.value,
        )
    };
    push_alarm_history(
        state,
        HmiAlarmHistoryRecord {
            id,
            widget_id,
            path,
            label,
            event: "acknowledged",
            timestamp_ms,
            value,
        },
    );
    Ok(())
}
