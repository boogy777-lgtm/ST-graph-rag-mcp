use crate::security::AccessRole;

pub(super) fn is_debug_request(kind: &str) -> bool {
    matches!(
        kind,
        "pause"
            | "resume"
            | "step_in"
            | "step_over"
            | "step_out"
            | "breakpoints.set"
            | "breakpoints.clear"
            | "breakpoints.clear_all"
            | "breakpoints.clear_id"
            | "breakpoints.list"
            | "eval"
            | "set"
            | "var.force"
            | "var.unforce"
            | "var.forced"
            | "debug.state"
            | "debug.stops"
            | "debug.stack"
            | "debug.scopes"
            | "debug.variables"
            | "debug.evaluate"
            | "debug.breakpoint_locations"
    )
}

pub(crate) fn required_role_for_control_request(
    kind: &str,
    params: Option<&serde_json::Value>,
) -> AccessRole {
    match kind {
        "status"
        | "health"
        | "tasks.stats"
        | "events.tail"
        | "events"
        | "faults"
        | "config.get"
        | "io.list"
        | "io.read"
        | "hmi.schema.get"
        | "hmi.values.get"
        | "hmi.trends.get"
        | "hmi.alarms.get"
        | "hmi.descriptor.get"
        | "historian.query"
        | "historian.alerts"
        | "debug.state"
        | "debug.stops"
        | "debug.stack"
        | "debug.scopes"
        | "debug.variables"
        | "debug.breakpoint_locations"
        | "breakpoints.list"
        | "var.forced" => AccessRole::Viewer,
        "pause" | "resume" | "restart" | "hmi.alarm.ack" | "pair.claim" => AccessRole::Operator,
        "step_in"
        | "step_over"
        | "step_out"
        | "breakpoints.set"
        | "breakpoints.clear"
        | "breakpoints.clear_all"
        | "breakpoints.clear_id"
        | "eval"
        | "set"
        | "var.force"
        | "var.unforce"
        | "io.write"
        | "io.force"
        | "io.unforce"
        | "debug.evaluate"
        | "hmi.write"
        | "hmi.descriptor.update"
        | "hmi.scaffold.reset" => AccessRole::Engineer,
        "config.set" => required_role_for_config_set(params),
        "shutdown" | "bytecode.reload" | "pair.start" | "pair.list" | "pair.revoke" => {
            AccessRole::Admin
        }
        _ => AccessRole::Viewer,
    }
}

fn required_role_for_config_set(params: Option<&serde_json::Value>) -> AccessRole {
    let Some(params) = params.and_then(serde_json::Value::as_object) else {
        return AccessRole::Engineer;
    };
    let requires_admin = params.keys().any(|key| {
        matches!(
            key.as_str(),
            "control.auth_token"
                | "mesh.auth_token"
                | "mesh.role"
                | "mesh.zenohd_version"
                | "mesh.plugin_versions"
                | "control.mode"
                | "web.auth"
                | "runtime_cloud.profile"
                | "runtime_cloud.wan.allow_write"
                | "runtime_cloud.links.transports"
        )
    });
    if requires_admin {
        AccessRole::Admin
    } else {
        AccessRole::Engineer
    }
}
