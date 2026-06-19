use super::*;

pub(super) fn handle_analysis_route(
    mut request: tiny_http::Request,
    method: &Method,
    url: &str,
    ctx: &IdeRouteContext<'_>,
) -> IdeRouteOutcome {
    let ide_state = ctx.ide_state;

    if *method == Method::Get && url == "/api/ide/health" {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        match ide_state.health(session_token.as_str()) {
            Ok(health) => {
                let response =
                    Response::from_string(json!({ "ok": true, "result": health }).to_string())
                        .with_header(
                            Header::from_bytes("Content-Type", "application/json").unwrap(),
                        );
                let _ = request.respond(response);
            }
            Err(error) => {
                let _ = request.respond(ide_error_response(error));
            }
        }
        return IdeRouteOutcome::Handled;
    }
    if *method == Method::Post && url == "/api/ide/frontend-telemetry" {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        let mut body = String::new();
        if request.as_reader().read_to_string(&mut body).is_err() {
            let response =
                Response::from_string(json!({ "ok": false, "error": "invalid body" }).to_string())
                    .with_status_code(StatusCode(400));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        }
        let payload: IdeFrontendTelemetryRequest = match serde_json::from_str(&body) {
            Ok(value) => value,
            Err(_) => {
                let response = Response::from_string(
                    json!({ "ok": false, "error": "invalid json" }).to_string(),
                )
                .with_status_code(StatusCode(400));
                let _ = request.respond(response);
                return IdeRouteOutcome::Handled;
            }
        };
        let telemetry = WebIdeFrontendTelemetry {
            bootstrap_failures: payload.bootstrap_failures.unwrap_or(0),
            analysis_timeouts: payload.analysis_timeouts.unwrap_or(0),
            worker_restarts: payload.worker_restarts.unwrap_or(0),
            autosave_failures: payload.autosave_failures.unwrap_or(0),
        };
        match ide_state.record_frontend_telemetry(session_token.as_str(), telemetry) {
            Ok(aggregated) => {
                let response =
                    Response::from_string(json!({ "ok": true, "result": aggregated }).to_string())
                        .with_header(
                            Header::from_bytes("Content-Type", "application/json").unwrap(),
                        );
                let _ = request.respond(response);
            }
            Err(error) => {
                let _ = request.respond(ide_error_response(error));
            }
        }
        return IdeRouteOutcome::Handled;
    }
    if *method == Method::Get && url == "/api/ide/presence-model" {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        if let Err(error) = ide_state.health(session_token.as_str()) {
            let _ = request.respond(ide_error_response(error));
            return IdeRouteOutcome::Handled;
        }
        let response = Response::from_string(
            json!({
                "ok": true,
                "result": {
                    "mode": "out_of_scope_phase_1",
                    "summary": "Live collaborative cursor/presence is intentionally deferred for first production release.",
                    "tracking": "See docs/guides/WEB_IDE_COLLABORATION_MODEL.md",
                }
            })
            .to_string(),
        )
        .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
        let _ = request.respond(response);
        return IdeRouteOutcome::Handled;
    }

    super::analysis_language::handle_language_route(request, method, url, ctx)
}
