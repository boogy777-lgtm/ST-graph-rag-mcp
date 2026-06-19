use super::{ControlRequest, ControlResponse, ControlState};

pub(super) fn dispatch(request: &ControlRequest, state: &ControlState) -> Option<ControlResponse> {
    let response = match request.r#type.as_str() {
        "eval" => {
            super::super::variable_handlers::handle_eval(request.id, request.params.clone(), state)
        }
        "set" => {
            super::super::variable_handlers::handle_set(request.id, request.params.clone(), state)
        }
        "var.force" => super::super::variable_handlers::handle_var_force(
            request.id,
            request.params.clone(),
            state,
        ),
        "var.unforce" => super::super::variable_handlers::handle_var_unforce(
            request.id,
            request.params.clone(),
            state,
        ),
        "var.forced" => super::super::variable_handlers::handle_var_forced(request.id, state),
        _ => return None,
    };
    Some(response)
}
