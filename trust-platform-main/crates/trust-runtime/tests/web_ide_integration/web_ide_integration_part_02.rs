use super::*;

#[test]
fn web_ide_collaborative_conflict_contract() {
    let project = make_project("conflict");
    let state = control_state(source_fixture(), ControlMode::Debug, None);
    let base = start_test_server(state, project.clone(), WebAuthMode::Local);

    let (_, s1) = request_json(
        "POST",
        &format!("{base}/api/ide/session"),
        Some(json!({ "role": "editor" })),
        &[],
    );
    let (_, s2) = request_json(
        "POST",
        &format!("{base}/api/ide/session"),
        Some(json!({ "role": "editor" })),
        &[],
    );
    let token_a = s1
        .get("result")
        .and_then(|v| v.get("token"))
        .and_then(Value::as_str)
        .expect("token a");
    let token_b = s2
        .get("result")
        .and_then(|v| v.get("token"))
        .and_then(Value::as_str)
        .expect("token b");

    let (_, a_open) = request_json(
        "GET",
        &format!("{base}/api/ide/file?path=main.st"),
        None,
        &[("X-Trust-Ide-Session", token_a)],
    );
    let (_, b_open) = request_json(
        "GET",
        &format!("{base}/api/ide/file?path=main.st"),
        None,
        &[("X-Trust-Ide-Session", token_b)],
    );

    let version_a = a_open
        .get("result")
        .and_then(|v| v.get("version"))
        .and_then(Value::as_u64)
        .expect("version a");
    let version_b = b_open
        .get("result")
        .and_then(|v| v.get("version"))
        .and_then(Value::as_u64)
        .expect("version b");
    assert_eq!(version_a, version_b);

    let (status, first_write) = request_json(
        "POST",
        &format!("{base}/api/ide/file"),
        Some(json!({
            "path": "main.st",
            "expected_version": version_a,
            "content": "PROGRAM Main\nVAR\nCounter : INT := 2;\nEND_VAR\nEND_PROGRAM\n"
        })),
        &[("X-Trust-Ide-Session", token_a)],
    );
    assert_eq!(status, 200);
    let current_version = first_write
        .get("result")
        .and_then(|v| v.get("version"))
        .and_then(Value::as_u64)
        .expect("current version");

    let (status, conflict) = request_json(
        "POST",
        &format!("{base}/api/ide/file"),
        Some(json!({
            "path": "main.st",
            "expected_version": version_b,
            "content": "PROGRAM Main\nVAR\nCounter : INT := 9;\nEND_VAR\nEND_PROGRAM\n"
        })),
        &[("X-Trust-Ide-Session", token_b)],
    );
    assert_eq!(status, 409);
    assert_eq!(
        conflict.get("current_version").and_then(Value::as_u64),
        Some(current_version)
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn web_ide_viewer_sessions_are_read_only_and_editor_sessions_can_write() {
    let project = make_project("mode");
    let state = control_state(source_fixture(), ControlMode::Production, None);
    let base = start_test_server(state, project.clone(), WebAuthMode::Local);

    let (_, caps) = request_json("GET", &format!("{base}/api/ide/capabilities"), None, &[]);
    assert_eq!(
        caps.get("result")
            .and_then(|v| v.get("mode"))
            .and_then(Value::as_str),
        Some("authoring")
    );

    let (_, session) = request_json(
        "POST",
        &format!("{base}/api/ide/session"),
        Some(json!({ "role": "viewer" })),
        &[],
    );
    let viewer_token = session
        .get("result")
        .and_then(|v| v.get("token"))
        .and_then(Value::as_str)
        .expect("session token");

    let (_, opened) = request_json(
        "GET",
        &format!("{base}/api/ide/file?path=main.st"),
        None,
        &[("X-Trust-Ide-Session", viewer_token)],
    );
    assert_eq!(
        opened
            .get("result")
            .and_then(|v| v.get("read_only"))
            .and_then(Value::as_bool),
        Some(true)
    );
    let version = opened
        .get("result")
        .and_then(|v| v.get("version"))
        .and_then(Value::as_u64)
        .expect("version");

    let (status, denied) = request_json(
        "POST",
        &format!("{base}/api/ide/file"),
        Some(json!({
            "path": "main.st",
            "expected_version": version,
            "content": "PROGRAM Main\nEND_PROGRAM\n"
        })),
        &[("X-Trust-Ide-Session", viewer_token)],
    );
    assert_eq!(status, 403);
    assert!(denied
        .get("error")
        .and_then(Value::as_str)
        .is_some_and(|message| message.contains("session role does not allow edits")));

    let (_, editor_session) = request_json(
        "POST",
        &format!("{base}/api/ide/session"),
        Some(json!({ "role": "editor" })),
        &[],
    );
    let editor_token = editor_session
        .get("result")
        .and_then(|v| v.get("token"))
        .and_then(Value::as_str)
        .expect("editor token");

    let (status, written) = request_json(
        "POST",
        &format!("{base}/api/ide/file"),
        Some(json!({
            "path": "main.st",
            "expected_version": version,
            "content": "PROGRAM Main\nVAR\nCounter : INT := 7;\nEND_VAR\nEND_PROGRAM\n"
        })),
        &[("X-Trust-Ide-Session", editor_token)],
    );
    assert_eq!(status, 200);
    assert!(written
        .get("result")
        .and_then(|v| v.get("version"))
        .and_then(Value::as_u64)
        .is_some_and(|next| next > version));

    let _ = std::fs::remove_dir_all(project);
}
