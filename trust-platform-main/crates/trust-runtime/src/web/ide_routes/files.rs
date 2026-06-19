use super::*;

pub(super) fn handle_file_route(
    mut request: tiny_http::Request,
    method: &Method,
    url: &str,
    ctx: &IdeRouteContext<'_>,
) -> IdeRouteOutcome {
    let control_state = ctx.control_state;
    let ide_state = ctx.ide_state;

    if *method == Method::Get && url == "/api/ide/files" {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        match ide_state.list_sources(session_token.as_str()) {
            Ok(files) => {
                let response = Response::from_string(
                    json!({ "ok": true, "result": { "files": files } }).to_string(),
                )
                .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
                let _ = request.respond(response);
            }
            Err(error) => {
                let _ = request.respond(ide_error_response(error));
            }
        }
        return IdeRouteOutcome::Handled;
    }
    if *method == Method::Get && url == "/api/ide/tree" {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        match ide_state.list_tree(session_token.as_str()) {
            Ok(tree) => {
                let response = Response::from_string(
                    json!({ "ok": true, "result": { "tree": tree } }).to_string(),
                )
                .with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
                let _ = request.respond(response);
            }
            Err(error) => {
                let _ = request.respond(ide_error_response(error));
            }
        }
        return IdeRouteOutcome::Handled;
    }
    if *method == Method::Get && url.starts_with("/api/ide/browse") {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        let path = query_value(url, "path");
        match ide_state.browse_directory(session_token.as_str(), path.as_deref()) {
            Ok(result) => {
                let response =
                    Response::from_string(json!({ "ok": true, "result": result }).to_string())
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
    if *method == Method::Get && url.starts_with("/api/ide/file") {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        let path = url.split('?').nth(1).and_then(|query| {
            query.split('&').find_map(|pair| {
                let mut parts = pair.splitn(2, '=');
                if parts.next()? == "path" {
                    Some(decode_url_component(parts.next().unwrap_or_default()))
                } else {
                    None
                }
            })
        });
        let Some(path) = path else {
            let response =
                Response::from_string(json!({ "ok": false, "error": "missing path" }).to_string())
                    .with_status_code(StatusCode(400));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        match ide_state.open_source(session_token.as_str(), path.as_str()) {
            Ok(mut snapshot) => {
                if !ide_write_enabled(control_state) {
                    snapshot.read_only = true;
                }
                let response =
                    Response::from_string(json!({ "ok": true, "result": snapshot }).to_string())
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
    if *method == Method::Post && url == "/api/ide/file" {
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
        let payload: IdeWriteRequest = match serde_json::from_str(&body) {
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
        match ide_state.apply_source(
            session_token.as_str(),
            payload.path.as_str(),
            payload.expected_version,
            payload.content,
            ide_write_enabled(control_state),
        ) {
            Ok(result) => {
                let response =
                    Response::from_string(json!({ "ok": true, "result": result }).to_string())
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
    if *method == Method::Post && url == "/api/ide/fs/create" {
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
        let payload: IdeFsCreateRequest = match serde_json::from_str(&body) {
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
        let is_directory = payload.kind.as_deref().is_some_and(|kind| {
            kind.eq_ignore_ascii_case("directory") || kind.eq_ignore_ascii_case("dir")
        });
        match ide_state.create_entry(
            session_token.as_str(),
            payload.path.as_str(),
            is_directory,
            payload.content,
            ide_write_enabled(control_state),
        ) {
            Ok(result) => {
                let response =
                    Response::from_string(json!({ "ok": true, "result": result }).to_string())
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
    if *method == Method::Post && (url == "/api/ide/fs/rename" || url == "/api/ide/fs/move") {
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
        let payload: IdeFsRenameRequest = match serde_json::from_str(&body) {
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
        match ide_state.rename_entry(
            session_token.as_str(),
            payload.path.as_str(),
            payload.new_path.as_str(),
            ide_write_enabled(control_state),
        ) {
            Ok(result) => {
                let response =
                    Response::from_string(json!({ "ok": true, "result": result }).to_string())
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
    if *method == Method::Post && url == "/api/ide/fs/delete" {
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
        let payload: IdeFsDeleteRequest = match serde_json::from_str(&body) {
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
        match ide_state.delete_entry(
            session_token.as_str(),
            payload.path.as_str(),
            ide_write_enabled(control_state),
        ) {
            Ok(result) => {
                let response =
                    Response::from_string(json!({ "ok": true, "result": result }).to_string())
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
    if *method == Method::Get && url.starts_with("/api/ide/fs/audit") {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        let limit = parse_limit(url).unwrap_or(40).clamp(1, 200) as usize;
        match ide_state.fs_audit(session_token.as_str(), limit) {
            Ok(events) => {
                let response =
                    Response::from_string(json!({ "ok": true, "result": events }).to_string())
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

    IdeRouteOutcome::NotHandled(request)
}
