use super::*;

#[test]
fn web_ide_analysis_and_health_endpoints_contract() {
    let project = make_project("analysis-endpoints");
    let state = control_state(source_fixture(), ControlMode::Debug, None);
    let base = start_test_server(state, project.clone(), WebAuthMode::Local);

    let (_, session) = request_json(
        "POST",
        &format!("{base}/api/ide/session"),
        Some(json!({ "role": "editor" })),
        &[],
    );
    let token = session
        .get("result")
        .and_then(|v| v.get("token"))
        .and_then(Value::as_str)
        .expect("session token");

    let (status, diagnostics) = request_json(
        "POST",
        &format!("{base}/api/ide/diagnostics"),
        Some(json!({
            "path": "main.st",
            "content": "PROGRAM Main\nVAR\nCounter : INT;\nEND_VAR\n\nCounter := UnknownSymbol + 1;\nEND_PROGRAM\n"
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(diagnostics
        .get("result")
        .and_then(Value::as_array)
        .is_some_and(|items| items.iter().any(|item| {
            item.get("message")
                .and_then(Value::as_str)
                .is_some_and(|message| message.contains("UnknownSymbol"))
        })));

    let (status, hover) = request_json(
        "POST",
        &format!("{base}/api/ide/hover"),
        Some(json!({
            "path": "main.st",
            "content": "PROGRAM Main\nVAR\nCounter : INT;\nEND_VAR\n\nCounter := Counter + 1;\nEND_PROGRAM\n",
            "position": { "line": 5, "character": 2 }
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(hover
        .get("result")
        .and_then(|value| value.get("contents"))
        .and_then(Value::as_str)
        .is_some_and(|value| value.contains("Counter")));

    let (status, completion) = request_json(
        "POST",
        &format!("{base}/api/ide/completion"),
        Some(json!({
            "path": "main.st",
            "content": "PRO\nPROGRAM Main\nEND_PROGRAM\n",
            "position": { "line": 0, "character": 3 },
            "limit": 20
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(completion
        .get("result")
        .and_then(Value::as_array)
        .is_some_and(|items| items
            .iter()
            .any(|item| { item.get("label").and_then(Value::as_str) == Some("PROGRAM") })));

    let (status, health) = request_json(
        "GET",
        &format!("{base}/api/ide/health"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(health
        .get("result")
        .and_then(|value| value.get("active_sessions"))
        .and_then(Value::as_u64)
        .is_some_and(|count| count >= 1));
    assert!(health
        .get("result")
        .and_then(|value| value.get("tracked_documents"))
        .and_then(Value::as_u64)
        .is_some_and(|count| count >= 1));
    assert_eq!(
        health
            .get("result")
            .and_then(|value| value.get("frontend_telemetry"))
            .and_then(|value| value.get("bootstrap_failures"))
            .and_then(Value::as_u64),
        Some(0)
    );

    let (status, telemetry) = request_json(
        "POST",
        &format!("{base}/api/ide/frontend-telemetry"),
        Some(json!({
            "bootstrap_failures": 1,
            "analysis_timeouts": 2,
            "worker_restarts": 3,
            "autosave_failures": 4
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert_eq!(
        telemetry
            .get("result")
            .and_then(|value| value.get("bootstrap_failures"))
            .and_then(Value::as_u64),
        Some(1)
    );

    let (status, health_after_telemetry) = request_json(
        "GET",
        &format!("{base}/api/ide/health"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert_eq!(
        health_after_telemetry
            .get("result")
            .and_then(|value| value.get("frontend_telemetry"))
            .and_then(|value| value.get("analysis_timeouts"))
            .and_then(Value::as_u64),
        Some(2)
    );

    let (status, presence_model) = request_json(
        "GET",
        &format!("{base}/api/ide/presence-model"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert_eq!(
        presence_model
            .get("result")
            .and_then(|value| value.get("mode"))
            .and_then(Value::as_str),
        Some("out_of_scope_phase_1")
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn web_ide_format_endpoint_contract() {
    let project = make_project("format-endpoint");
    let state = control_state(source_fixture(), ControlMode::Debug, None);
    let base = start_test_server(state, project.clone(), WebAuthMode::Local);

    let (_, session) = request_json(
        "POST",
        &format!("{base}/api/ide/session"),
        Some(json!({ "role": "editor" })),
        &[],
    );
    let token = session
        .get("result")
        .and_then(|v| v.get("token"))
        .and_then(Value::as_str)
        .expect("session token");

    let (status, formatted) = request_json(
        "POST",
        &format!("{base}/api/ide/format"),
        Some(json!({
            "path": "main.st",
            "content": "PROGRAM Main\nVAR\nA:INT;\nEND_VAR\nEND_PROGRAM\n"
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert_eq!(
        formatted
            .get("result")
            .and_then(|v| v.get("path"))
            .and_then(Value::as_str),
        Some("main.st")
    );
    assert_eq!(
        formatted
            .get("result")
            .and_then(|v| v.get("changed"))
            .and_then(Value::as_bool),
        Some(true)
    );
    assert!(formatted
        .get("result")
        .and_then(|v| v.get("content"))
        .and_then(Value::as_str)
        .is_some_and(|content| content.contains("  VAR") && content.contains("    A:INT;")));

    let _ = std::fs::remove_dir_all(project);
}
