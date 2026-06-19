use super::{ControlRequest, ControlResponse, ControlState};

pub(super) fn dispatch(request: &ControlRequest, state: &ControlState) -> Option<ControlResponse> {
    let response = match request.r#type.as_str() {
        "io.list" => super::super::io_handlers::handle_io_list(request.id, state),
        "hmi.schema.get" => super::super::hmi_handlers::handle_hmi_schema_get(request.id, state),
        "hmi.values.get" => super::super::hmi_handlers::handle_hmi_values_get(
            request.id,
            request.params.clone(),
            state,
        ),
        "hmi.trends.get" => super::super::hmi_handlers::handle_hmi_trends_get(
            request.id,
            request.params.clone(),
            state,
        ),
        "hmi.alarms.get" => super::super::hmi_handlers::handle_hmi_alarms_get(
            request.id,
            request.params.clone(),
            state,
        ),
        "hmi.descriptor.get" => {
            super::super::hmi_handlers::handle_hmi_descriptor_get(request.id, state)
        }
        "hmi.descriptor.update" => super::super::hmi_handlers::handle_hmi_descriptor_update(
            request.id,
            request.params.clone(),
            state,
        ),
        "hmi.scaffold.reset" => super::super::hmi_handlers::handle_hmi_scaffold_reset(
            request.id,
            request.params.clone(),
            state,
        ),
        "hmi.alarm.ack" => super::super::hmi_handlers::handle_hmi_alarm_ack(
            request.id,
            request.params.clone(),
            state,
        ),
        "hmi.write" => {
            super::super::hmi_handlers::handle_hmi_write(request.id, request.params.clone(), state)
        }
        "io.read" => super::super::io_handlers::handle_io_read(request.id, state),
        "io.write" => {
            super::super::io_handlers::handle_io_write(request.id, request.params.clone(), state)
        }
        "io.force" => {
            super::super::io_handlers::handle_io_force(request.id, request.params.clone(), state)
        }
        "io.unforce" => {
            super::super::io_handlers::handle_io_unforce(request.id, request.params.clone(), state)
        }
        _ => return None,
    };
    Some(response)
}
