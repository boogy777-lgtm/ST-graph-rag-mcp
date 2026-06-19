use super::*;

#[test]
pub(super) fn lsp_linked_editing_ranges() {
    let source = r#"
PROGRAM Test
    VAR x : INT; END_VAR
    x := 1;
    x := x + 1;
END_PROGRAM
"#;
    let state = ServerState::new();
    let uri = tower_lsp::lsp_types::Url::parse("file:///test.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());

    let params = tower_lsp::lsp_types::LinkedEditingRangeParams {
        text_document_position_params: tower_lsp::lsp_types::TextDocumentPositionParams {
            text_document: tower_lsp::lsp_types::TextDocumentIdentifier { uri: uri.clone() },
            position: position_at(source, "x := 1"),
        },
        work_done_progress_params: Default::default(),
    };

    let ranges = linked_editing_range(&state, params).expect("linked editing ranges");
    assert_eq!(ranges.ranges.len(), 4);
}

#[test]
pub(super) fn lsp_inlay_hints_parameters() {
    let source = r#"
FUNCTION Add : INT
VAR_INPUT
    A : INT;
    B : INT;
END_VAR
    Add := A + B;
END_FUNCTION

PROGRAM Main
VAR
    result : INT;
END_VAR
    result := Add(1, 2);
END_PROGRAM
"#;
    let state = ServerState::new();
    let uri = tower_lsp::lsp_types::Url::parse("file:///test.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());

    let start = position_at(source, "Add(1");
    let end_offset = source.find(");").expect("call end");
    let end = super::lsp_utils::offset_to_position(source, end_offset as u32);

    let params = tower_lsp::lsp_types::InlayHintParams {
        text_document: tower_lsp::lsp_types::TextDocumentIdentifier { uri: uri.clone() },
        range: tower_lsp::lsp_types::Range { start, end },
        work_done_progress_params: Default::default(),
    };

    let hints = inlay_hint(&state, params).expect("inlay hints");
    assert_eq!(hints.len(), 2);
    assert!(hints
        .iter()
        .any(|hint| inlay_label_contains(&hint.label, "A")));
    assert!(hints
        .iter()
        .any(|hint| inlay_label_contains(&hint.label, "B")));
}

#[test]
pub(super) fn lsp_inline_values_constants() {
    let constants = r#"
CONFIGURATION Conf
VAR_GLOBAL CONSTANT
    ANSWER : INT := 42;
END_VAR
END_CONFIGURATION
"#;
    let program = r#"
PROGRAM Test
VAR
    x : INT;
END_VAR
VAR_EXTERNAL CONSTANT
    ANSWER : INT;
END_VAR
    x := ANSWER;
END_PROGRAM
"#;
    let state = ServerState::new();
    let const_uri = tower_lsp::lsp_types::Url::parse("file:///constants.st").unwrap();
    let prog_uri = tower_lsp::lsp_types::Url::parse("file:///main.st").unwrap();
    state.open_document(const_uri, 1, constants.to_string());
    state.open_document(prog_uri.clone(), 1, program.to_string());

    let end = super::lsp_utils::offset_to_position(program, program.len() as u32);
    let params = tower_lsp::lsp_types::InlineValueParams {
        text_document: tower_lsp::lsp_types::TextDocumentIdentifier {
            uri: prog_uri.clone(),
        },
        range: tower_lsp::lsp_types::Range {
            start: tower_lsp::lsp_types::Position::new(0, 0),
            end,
        },
        context: tower_lsp::lsp_types::InlineValueContext {
            frame_id: 0,
            stopped_location: tower_lsp::lsp_types::Range {
                start: tower_lsp::lsp_types::Position::new(0, 0),
                end,
            },
        },
        work_done_progress_params: Default::default(),
    };

    let values = inline_value(&state, params).expect("inline values");
    let has_answer = values.iter().any(|value| match value {
        tower_lsp::lsp_types::InlineValue::Text(text) => text.text == " = 42",
        _ => false,
    });
    assert!(has_answer);
}

pub(super) fn runtime_inline_values_source() -> &'static str {
    r#"
CONFIGURATION Conf
VAR_GLOBAL
    g : INT;
END_VAR
VAR_GLOBAL RETAIN
    r : INT;
END_VAR
END_CONFIGURATION

PROGRAM Test
VAR
    x : INT;
END_VAR
    x := x + g + r;
END_PROGRAM
"#
}

pub(super) fn runtime_inline_values_params(
    uri: tower_lsp::lsp_types::Url,
    source: &str,
) -> tower_lsp::lsp_types::InlineValueParams {
    tower_lsp::lsp_types::InlineValueParams {
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
    }
}

#[test]
pub(super) fn lsp_inline_values_fetch_runtime_values_from_control_stub() {
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

    let params = runtime_inline_values_params(uri, source);

    let values = inline_value(&state, params).expect("inline values");
    let texts: Vec<String> = values
        .iter()
        .filter_map(|value| match value {
            tower_lsp::lsp_types::InlineValue::Text(text) => Some(text.text.clone()),
            _ => None,
        })
        .collect();

    assert!(texts.iter().any(|text| text == " = DInt(7)"));
    assert!(texts.iter().any(|text| text == " = DInt(11)"));
    assert!(texts.iter().any(|text| text == " = DInt(42)"));

    handle.join().expect("control stub thread");
}
