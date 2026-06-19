use super::*;

pub(super) fn handle_language_route(
    mut request: tiny_http::Request,
    method: &Method,
    url: &str,
    ctx: &IdeRouteContext<'_>,
) -> IdeRouteOutcome {
    let control_state = ctx.control_state;
    let ide_state = ctx.ide_state;

    if *method == Method::Post && url == "/api/ide/diagnostics" {
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
        let payload: IdeDiagnosticsRequest = match serde_json::from_str(&body) {
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
        match ide_state.diagnostics(
            session_token.as_str(),
            payload.path.as_str(),
            payload.content,
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
    if *method == Method::Post && url == "/api/ide/hover" {
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
        let payload: IdeHoverRequest = match serde_json::from_str(&body) {
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
        let position = trust_wasm_analysis::Position {
            line: payload.position.line,
            character: payload.position.character,
        };
        match ide_state.hover(
            session_token.as_str(),
            payload.path.as_str(),
            payload.content,
            position,
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
    if *method == Method::Post && url == "/api/ide/completion" {
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
        let payload: IdeCompletionRequest = match serde_json::from_str(&body) {
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
        let position = trust_wasm_analysis::Position {
            line: payload.position.line,
            character: payload.position.character,
        };
        match ide_state.completion(
            session_token.as_str(),
            payload.path.as_str(),
            payload.content,
            position,
            payload.limit,
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
    if *method == Method::Post && url == "/api/ide/definition" {
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
        let payload: IdeHoverRequest = match serde_json::from_str(&body) {
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
        let position = trust_wasm_analysis::Position {
            line: payload.position.line,
            character: payload.position.character,
        };
        match ide_state.definition(
            session_token.as_str(),
            payload.path.as_str(),
            payload.content,
            position,
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
    if *method == Method::Post && url == "/api/ide/references" {
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
        let payload: IdeReferencesRequest = match serde_json::from_str(&body) {
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
        let position = trust_wasm_analysis::Position {
            line: payload.position.line,
            character: payload.position.character,
        };
        match ide_state.references(
            session_token.as_str(),
            payload.path.as_str(),
            payload.content,
            position,
            payload.include_declaration.unwrap_or(true),
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
    if *method == Method::Post && url == "/api/ide/rename" {
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
        let payload: IdeRenameRequest = match serde_json::from_str(&body) {
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
        let position = trust_wasm_analysis::Position {
            line: payload.position.line,
            character: payload.position.character,
        };
        match ide_state.rename_symbol(
            session_token.as_str(),
            payload.path.as_str(),
            payload.content,
            position,
            payload.new_name.as_str(),
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
    if *method == Method::Get && url.starts_with("/api/ide/search") {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        let query = query_value(url, "q").unwrap_or_default();
        let include = query_value(url, "include");
        let exclude = query_value(url, "exclude");
        let limit = parse_limit(url).unwrap_or(50).clamp(1, 500) as usize;
        match ide_state.workspace_search(
            session_token.as_str(),
            query.as_str(),
            include.as_deref(),
            exclude.as_deref(),
            limit,
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
    if *method == Method::Get && url.starts_with("/api/ide/symbols") {
        let Some(session_token) = ide_session_token(&request) else {
            let response = Response::from_string(
                json!({ "ok": false, "error": "missing X-Trust-Ide-Session" }).to_string(),
            )
            .with_status_code(StatusCode(401));
            let _ = request.respond(response);
            return IdeRouteOutcome::Handled;
        };
        let query = query_value(url, "q").unwrap_or_default();
        let limit = parse_limit(url).unwrap_or(100).clamp(1, 1000) as usize;
        let path = query_value(url, "path");
        let result = if let Some(path) = path {
            ide_state.file_symbols(session_token.as_str(), path.as_str(), query.as_str(), limit)
        } else {
            ide_state.workspace_symbols(session_token.as_str(), query.as_str(), limit)
        };
        match result {
            Ok(items) => {
                let response =
                    Response::from_string(json!({ "ok": true, "result": items }).to_string())
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
    if *method == Method::Post && url == "/api/ide/format" {
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
        let payload: IdeFormatRequest = match serde_json::from_str(&body) {
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
        match ide_state.format_source(
            session_token.as_str(),
            payload.path.as_str(),
            payload.content,
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

    IdeRouteOutcome::NotHandled(request)
}
