use super::*;

#[test]
pub(super) fn lsp_inline_values_runtime_override_accepts_camel_case_client_settings() {
    let (endpoint, handle) = spawn_control_stub();
    let source = runtime_inline_values_source();
    let state = ServerState::new();
    let root_uri = tower_lsp::lsp_types::Url::parse("file:///workspace/").unwrap();
    state.set_workspace_folders(vec![root_uri.clone()]);
    state.set_workspace_config(
        root_uri,
        ProjectConfig {
            root: PathBuf::from("/workspace"),
            config_path: None,
            include_paths: Vec::new(),
            vendor_profile: None,
            stdlib: StdlibSettings::default(),
            libraries: Vec::new(),
            dependencies: Vec::new(),
            dependency_resolution_issues: Vec::new(),
            diagnostic_external_paths: Vec::new(),
            build: BuildConfig::default(),
            targets: Vec::new(),
            indexing: IndexingConfig::default(),
            diagnostics: DiagnosticSettings::default(),
            runtime: RuntimeConfig::default(),
            workspace: WorkspaceSettings::default(),
            telemetry: TelemetryConfig::default(),
        },
    );
    state.set_config(json!({
        "stLsp": {
            "runtime": {
                "inlineValuesEnabled": true,
                "controlEndpointEnabled": true,
                "controlEndpoint": endpoint,
            }
        }
    }));

    let uri = tower_lsp::lsp_types::Url::parse("file:///workspace/runtime.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());
    let params = runtime_inline_values_params(uri, source);
    let values = inline_value(&state, params).expect("inline values");
    let texts: Vec<String> = values
        .iter()
        .filter_map(|value| match value {
            tower_lsp::lsp_types::InlineValue::Text(text) => Some(text.text.clone()),
            _ => None,
        })
        .collect();
    assert!(texts.iter().any(|text| text == " = DInt(11)"));
    assert!(texts.iter().any(|text| text == " = DInt(42)"));

    handle.join().expect("control stub thread");
}

#[test]
pub(super) fn lsp_inline_values_runtime_override_accepts_snake_case_client_settings() {
    let (endpoint, handle) = spawn_control_stub();
    let source = runtime_inline_values_source();
    let state = ServerState::new();
    let root_uri = tower_lsp::lsp_types::Url::parse("file:///workspace/").unwrap();
    state.set_workspace_folders(vec![root_uri.clone()]);
    state.set_workspace_config(
        root_uri,
        ProjectConfig {
            root: PathBuf::from("/workspace"),
            config_path: None,
            include_paths: Vec::new(),
            vendor_profile: None,
            stdlib: StdlibSettings::default(),
            libraries: Vec::new(),
            dependencies: Vec::new(),
            dependency_resolution_issues: Vec::new(),
            diagnostic_external_paths: Vec::new(),
            build: BuildConfig::default(),
            targets: Vec::new(),
            indexing: IndexingConfig::default(),
            diagnostics: DiagnosticSettings::default(),
            runtime: RuntimeConfig::default(),
            workspace: WorkspaceSettings::default(),
            telemetry: TelemetryConfig::default(),
        },
    );
    state.set_config(json!({
        "trust_lsp": {
            "runtime": {
                "inline_values_enabled": true,
                "control_endpoint_enabled": true,
                "control_endpoint": endpoint,
            }
        }
    }));

    let uri = tower_lsp::lsp_types::Url::parse("file:///workspace/runtime.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());
    let params = runtime_inline_values_params(uri, source);
    let values = inline_value(&state, params).expect("inline values");
    let texts: Vec<String> = values
        .iter()
        .filter_map(|value| match value {
            tower_lsp::lsp_types::InlineValue::Text(text) => Some(text.text.clone()),
            _ => None,
        })
        .collect();
    assert!(texts.iter().any(|text| text == " = DInt(11)"));
    assert!(texts.iter().any(|text| text == " = DInt(42)"));

    handle.join().expect("control stub thread");
}

#[test]
pub(super) fn lsp_inline_values_runtime_override_prefers_camel_case_when_aliases_conflict() {
    let (endpoint, handle) = spawn_control_stub();
    let endpoint_addr = endpoint
        .strip_prefix("tcp://")
        .map(str::to_string)
        .expect("tcp endpoint");
    let source = runtime_inline_values_source();
    let state = ServerState::new();
    let root_uri = tower_lsp::lsp_types::Url::parse("file:///workspace/").unwrap();
    state.set_workspace_folders(vec![root_uri.clone()]);
    state.set_workspace_config(
        root_uri,
        ProjectConfig {
            root: PathBuf::from("/workspace"),
            config_path: None,
            include_paths: Vec::new(),
            vendor_profile: None,
            stdlib: StdlibSettings::default(),
            libraries: Vec::new(),
            dependencies: Vec::new(),
            dependency_resolution_issues: Vec::new(),
            diagnostic_external_paths: Vec::new(),
            build: BuildConfig::default(),
            targets: Vec::new(),
            indexing: IndexingConfig::default(),
            diagnostics: DiagnosticSettings::default(),
            runtime: RuntimeConfig::default(),
            workspace: WorkspaceSettings::default(),
            telemetry: TelemetryConfig::default(),
        },
    );
    state.set_config(json!({
        "stLsp": {
            "runtime": {
                "inlineValuesEnabled": false,
                "inline_values_enabled": true,
                "controlEndpointEnabled": false,
                "control_endpoint_enabled": true,
                "controlEndpoint": endpoint.clone(),
                "control_endpoint": endpoint,
            }
        }
    }));

    let uri = tower_lsp::lsp_types::Url::parse("file:///workspace/runtime.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());
    let params = runtime_inline_values_params(uri, source);
    let values = inline_value(&state, params).expect("inline values");
    let texts: Vec<String> = values
        .iter()
        .filter_map(|value| match value {
            tower_lsp::lsp_types::InlineValue::Text(text) => Some(text.text.clone()),
            _ => None,
        })
        .collect();

    assert!(
        texts.iter().all(|text| text != " = DInt(11)"),
        "camelCase control flag should disable runtime fetch"
    );
    assert!(
        texts.iter().all(|text| text != " = DInt(42)"),
        "camelCase control flag should disable runtime fetch"
    );

    let _ = std::net::TcpStream::connect(endpoint_addr);
    handle.join().expect("control stub thread");
}

#[test]
pub(super) fn lsp_inline_values_merge_instances_into_locals() {
    let (endpoint, handle) = spawn_control_stub_with_instances("TestProgram#1");
    let source = r#"
PROGRAM TestProgram
VAR
    x : DINT;
END_VAR
    x := x + 1;
END_PROGRAM
"#;
    let state = ServerState::new();
    let root_uri = tower_lsp::lsp_types::Url::parse("file:///workspace/").unwrap();
    state.set_workspace_folders(vec![root_uri.clone()]);
    state.set_workspace_config(
        root_uri,
        ProjectConfig {
            root: PathBuf::from("/workspace"),
            config_path: None,
            include_paths: Vec::new(),
            vendor_profile: None,
            stdlib: StdlibSettings::default(),
            libraries: Vec::new(),
            dependencies: Vec::new(),
            dependency_resolution_issues: Vec::new(),
            diagnostic_external_paths: Vec::new(),
            build: BuildConfig::default(),
            targets: Vec::new(),
            indexing: IndexingConfig::default(),
            diagnostics: DiagnosticSettings::default(),
            runtime: RuntimeConfig {
                control_endpoint: Some(endpoint),
                control_auth_token: None,
            },
            workspace: WorkspaceSettings::default(),
            telemetry: TelemetryConfig::default(),
        },
    );

    let uri = tower_lsp::lsp_types::Url::parse("file:///workspace/runtime.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());

    let params = tower_lsp::lsp_types::InlineValueParams {
        text_document: tower_lsp::lsp_types::TextDocumentIdentifier { uri },
        range: tower_lsp::lsp_types::Range {
            start: position_at(source, "x := x"),
            end: position_at(source, "END_PROGRAM"),
        },
        context: tower_lsp::lsp_types::InlineValueContext {
            frame_id: 1,
            stopped_location: tower_lsp::lsp_types::Range {
                start: tower_lsp::lsp_types::Position::new(0, 0),
                end: tower_lsp::lsp_types::Position::new(0, 0),
            },
        },
        work_done_progress_params: Default::default(),
    };

    let values = inline_value(&state, params).expect("inline values");
    let texts: Vec<String> = values
        .iter()
        .filter_map(|value| match value {
            tower_lsp::lsp_types::InlineValue::Text(text) => Some(text.text.clone()),
            _ => None,
        })
        .collect();

    assert!(texts.iter().any(|text| text == " = DInt(9)"));

    handle.join().expect("control stub thread");
}
