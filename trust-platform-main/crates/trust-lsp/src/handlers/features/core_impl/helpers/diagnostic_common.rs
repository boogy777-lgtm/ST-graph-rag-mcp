//! Responsibility: focused helper module in the core LSP feature layer.
use super::*;

pub(in super::super) fn diagnostic_code(diagnostic: &Diagnostic) -> Option<String> {
    diagnostic.code.as_ref().map(|code| match code {
        NumberOrString::String(value) => value.clone(),
        NumberOrString::Number(value) => value.to_string(),
    })
}

pub(in super::super) fn push_quickfix_action(
    actions: &mut Vec<CodeActionOrCommand>,
    title: &str,
    diagnostic: &Diagnostic,
    uri: &Url,
    edit: TextEdit,
) {
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

pub(in super::super) fn extract_quoted_name(message: &str) -> Option<String> {
    if let Some(start) = message.find('\'') {
        let rest = &message[start + 1..];
        if let Some(end) = rest.find('\'') {
            return Some(rest[..end].to_string());
        }
    }

    let lower = message.to_ascii_lowercase();
    const MARKERS: [&str; 7] = [
        "ambiguous reference to ",
        "undefined function ",
        "undefined variable ",
        "undefined identifier ",
        "undefined type ",
        "unknown type ",
        "cannot resolve namespace ",
    ];
    for marker in MARKERS {
        if let Some(idx) = lower.find(marker) {
            let rest = &message[idx + marker.len()..];
            let mut name = String::new();
            for ch in rest.chars() {
                if ch.is_ascii_alphanumeric() || ch == '_' || ch == '.' {
                    name.push(ch);
                } else {
                    break;
                }
            }
            if !name.is_empty() {
                return Some(name);
            }
        }
    }

    None
}
