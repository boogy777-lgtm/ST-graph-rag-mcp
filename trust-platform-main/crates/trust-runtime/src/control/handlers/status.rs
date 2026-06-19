use super::{ControlRequest, ControlResponse, ControlState};

pub(super) fn dispatch(request: &ControlRequest, state: &ControlState) -> Option<ControlResponse> {
    let response = match request.r#type.as_str() {
        "status" => super::super::status_handlers::handle_status(request.id, state),
        "health" => super::super::status_handlers::handle_health(request.id, state),
        "tasks.stats" => super::super::status_handlers::handle_task_stats(request.id, state),
        "events.tail" | "events" => super::super::status_handlers::handle_events_tail(
            request.id,
            request.params.clone(),
            state,
        ),
        "faults" => {
            super::super::status_handlers::handle_faults(request.id, request.params.clone(), state)
        }
        "config.get" => super::super::config_handlers::handle_config_get(request.id, state),
        "config.set" => super::super::config_handlers::handle_config_set(
            request.id,
            request.params.clone(),
            state,
        ),
        "historian.query" => super::super::status_handlers::handle_historian_query(
            request.id,
            request.params.clone(),
            state,
        ),
        "historian.alerts" => super::super::status_handlers::handle_historian_alerts(
            request.id,
            request.params.clone(),
            state,
        ),
        _ => return None,
    };
    Some(response)
}
