use super::*;

pub fn code_action(state: &ServerState, params: CodeActionParams) -> Option<CodeActionResponse> {
    let request_ticket = state.begin_semantic_request();
    code_action_with_ticket(state, params, request_ticket)
}

fn code_action_with_ticket(
    state: &ServerState,
    params: CodeActionParams,
    request_ticket: u64,
) -> Option<CodeActionResponse> {
    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }

    let uri = &params.text_document.uri;
    let doc = state.get_document(uri)?;
    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }
    let parsed = parse(&doc.content);
    let root = parsed.syntax();
    let mut actions = Vec::new();
    let target_range = params.range;
    let mut diagnostics = params.context.diagnostics.clone();
    let collected = collect_diagnostics_with_ticket(
        state,
        uri,
        &doc.content,
        doc.file_id,
        Some(request_ticket),
    );
    diagnostics.extend(collected);
    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }
    let mut seen = FxHashSet::default();
    diagnostics.retain(|diag| {
        let code = diagnostic_code(diag).unwrap_or_default();
        let key = (
            code,
            diag.range.start.line,
            diag.range.start.character,
            diag.range.end.line,
            diag.range.end.character,
            diag.message.clone(),
        );
        seen.insert(key)
    });
    diagnostics.retain(|diag| ranges_intersect(diag.range, target_range));

    for diagnostic in &diagnostics {
        if state.semantic_request_cancelled(request_ticket) {
            return None;
        }
        if let Some(edit) = external_fix_text_edit(diagnostic) {
            let title = external_fix_title(diagnostic);
            push_quickfix_action(&mut actions, &title, diagnostic, uri, edit);
            continue;
        }
        let code = diagnostic_code(diagnostic);
        match code.as_deref() {
            Some("W001") | Some("W002") => {
                let title = if code.as_deref() == Some("W001") {
                    "Remove unused variable"
                } else {
                    "Remove unused parameter"
                };
                let start = match position_to_offset(&doc.content, diagnostic.range.start) {
                    Some(offset) => offset,
                    None => continue,
                };
                let end = match position_to_offset(&doc.content, diagnostic.range.end) {
                    Some(offset) => offset,
                    None => continue,
                };
                let symbol_range = TextRange::new(TextSize::from(start), TextSize::from(end));
                let removal_range =
                    match unused_symbol_removal_range(&doc.content, &root, symbol_range) {
                        Some(range) => range,
                        None => continue,
                    };

                let edit = TextEdit {
                    range: Range {
                        start: offset_to_position(&doc.content, removal_range.start().into()),
                        end: offset_to_position(&doc.content, removal_range.end().into()),
                    },
                    new_text: String::new(),
                };

                let mut changes: std::collections::HashMap<Url, Vec<TextEdit>> =
                    std::collections::HashMap::new();
                changes.insert(uri.clone(), vec![edit]);

                let action = CodeAction {
                    title: title.to_string(),
                    kind: Some(CodeActionKind::QUICKFIX),
                    diagnostics: Some(vec![diagnostic.clone()]),
                    edit: Some(WorkspaceEdit {
                        changes: Some(changes),
                        document_changes: None,
                        change_annotations: None,
                    }),
                    is_preferred: Some(true),
                    ..Default::default()
                };

                actions.push(CodeActionOrCommand::CodeAction(action));
            }
            Some("E101") => {
                if let Some(edit) = missing_var_text_edit(state, &doc, &root, diagnostic) {
                    push_quickfix_action(
                        &mut actions,
                        "Create VAR declaration",
                        diagnostic,
                        uri,
                        edit,
                    );
                }
            }
            Some("E102") => {
                if let Some(edit) = missing_type_text_edit(&doc, &root, diagnostic) {
                    push_quickfix_action(
                        &mut actions,
                        "Create TYPE definition",
                        diagnostic,
                        uri,
                        edit,
                    );
                }
            }
            Some("E002") | Some("E003") => {
                if let Some(edit) = missing_end_text_edit(&doc, &root, diagnostic) {
                    push_quickfix_action(
                        &mut actions,
                        "Insert missing END_*",
                        diagnostic,
                        uri,
                        edit,
                    );
                }
            }
            Some("E205") => {
                if let Some(edit) = fix_output_binding_text_edit(&doc, &root, diagnostic) {
                    push_quickfix_action(
                        &mut actions,
                        "Fix output binding operator",
                        diagnostic,
                        uri,
                        edit,
                    );
                }
                if let Some(edits) = convert_call_style_text_edit(state, &doc, &root, diagnostic) {
                    for (title, edit) in edits {
                        push_quickfix_action(&mut actions, &title, diagnostic, uri, edit);
                    }
                }
            }
            Some("E105") => {
                let namespace_actions =
                    namespace_disambiguation_actions(state, &doc, &root, diagnostic);
                actions.extend(namespace_actions);
            }
            Some("E206") => {
                if let Some(edit) = missing_return_text_edit(state, &doc, &root, diagnostic) {
                    push_quickfix_action(
                        &mut actions,
                        "Insert missing RETURN",
                        diagnostic,
                        uri,
                        edit,
                    );
                }
            }
            Some("W004") => {
                let edit = match missing_else_text_edit(&doc.content, &root, diagnostic.range) {
                    Some(edit) => edit,
                    None => continue,
                };

                let mut changes: std::collections::HashMap<Url, Vec<TextEdit>> =
                    std::collections::HashMap::new();
                changes.insert(uri.clone(), vec![edit]);

                let action = CodeAction {
                    title: "Insert missing ELSE branch".to_string(),
                    kind: Some(CodeActionKind::QUICKFIX),
                    diagnostics: Some(vec![diagnostic.clone()]),
                    edit: Some(WorkspaceEdit {
                        changes: Some(changes),
                        document_changes: None,
                        change_annotations: None,
                    }),
                    is_preferred: Some(true),
                    ..Default::default()
                };

                actions.push(CodeActionOrCommand::CodeAction(action));
            }
            Some("W005") | Some("E203") => {
                if let Some(edit) = implicit_conversion_text_edit(&doc, &root, diagnostic) {
                    push_quickfix_action(
                        &mut actions,
                        "Wrap with conversion function",
                        diagnostic,
                        uri,
                        edit,
                    );
                }
            }
            _ => continue,
        }
    }

    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }
    if let Some(action) = interface_stub_action(state, &doc, &params) {
        actions.push(action);
    }

    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }
    if let Some(action) = inline_symbol_action(state, &doc, &params) {
        actions.push(action);
    }

    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }
    actions.extend(extract_actions(state, &doc, &params));

    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }
    if let Some(action) = convert_function_action(state, &doc, &params) {
        actions.push(action);
    }

    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }
    if let Some(action) = convert_function_block_action(state, &doc, &params) {
        actions.push(action);
    }

    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }
    if let Some(action) = namespace_move_action(&doc, &root, &params) {
        actions.push(action);
    }

    Some(actions)
}

pub fn rename(state: &ServerState, params: RenameParams) -> Option<WorkspaceEdit> {
    let request_ticket = state.begin_semantic_request();
    rename_with_ticket(state, params, request_ticket)
}

fn rename_with_ticket(
    state: &ServerState,
    params: RenameParams,
    request_ticket: u64,
) -> Option<WorkspaceEdit> {
    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }

    let uri = &params.text_document_position.text_document.uri;
    let position = params.text_document_position.position;
    let new_name = &params.new_name;

    let doc = state.get_document(uri)?;
    let offset = position_to_offset(&doc.content, position)?;

    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }

    let result = state
        .with_database(|db| trust_ide::rename(db, doc.file_id, TextSize::from(offset), new_name))?;

    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }

    let file_rename = maybe_rename_pou_file(state, doc.file_id, TextSize::from(offset), new_name);

    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }

    let changes = rename_result_to_changes(state, result)?;

    if state.semantic_request_cancelled(request_ticket) {
        return None;
    }

    if let Some(rename_op) = file_rename {
        let mut document_changes = changes_to_document_operations(state, changes);
        document_changes.push(DocumentChangeOperation::Op(ResourceOp::Rename(rename_op)));
        return Some(WorkspaceEdit {
            changes: None,
            document_changes: Some(DocumentChanges::Operations(document_changes)),
            change_annotations: None,
        });
    }

    Some(WorkspaceEdit {
        changes: Some(changes),
        document_changes: None,
        change_annotations: None,
    })
}

fn changes_to_document_operations(
    state: &ServerState,
    changes: std::collections::HashMap<Url, Vec<TextEdit>>,
) -> Vec<DocumentChangeOperation> {
    let mut entries: Vec<_> = changes.into_iter().collect();
    entries.sort_by_key(|(uri, _)| uri.to_string());

    let mut operations = Vec::new();
    for (uri, edits) in entries {
        let text_document = text_document_identifier_for_edit(state, &uri);
        let text_edits = edits.into_iter().map(OneOf::Left).collect();
        operations.push(DocumentChangeOperation::Edit(TextDocumentEdit {
            text_document,
            edits: text_edits,
        }));
    }
    operations
}

fn maybe_rename_pou_file(
    state: &ServerState,
    file_id: trust_hir::db::FileId,
    position: TextSize,
    new_name: &str,
) -> Option<RenameFile> {
    if new_name.contains('.') {
        return None;
    }

    let (pou_name, definition_file_id) = state.with_database(|db| {
        let definition = ide_goto_definition(db, file_id, position)?;
        let symbols = db.file_symbols(definition.file_id);
        let mut candidate = None;
        for symbol in symbols.iter() {
            if symbol.origin.is_some() || symbol.range.is_empty() {
                continue;
            }
            if !is_primary_pou_symbol_kind(&symbol.kind) {
                continue;
            }
            if candidate.is_some() {
                return None;
            }
            candidate = Some(symbol);
        }
        let symbol = candidate?;
        if symbol.range != definition.range {
            return None;
        }
        Some((symbol.name.to_string(), definition.file_id))
    })?;

    let doc = state.document_for_file_id(definition_file_id)?;
    let old_uri = doc.uri.clone();
    let old_stem = st_file_stem(&old_uri)?;
    if !pou_name.eq_ignore_ascii_case(&old_stem) {
        return None;
    }

    if !trust_hir::is_valid_identifier(new_name) || trust_hir::is_reserved_keyword(new_name) {
        return None;
    }

    if new_name.eq_ignore_ascii_case(&old_stem) {
        return None;
    }

    let old_path = uri_to_path(&old_uri);
    let extension = old_path
        .as_ref()
        .and_then(|path| path.extension().and_then(|ext| ext.to_str()))
        .or_else(|| {
            Path::new(old_uri.path())
                .extension()
                .and_then(|ext| ext.to_str())
        })?;
    let file_name = format!("{new_name}.{extension}");

    if let Some(path) = old_path.as_ref() {
        let new_path = path.with_file_name(&file_name);
        if &new_path == path || new_path.exists() {
            return None;
        }
        if let Some(new_uri) = path_to_uri(&new_path) {
            return Some(RenameFile {
                old_uri,
                new_uri,
                options: Some(RenameFileOptions {
                    overwrite: Some(false),
                    ignore_if_exists: Some(true),
                }),
                annotation_id: None,
            });
        }
    }

    let mut new_uri = old_uri.clone();
    {
        let mut segments = new_uri.path_segments_mut().ok()?;
        segments.pop_if_empty();
        segments.pop();
        segments.push(&file_name);
    }
    Some(RenameFile {
        old_uri,
        new_uri,
        options: Some(RenameFileOptions {
            overwrite: Some(false),
            ignore_if_exists: Some(true),
        }),
        annotation_id: None,
    })
}

pub fn prepare_rename(
    state: &ServerState,
    params: TextDocumentPositionParams,
) -> Option<PrepareRenameResponse> {
    let uri = &params.text_document.uri;
    let position = params.position;

    let doc = state.get_document(uri)?;
    let offset = position_to_offset(&doc.content, position)?;

    let range = state.with_database(|db| {
        trust_ide::rename::prepare_rename(db, doc.file_id, TextSize::from(offset))
    })?;

    Some(PrepareRenameResponse::Range(Range {
        start: offset_to_position(&doc.content, range.start().into()),
        end: offset_to_position(&doc.content, range.end().into()),
    }))
}
