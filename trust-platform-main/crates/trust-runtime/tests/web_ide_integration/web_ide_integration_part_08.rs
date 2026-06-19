use super::*;

#[test]
fn web_ide_navigation_search_and_rename_endpoints_contract() {
    let project = make_project("nav-rename");
    std::fs::write(
        project.join("types.st"),
        "TYPE\n    MyType : STRUCT\n        value : INT;\n    END_STRUCT;\nEND_TYPE\n",
    )
    .expect("write types");
    std::fs::write(
        project.join("main.st"),
        "PROGRAM Main\nVAR\nitem : MyType;\nCounter : INT;\nEND_VAR\nCounter := Counter + 1;\nEND_PROGRAM\n",
    )
    .expect("write main");

    let main_source = std::fs::read_to_string(project.join("main.st")).expect("read main");
    let (my_type_line, my_type_char) = position_for(&main_source, "MyType");
    let (counter_line, counter_char) = position_for(&main_source, "Counter := Counter");

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

    let (status, definition) = request_json(
        "POST",
        &format!("{base}/api/ide/definition"),
        Some(json!({
            "path": "main.st",
            "position": { "line": my_type_line, "character": my_type_char }
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert_eq!(
        definition
            .get("result")
            .and_then(|v| v.get("path"))
            .and_then(Value::as_str),
        Some("types.st")
    );

    let (status, references) = request_json(
        "POST",
        &format!("{base}/api/ide/references"),
        Some(json!({
            "path": "main.st",
            "position": { "line": counter_line, "character": counter_char },
            "include_declaration": true
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(references
        .get("result")
        .and_then(Value::as_array)
        .is_some_and(|items| items.len() >= 2));

    let (status, rename) = request_json(
        "POST",
        &format!("{base}/api/ide/rename"),
        Some(json!({
            "path": "main.st",
            "position": { "line": my_type_line, "character": my_type_char },
            "new_name": "MyTypeRenamed"
        })),
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(rename
        .get("result")
        .and_then(|v| v.get("edit_count"))
        .and_then(Value::as_u64)
        .is_some_and(|count| count >= 2));

    let (status, search) = request_json(
        "GET",
        &format!("{base}/api/ide/search?q=MyTypeRenamed&limit=20"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(search
        .get("result")
        .and_then(Value::as_array)
        .is_some_and(|items| !items.is_empty()));

    let (status, search_scoped) = request_json(
        "GET",
        &format!("{base}/api/ide/search?q=MyTypeRenamed&include=types.st&limit=20"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(search_scoped
        .get("result")
        .and_then(Value::as_array)
        .is_some_and(|items| !items.is_empty()
            && items
                .iter()
                .all(|item| item.get("path").and_then(Value::as_str) == Some("types.st"))));

    let (status, search_excluded) = request_json(
        "GET",
        &format!("{base}/api/ide/search?q=MyTypeRenamed&exclude=types.st&limit=20"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(!search_excluded
        .get("result")
        .and_then(Value::as_array)
        .is_some_and(|items| items
            .iter()
            .any(|item| item.get("path").and_then(Value::as_str) == Some("types.st"))));

    let (status, symbols) = request_json(
        "GET",
        &format!("{base}/api/ide/symbols?q=Main&limit=20"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(symbols
        .get("result")
        .and_then(Value::as_array)
        .is_some_and(|items| items.iter().any(|item| {
            item.get("name")
                .and_then(Value::as_str)
                .is_some_and(|name| name.eq_ignore_ascii_case("Main"))
        })));

    let (status, file_symbols) = request_json(
        "GET",
        &format!("{base}/api/ide/symbols?q=MyTypeRenamed&path=types.st&limit=20"),
        None,
        &[("X-Trust-Ide-Session", token)],
    );
    assert_eq!(status, 200);
    assert!(file_symbols
        .get("result")
        .and_then(Value::as_array)
        .is_some_and(|items| items
            .iter()
            .all(|item| { item.get("path").and_then(Value::as_str) == Some("types.st") })));

    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn web_ide_build_test_and_validate_task_endpoints_contract() {
    let project = make_project("task-endpoints");
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

    for kind in ["build", "test", "validate"] {
        let (status, task_start) = request_json(
            "POST",
            &format!("{base}/api/ide/{kind}"),
            Some(json!({})),
            &[("X-Trust-Ide-Session", token)],
        );
        assert_eq!(status, 200, "failed to start {kind} job");
        let job_id = task_start
            .get("result")
            .and_then(|v| v.get("job_id"))
            .and_then(Value::as_u64)
            .expect("job id");

        let started = Instant::now();
        let mut done = false;
        while started.elapsed() < Duration::from_secs(40) {
            let (status, task) = request_json(
                "GET",
                &format!("{base}/api/ide/task?id={job_id}"),
                None,
                &[("X-Trust-Ide-Session", token)],
            );
            assert_eq!(status, 200);
            let state_text = task
                .get("result")
                .and_then(|v| v.get("status"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            if state_text == "completed" {
                done = true;
                assert!(task
                    .get("result")
                    .and_then(|v| v.get("output"))
                    .and_then(Value::as_str)
                    .is_some());
                assert!(task
                    .get("result")
                    .and_then(|v| v.get("locations"))
                    .and_then(Value::as_array)
                    .is_some());
                break;
            }
            thread::sleep(Duration::from_millis(150));
        }
        assert!(done, "{kind} task endpoint did not complete in time");
    }

    let _ = std::fs::remove_dir_all(project);
}
