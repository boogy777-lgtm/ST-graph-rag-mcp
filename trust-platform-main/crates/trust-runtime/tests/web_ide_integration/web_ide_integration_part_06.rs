use super::*;

#[test]
fn web_ide_tree_and_filesystem_endpoints_contract() {
    let project = make_project("tree-fs");
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

    let (status, tree) = request_json(
        "GET",
        &format!("{base}/api/ide/tree"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(tree
        .get("result")
        .and_then(|v| v.get("tree"))
        .and_then(Value::as_array)
        .is_some_and(|items| !items.is_empty()));

    let (status, created_dir) = request_json(
        "POST",
        &format!("{base}/api/ide/fs/create"),
        Some(json!({ "path": "folder_a", "kind": "directory" })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert_eq!(
        created_dir
            .get("result")
            .and_then(|v| v.get("kind"))
            .and_then(Value::as_str),
        Some("directory")
    );

    let (status, created_file) = request_json(
        "POST",
        &format!("{base}/api/ide/fs/create"),
        Some(json!({
            "path": "folder_a/extra.st",
            "kind": "file",
            "content": "PROGRAM Extra\nEND_PROGRAM\n"
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert_eq!(
        created_file
            .get("result")
            .and_then(|v| v.get("path"))
            .and_then(Value::as_str),
        Some("folder_a/extra.st")
    );

    let (status, create_conflict) = request_json(
        "POST",
        &format!("{base}/api/ide/fs/create"),
        Some(json!({
            "path": "folder_a/extra.st",
            "kind": "file",
            "content": "PROGRAM Extra\nEND_PROGRAM\n"
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 409);
    assert!(create_conflict
        .get("error")
        .and_then(Value::as_str)
        .is_some_and(|message| message.contains("already exists")));

    let (status, renamed_file) = request_json(
        "POST",
        &format!("{base}/api/ide/fs/rename"),
        Some(json!({
            "path": "folder_a/extra.st",
            "new_path": "folder_a/renamed_extra.st"
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert_eq!(
        renamed_file
            .get("result")
            .and_then(|v| v.get("path"))
            .and_then(Value::as_str),
        Some("folder_a/renamed_extra.st")
    );

    let (status, open_renamed) = request_json(
        "GET",
        &format!("{base}/api/ide/file?path=folder_a/renamed_extra.st"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(open_renamed
        .get("result")
        .and_then(|v| v.get("content"))
        .and_then(Value::as_str)
        .is_some_and(|content| content.contains("PROGRAM Extra")));

    let (status, _) = request_json(
        "POST",
        &format!("{base}/api/ide/fs/delete"),
        Some(json!({ "path": "folder_a/renamed_extra.st" })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);

    let (status, files_after_delete) = request_json(
        "GET",
        &format!("{base}/api/ide/files"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(!files_after_delete
        .get("result")
        .and_then(|v| v.get("files"))
        .and_then(Value::as_array)
        .is_some_and(|items| items
            .iter()
            .any(|item| item.as_str() == Some("folder_a/renamed_extra.st"))));

    let (status, audit) = request_json(
        "GET",
        &format!("{base}/api/ide/fs/audit?limit=20"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(audit
        .get("result")
        .and_then(Value::as_array)
        .is_some_and(|items| items.len() >= 3));

    let _ = std::fs::remove_dir_all(project);
}
