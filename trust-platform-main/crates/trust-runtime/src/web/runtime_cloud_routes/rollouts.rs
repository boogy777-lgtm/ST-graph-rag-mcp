use super::*;

pub(super) fn handle_get_rollouts(request: tiny_http::Request, ctx: &RuntimeCloudRouteContext<'_>) {
    let (_web_role, _request_token) = match check_auth_with_role(
        &request,
        ctx.auth_mode,
        ctx.auth_token,
        ctx.pairing,
        AccessRole::Viewer,
    ) {
        Ok(value) => value,
        Err(error) => {
            let _ = request.respond(auth_error_response(error));
            return;
        }
    };
    runtime_cloud_config_reconcile_once(
        ctx.config_state.as_ref(),
        ctx.control_state.as_ref(),
        ctx.config_path,
    );
    runtime_cloud_rollouts_reconcile_once(
        ctx.rollouts_state.as_ref(),
        ctx.config_state.as_ref(),
        ctx.rollouts_path,
    );
    let items = runtime_cloud_rollouts_snapshot(ctx.rollouts_state.as_ref());
    let response = Response::from_string(
        json!({
            "api_version": RUNTIME_CLOUD_API_VERSION,
            "items": items,
        })
        .to_string(),
    )
    .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
    let _ = request.respond(response);
}

pub(super) fn handle_post_rollouts(
    mut request: tiny_http::Request,
    ctx: &RuntimeCloudRouteContext<'_>,
) {
    let (_web_role, _request_token) = match check_auth_with_role(
        &request,
        ctx.auth_mode,
        ctx.auth_token,
        ctx.pairing,
        AccessRole::Engineer,
    ) {
        Ok(value) => value,
        Err(error) => {
            let _ = request.respond(auth_error_response(error));
            return;
        }
    };
    if let Err(response) = api_post_policy_check(&request, ctx.web_tls_enabled, true) {
        let _ = request.respond(response);
        return;
    }
    let payload: RuntimeCloudRolloutCreateRequest =
        match read_json_body(&mut request, MAX_JSON_REQUEST_BYTES) {
            Ok(value) => value,
            Err(error) => {
                let _ = request.respond(json_body_error_response(error));
                return;
            }
        };
    runtime_cloud_config_reconcile_once(
        ctx.config_state.as_ref(),
        ctx.control_state.as_ref(),
        ctx.config_path,
    );
    match runtime_cloud_rollout_create(
        ctx.rollouts_state.as_ref(),
        ctx.config_state.as_ref(),
        &payload,
        ctx.rollouts_path,
    ) {
        Ok(rollout) => {
            let response = Response::from_string(
                json!({
                    "ok": true,
                    "rollout": rollout,
                })
                .to_string(),
            )
            .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
            let _ = request.respond(response);
        }
        Err((code, message)) => {
            let status = if code == ReasonCode::RevisionConflict {
                StatusCode(409)
            } else {
                StatusCode(400)
            };
            let response = Response::from_string(
                json!({
                    "ok": false,
                    "denial_code": code,
                    "error": message,
                })
                .to_string(),
            )
            .with_status_code(status)
            .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
            let _ = request.respond(response);
        }
    }
}

pub(super) fn handle_post_rollout_action(
    request: tiny_http::Request,
    url: &str,
    ctx: &RuntimeCloudRouteContext<'_>,
) {
    let (_web_role, _request_token) = match check_auth_with_role(
        &request,
        ctx.auth_mode,
        ctx.auth_token,
        ctx.pairing,
        AccessRole::Engineer,
    ) {
        Ok(value) => value,
        Err(error) => {
            let _ = request.respond(auth_error_response(error));
            return;
        }
    };
    if let Err(response) = api_post_policy_check(&request, ctx.web_tls_enabled, false) {
        let _ = request.respond(response);
        return;
    }
    let Some((rollout_id, action)) = parse_runtime_cloud_rollout_action(url) else {
        let response = Response::from_string(
            json!({
                "ok": false,
                "denial_code": "contract_violation",
                "error": "invalid rollout action path"
            })
            .to_string(),
        )
        .with_status_code(StatusCode(404))
        .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
        let _ = request.respond(response);
        return;
    };
    let action_response = runtime_cloud_rollout_apply_action(
        ctx.rollouts_state.as_ref(),
        rollout_id.as_str(),
        action.as_str(),
        ctx.rollouts_path,
    );
    let status_code = if action_response.ok {
        StatusCode(200)
    } else {
        match action_response.denial_code {
            Some(ReasonCode::Conflict) => StatusCode(409),
            Some(ReasonCode::ContractViolation) => StatusCode(400),
            Some(ReasonCode::TransportFailure) => StatusCode(503),
            Some(ReasonCode::PeerNotAvailable) => StatusCode(404),
            _ => StatusCode(400),
        }
    };
    let response = Response::from_string(
        serde_json::to_string(&action_response).unwrap_or_else(|_| "{}".to_string()),
    )
    .with_status_code(status_code)
    .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
    let _ = request.respond(response);
}
