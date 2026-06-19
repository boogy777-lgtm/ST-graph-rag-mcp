use crate::security::{constant_time_eq, AccessRole};

use super::{ControlRequest, ControlState};

pub(super) fn resolve_request_role(
    request: &ControlRequest,
    state: &ControlState,
    client: Option<&str>,
) -> Result<AccessRole, &'static str> {
    let provided = request.auth.as_deref();
    let expected = state.auth_token.lock().ok().and_then(|guard| guard.clone());
    if let Some(expected) = expected {
        if let Some(provided) = provided {
            if constant_time_eq(expected.as_str(), provided) {
                return Ok(AccessRole::Admin);
            }
        }
        if let Some(token) = provided {
            if let Some(store) = state.pairing.as_ref() {
                if let Some(role) = store.validate_with_role(token) {
                    return Ok(role);
                }
            }
        }
        return Err("unauthorized");
    }
    if let Some(token) = provided {
        if let Some(store) = state.pairing.as_ref() {
            if let Some(role) = store.validate_with_role(token) {
                return Ok(role);
            }
        }
    }
    if state.control_requires_auth {
        return Err("unauthorized");
    }
    if control_client_is_untrusted_transport(client) {
        return Ok(AccessRole::Viewer);
    }
    Ok(AccessRole::Admin)
}

fn control_client_is_untrusted_transport(client: Option<&str>) -> bool {
    let Some(client) = client else {
        return false;
    };
    if client == "unix" {
        return true;
    }
    client.contains(':')
}
