use super::*;

pub(super) fn handle_task_route(
    request: tiny_http::Request,
    method: &Method,
    url: &str,
    ctx: &IdeRouteContext<'_>,
) -> IdeRouteOutcome {
    let ide_state = ctx.ide_state;
    let ide_task_store = ctx.ide_task_store;
    let ide_task_seq = ctx.ide_task_seq;

    if *method == Method::Post
        && (url == "/api/ide/build" || url == "/api/ide/test" || url == "/api/ide/validate")
    {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        if let Err(error) = ide_state.require_editor_session(session_token.as_str()) {
            let _ = request.respond(ide_error_response(error));
            return IdeRouteOutcome::Handled;
        }
        let kind = if url.ends_with("/build") {
            "build"
        } else if url.ends_with("/test") {
            "test"
        } else {
            "validate"
        };
        let Some(project_root) = ide_state.active_project_root() else {
            let response = Response::from_string(
                json!({
                    "ok": false,
                    "error": "no active project selected; open a folder in the IDE first"
                })
                .to_string(),
            )
            .with_status_code(StatusCode(400))
            .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        let snapshot = start_ide_task_job(
            kind,
            project_root,
            ide_task_store.clone(),
            ide_task_seq.clone(),
        );
        let response = Response::from_string(json!({ "ok": true, "result": snapshot }).to_string())
            .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
        let _ = request.respond(response);
        return IdeRouteOutcome::Handled;
    }
    if *method == Method::Get && url.starts_with("/api/ide/task") {
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
        let Some(id_text) = query_value(url, "id") else {
            let response =
                Response::from_string(json!({ "ok": false, "error": "missing id" }).to_string())
                    .with_status_code(StatusCode(400))
                    .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        let Ok(job_id) = id_text.parse::<u64>() else {
            let response =
                Response::from_string(json!({ "ok": false, "error": "invalid id" }).to_string())
                    .with_status_code(StatusCode(400))
                    .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        let snapshot = ide_task_snapshot(ide_task_store.clone(), job_id);
        match snapshot {
            Some(task) => {
                let response =
                    Response::from_string(json!({ "ok": true, "result": task }).to_string())
                        .with_header(
                            Header::from_bytes("Content-Type", "application/json").unwrap(),
                        );
                let _ = request.respond(response);
            }
            None => {
                let response = Response::from_string(
                    json!({ "ok": false, "error": "task not found" }).to_string(),
                )
                .with_status_code(StatusCode(404))
                .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
                let _ = request.respond(response);
            }
        }
        return IdeRouteOutcome::Handled;
    }

    IdeRouteOutcome::NotHandled(request)
}
