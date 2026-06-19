use super::*;

#[test]
fn lsp_code_action_generate_interface_stubs() {
    let source = r#"
INTERFACE IControl
    METHOD Start
    END_METHOD
END_INTERFACE

CLASS Pump IMPLEMENTS IControl
END_CLASS
"#;
    let state = ServerState::new();
    let uri = tower_lsp::lsp_types::Url::parse("file:///test.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());

    let position = position_at(source, "IMPLEMENTS IControl");
    let params = tower_lsp::lsp_types::CodeActionParams {
        text_document: tower_lsp::lsp_types::TextDocumentIdentifier { uri: uri.clone() },
        range: tower_lsp::lsp_types::Range {
            start: position,
            end: position,
        },
        context: tower_lsp::lsp_types::CodeActionContext {
            diagnostics: Vec::new(),
            only: None,
            trigger_kind: None,
        },
        work_done_progress_params: Default::default(),
        partial_result_params: Default::default(),
    };

    let actions = code_action(&state, params).expect("code actions");
    let stub_action = actions.iter().find_map(|action| match action {
        tower_lsp::lsp_types::CodeActionOrCommand::CodeAction(code_action)
            if code_action.title.contains("interface stubs") =>
        {
            Some(code_action)
        }
        _ => None,
    });
    let stub_action = stub_action.expect("stub action");
    let edits = stub_action
        .edit
        .as_ref()
        .and_then(|edit| edit.changes.as_ref())
        .and_then(|changes| changes.get(&uri))
        .expect("stub edits");
    assert!(edits
        .iter()
        .any(|edit| edit.new_text.contains("METHOD PUBLIC Start")));
}

#[test]
fn lsp_code_action_inline_variable() {
    let source = r#"
PROGRAM Test
    VAR
        x : INT := 1 + 2;
    END_VAR
    y := x;
END_PROGRAM
"#;
    let state = ServerState::new();
    let uri = tower_lsp::lsp_types::Url::parse("file:///test.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());

    let position = position_at(source, "x;");
    let params = tower_lsp::lsp_types::CodeActionParams {
        text_document: tower_lsp::lsp_types::TextDocumentIdentifier { uri: uri.clone() },
        range: tower_lsp::lsp_types::Range {
            start: position,
            end: position,
        },
        context: tower_lsp::lsp_types::CodeActionContext {
            diagnostics: Vec::new(),
            only: None,
            trigger_kind: None,
        },
        work_done_progress_params: Default::default(),
        partial_result_params: Default::default(),
    };

    let actions = code_action(&state, params).expect("code actions");
    let inline_action = actions.iter().find_map(|action| match action {
        tower_lsp::lsp_types::CodeActionOrCommand::CodeAction(code_action)
            if code_action.title.contains("Inline variable") =>
        {
            Some(code_action)
        }
        _ => None,
    });
    let inline_action = inline_action.expect("inline action");
    let edits = inline_action
        .edit
        .as_ref()
        .and_then(|edit| edit.changes.as_ref())
        .and_then(|changes| changes.get(&uri))
        .expect("inline edits");
    assert!(edits.iter().any(|edit| edit.new_text.contains("1 + 2")));
}

#[test]
fn lsp_code_action_extract_method() {
    let source = r#"
CLASS Controller
    METHOD Run
        x := 1;
        y := 2;
    END_METHOD
END_CLASS
"#;
    let state = ServerState::new();
    let uri = tower_lsp::lsp_types::Url::parse("file:///test.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());

    let start_offset = source.find("x := 1;").expect("start");
    let end_offset = source.find("y := 2;").expect("end") + "y := 2;".len();
    let range = tower_lsp::lsp_types::Range {
        start: super::lsp_utils::offset_to_position(source, start_offset as u32),
        end: super::lsp_utils::offset_to_position(source, end_offset as u32),
    };
    let params = tower_lsp::lsp_types::CodeActionParams {
        text_document: tower_lsp::lsp_types::TextDocumentIdentifier { uri: uri.clone() },
        range,
        context: tower_lsp::lsp_types::CodeActionContext {
            diagnostics: Vec::new(),
            only: Some(vec![tower_lsp::lsp_types::CodeActionKind::REFACTOR_EXTRACT]),
            trigger_kind: None,
        },
        work_done_progress_params: Default::default(),
        partial_result_params: Default::default(),
    };

    let actions = code_action(&state, params).expect("code actions");
    let extract_action = actions.iter().find_map(|action| match action {
        tower_lsp::lsp_types::CodeActionOrCommand::CodeAction(code_action)
            if code_action.title.contains("Extract method") =>
        {
            Some(code_action)
        }
        _ => None,
    });
    let extract_action = extract_action.expect("extract action");
    let edits = extract_action
        .edit
        .as_ref()
        .and_then(|edit| edit.changes.as_ref())
        .and_then(|changes| changes.get(&uri))
        .expect("extract edits");
    assert!(edits
        .iter()
        .any(|edit| edit.new_text.contains("METHOD ExtractedMethod")));
}

#[test]
fn lsp_code_action_convert_function_to_function_block() {
    let source = r#"
FUNCTION Foo : INT
    Foo := 1;
END_FUNCTION

PROGRAM Main
    Foo();
END_PROGRAM
"#;
    let state = ServerState::new();
    let uri = tower_lsp::lsp_types::Url::parse("file:///test.st").unwrap();
    state.open_document(uri.clone(), 1, source.to_string());

    let position = position_at(source, "FUNCTION Foo");
    let params = tower_lsp::lsp_types::CodeActionParams {
        text_document: tower_lsp::lsp_types::TextDocumentIdentifier { uri: uri.clone() },
        range: tower_lsp::lsp_types::Range {
            start: position,
            end: position,
        },
        context: tower_lsp::lsp_types::CodeActionContext {
            diagnostics: Vec::new(),
            only: Some(vec![tower_lsp::lsp_types::CodeActionKind::REFACTOR_REWRITE]),
            trigger_kind: None,
        },
        work_done_progress_params: Default::default(),
        partial_result_params: Default::default(),
    };

    let actions = code_action(&state, params).expect("code actions");
    let convert_action = actions.iter().find_map(|action| match action {
        tower_lsp::lsp_types::CodeActionOrCommand::CodeAction(code_action)
            if code_action
                .title
                .contains("Convert FUNCTION to FUNCTION_BLOCK") =>
        {
            Some(code_action)
        }
        _ => None,
    });
    let convert_action = convert_action.expect("convert action");
    let edits = convert_action
        .edit
        .as_ref()
        .and_then(|edit| edit.changes.as_ref())
        .and_then(|changes| changes.get(&uri))
        .expect("convert edits");
    assert!(edits
        .iter()
        .any(|edit| edit.new_text.contains("FUNCTION_BLOCK")));
    assert!(edits
        .iter()
        .any(|edit| edit.new_text.contains("FooInstance")));
}
