use super::*;

#[test]
fn lsp_code_action_namespace_disambiguation() {
    let source = r#"
NAMESPACE LibA
FUNCTION Foo : INT
END_FUNCTION
END_NAMESPACE

NAMESPACE LibB
FUNCTION Foo : INT
END_FUNCTION
END_NAMESPACE

PROGRAM Main
    USING LibA;
    USING LibB;
    VAR
        x : INT;
    END_VAR
    x := Foo();
END_PROGRAM
"#;
    let state = ServerState::new();
    let uri = tower_lsp::lsp_types::Url::parse("file:///test.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());

    let start = position_at(source, "Foo()");
    let end =
        super::lsp_utils::offset_to_position(source, (source.find("Foo()").unwrap() + 3) as u32);

    let diagnostic = tower_lsp::lsp_types::Diagnostic {
        range: tower_lsp::lsp_types::Range { start, end },
        severity: Some(tower_lsp::lsp_types::DiagnosticSeverity::ERROR),
        code: Some(tower_lsp::lsp_types::NumberOrString::String(
            "E105".to_string(),
        )),
        source: Some("trust-lsp".to_string()),
        message: "ambiguous reference to 'Foo'; qualify the name".to_string(),
        ..Default::default()
    };

    let params = tower_lsp::lsp_types::CodeActionParams {
        text_document: tower_lsp::lsp_types::TextDocumentIdentifier { uri: uri.clone() },
        range: diagnostic.range,
        context: tower_lsp::lsp_types::CodeActionContext {
            diagnostics: vec![diagnostic],
            only: None,
            trigger_kind: None,
        },
        work_done_progress_params: Default::default(),
        partial_result_params: Default::default(),
    };

    let actions = code_action(&state, params).expect("code actions");
    let mut titles = actions
        .iter()
        .filter_map(|action| match action {
            tower_lsp::lsp_types::CodeActionOrCommand::CodeAction(code_action) => {
                Some(code_action.title.as_str())
            }
            _ => None,
        })
        .collect::<Vec<_>>();
    titles.sort();
    assert!(
        titles.iter().any(|title| title.contains("LibA.Foo")),
        "expected LibA qualification quick fix"
    );
    assert!(
        titles.iter().any(|title| title.contains("LibB.Foo")),
        "expected LibB qualification quick fix"
    );
}

#[test]
fn lsp_code_action_namespace_disambiguation_project_using() {
    let lib_a = r#"
NAMESPACE LibA
FUNCTION Foo : INT
END_FUNCTION
END_NAMESPACE
"#;
    let lib_b = r#"
NAMESPACE LibB
FUNCTION Foo : INT
END_FUNCTION
END_NAMESPACE
"#;
    let main = r#"
USING LibA;
USING LibB;

PROGRAM Main
    VAR
        x : INT;
    END_VAR
    x := Foo();
END_PROGRAM
"#;
    let state = ServerState::new();
    let lib_a_uri = tower_lsp::lsp_types::Url::parse("file:///liba.st").unwrap();
    let lib_b_uri = tower_lsp::lsp_types::Url::parse("file:///libb.st").unwrap();
    let main_uri = tower_lsp::lsp_types::Url::parse("file:///main.st").unwrap();
    state.open_document(lib_a_uri, 1, lib_a.to_string());
    state.open_document(lib_b_uri, 1, lib_b.to_string());
    state.open_document(main_uri.clone(), 1, main.to_string());

    let start = position_at(main, "Foo()");
    let end = super::lsp_utils::offset_to_position(main, (main.find("Foo()").unwrap() + 3) as u32);

    let diagnostic = tower_lsp::lsp_types::Diagnostic {
        range: tower_lsp::lsp_types::Range { start, end },
        severity: Some(tower_lsp::lsp_types::DiagnosticSeverity::ERROR),
        code: Some(tower_lsp::lsp_types::NumberOrString::String(
            "E105".to_string(),
        )),
        source: Some("trust-lsp".to_string()),
        message: "ambiguous reference to 'Foo'; qualify the name".to_string(),
        ..Default::default()
    };

    let params = tower_lsp::lsp_types::CodeActionParams {
        text_document: tower_lsp::lsp_types::TextDocumentIdentifier { uri: main_uri },
        range: diagnostic.range,
        context: tower_lsp::lsp_types::CodeActionContext {
            diagnostics: vec![diagnostic],
            only: None,
            trigger_kind: None,
        },
        work_done_progress_params: Default::default(),
        partial_result_params: Default::default(),
    };

    let actions = code_action(&state, params).expect("code actions");
    let mut titles = actions
        .iter()
        .filter_map(|action| match action {
            tower_lsp::lsp_types::CodeActionOrCommand::CodeAction(code_action) => {
                Some(code_action.title.as_str())
            }
            _ => None,
        })
        .collect::<Vec<_>>();
    titles.sort();
    assert!(
        titles.iter().any(|title| title.contains("LibA.Foo")),
        "expected LibA qualification quick fix"
    );
    assert!(
        titles.iter().any(|title| title.contains("LibB.Foo")),
        "expected LibB qualification quick fix"
    );
}
