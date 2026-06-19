use super::*;

#[test]
fn web_ide_shell_serves_local_hashed_assets_without_cdn_dependency() {
    let project = make_project("shell-assets");
    let state = control_state(source_fixture(), ControlMode::Debug, None);
    let base = start_test_server(state, project.clone(), WebAuthMode::Local);

    let shell = ureq::get(&format!("{base}/ide"))
        .call()
        .expect("fetch ide shell")
        .body_mut()
        .read_to_string()
        .expect("read ide shell");
    assert!(
        shell.contains("/ide/ide.js"),
        "ide shell must reference external ide.js"
    );
    assert!(
        shell.contains("/ide/modules/ide-editor.js"),
        "ide shell must reference extracted ide editor module"
    );
    assert!(
        shell.contains("/ide/modules/ide-editor-runtime.js"),
        "ide shell must reference ide editor runtime module"
    );
    assert!(
        shell.contains("/ide/ide.css"),
        "ide shell must reference external ide.css"
    );
    assert!(
        !shell.contains("esm.sh/"),
        "ide shell must not depend on esm.sh at runtime"
    );

    let ide_js = ureq::get(&format!("{base}/ide/modules/ide-editor-runtime.js"))
        .call()
        .expect("fetch ide editor runtime module")
        .body_mut()
        .read_to_string()
        .expect("read ide editor runtime module");
    assert!(
        ide_js.contains("/ide/assets/ide-monaco.20260215.js"),
        "ide editor module must reference local bundled monaco asset"
    );

    let ide_css = ureq::get(&format!("{base}/ide/ide.css"))
        .call()
        .expect("fetch ide.css")
        .body_mut()
        .read_to_string()
        .expect("read ide.css");
    assert!(ide_css.len() > 500, "ide.css looks unexpectedly small");

    let bundle = ureq::get(&format!("{base}/ide/assets/ide-monaco.20260215.js"))
        .call()
        .expect("fetch ide bundle")
        .body_mut()
        .read_to_string()
        .expect("read ide bundle");
    assert!(
        bundle.len() > 100_000,
        "local monaco bundle looks unexpectedly small"
    );

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn web_ide_auth_and_session_contract() {
    let project = make_project("auth");
    let state = control_state(source_fixture(), ControlMode::Debug, Some("secret-token"));
    let base = start_test_server(state, project.clone(), WebAuthMode::Token);

    let (status, unauthorized) = request_json(
        "POST",
        &format!("{base}/api/ide/session"),
        Some(json!({ "role": "editor" })),
        &[],
    );
    assert_eq!(status, 401);
    assert_eq!(
        unauthorized.get("error").and_then(Value::as_str),
        Some("unauthorized")
    );

    let (status, session_body) = request_json(
        "POST",
        &format!("{base}/api/ide/session"),
        Some(json!({ "role": "editor" })),
        &[("X-Trust-Token", "secret-token")],
    );
    assert_eq!(status, 200);
    let session_token = session_body
        .get("result")
        .and_then(|v| v.get("token"))
        .and_then(Value::as_str)
        .expect("session token");

    let (status, files) = request_json(
        "GET",
        &format!("{base}/api/ide/files"),
        None,
        &[("X-Trust-Ide-Session", session_token)],
    );
    assert_eq!(status, 200);
    assert!(files
        .get("result")
        .and_then(|v| v.get("files"))
        .and_then(Value::as_array)
        .is_some_and(|items| items.iter().any(|item| item.as_str() == Some("main.st"))));

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn web_ide_project_open_endpoint_supports_no_bundle_startup() {
    let project = make_project("project-open");
    let state = control_state(source_fixture(), ControlMode::Debug, None);
    let base = start_test_server_with_root(state, None, WebAuthMode::Local);

    let (_, session_body) = request_json(
        "POST",
        &format!("{base}/api/ide/session"),
        Some(json!({ "role": "editor" })),
        &[],
    );
    let session_token = session_body
        .get("result")
        .and_then(|v| v.get("token"))
        .and_then(Value::as_str)
        .expect("session token");

    let (status, initial_project) = request_json(
        "GET",
        &format!("{base}/api/ide/project"),
        None,
        &[("X-Trust-Ide-Session", session_token)],
    );
    assert_eq!(status, 200);
    assert!(initial_project
        .get("result")
        .and_then(|v| v.get("active_project"))
        .is_some_and(Value::is_null));

    let (status, opened_project) = request_json(
        "POST",
        &format!("{base}/api/ide/project/open"),
        Some(json!({ "path": project.display().to_string() })),
        &[("X-Trust-Ide-Session", session_token)],
    );
    assert_eq!(status, 200);
    assert!(opened_project
        .get("result")
        .and_then(|v| v.get("active_project"))
        .and_then(Value::as_str)
        .is_some_and(|path| path.contains("project-open")));

    let (status, files) = request_json(
        "GET",
        &format!("{base}/api/ide/files"),
        None,
        &[("X-Trust-Ide-Session", session_token)],
    );
    assert_eq!(status, 200);
    assert!(files
        .get("result")
        .and_then(|v| v.get("files"))
        .and_then(Value::as_array)
        .is_some_and(|items| items.iter().any(|item| item.as_str() == Some("main.st"))));

    let _ = std::fs::remove_dir_all(project);
}
