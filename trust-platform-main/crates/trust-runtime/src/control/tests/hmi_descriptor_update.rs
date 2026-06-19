#[test]
fn hmi_descriptor_update_writes_files_and_bumps_schema_revision() {
    let source = r#"
PROGRAM Main
VAR
    speed : REAL := 42.0;
END_VAR
END_PROGRAM
"#;
    let root = temp_dir("hmi-descriptor-update");
    let mut state = hmi_test_state(source);
    set_hmi_project_root(&mut state, &root);

    let response = handle_request_value(
        json!({
            "id": 701,
            "type": "hmi.descriptor.update",
            "params": {
                "descriptor": {
                    "config": {
                        "theme": { "style": "industrial", "accent": "#22d3ee" },
                        "layout": {},
                        "write": {},
                        "alarm": []
                    },
                    "pages": [
                        {
                            "id": "overview",
                            "title": "Overview",
                            "icon": "activity",
                            "order": 0,
                            "kind": "dashboard",
                            "duration_ms": null,
                            "svg": null,
                            "signals": [],
                            "sections": [
                                {
                                    "title": "Drive",
                                    "span": 12,
                                    "widgets": [
                                        {
                                            "widget_type": "gauge",
                                            "bind": "Main.speed",
                                            "label": "Speed Updated",
                                            "unit": "rpm",
                                            "min": 0,
                                            "max": 100,
                                            "span": 6,
                                            "on_color": null,
                                            "off_color": null,
                                            "zones": []
                                        }
                                    ]
                                }
                            ],
                            "bindings": []
                        }
                    ]
                }
            }
        }),
        &state,
        None,
    );
    assert!(
        response.ok,
        "hmi.descriptor.update failed: {:?}",
        response.error
    );
    let revision = response
        .result
        .as_ref()
        .and_then(|value| value.get("schema_revision"))
        .and_then(serde_json::Value::as_u64)
        .expect("schema revision");
    assert!(revision >= 1, "schema revision should increment");
    assert!(root.join("hmi/_config.toml").is_file());
    assert!(root.join("hmi/overview.toml").is_file());
    let overview = fs::read_to_string(root.join("hmi/overview.toml")).expect("read overview");
    assert!(overview.contains("Speed Updated"));
    fs::remove_dir_all(root).ok();
}

#[test]
fn hmi_scaffold_reset_regenerates_required_pages_and_revision() {
    let source = r#"
PROGRAM Main
VAR_INPUT
    start_cmd : BOOL := FALSE;
END_VAR
VAR_OUTPUT
    speed : REAL := 42.0;
END_VAR
END_PROGRAM
"#;
    let root = temp_dir("hmi-scaffold-reset-endpoint");
    write_file(
        &root.join("hmi/overview.toml"),
        r#"
title = "Overview"

[[section]]
title = "Custom"
span = 12
"#,
    );
    let mut state = hmi_test_state(source);
    set_hmi_project_root(&mut state, &root);

    let response = handle_request_value(
        json!({
            "id": 702,
            "type": "hmi.scaffold.reset",
            "params": { "mode": "reset", "style": "industrial" }
        }),
        &state,
        None,
    );
    assert!(
        response.ok,
        "hmi.scaffold.reset failed: {:?}",
        response.error
    );
    let revision = response
        .result
        .as_ref()
        .and_then(|value| value.get("schema_revision"))
        .and_then(serde_json::Value::as_u64)
        .expect("schema revision");
    assert!(revision >= 1, "schema revision should increment");
    assert!(root.join("hmi/overview.toml").is_file());
    assert!(root.join("hmi/process.toml").is_file());
    assert!(root.join("hmi/control.toml").is_file());
    assert!(root.join("hmi/trends.toml").is_file());
    assert!(root.join("hmi/alarms.toml").is_file());
    let config = fs::read_to_string(root.join("hmi/_config.toml")).expect("read config");
    assert!(config.contains("version = 1"));
    fs::remove_dir_all(root).ok();
}

