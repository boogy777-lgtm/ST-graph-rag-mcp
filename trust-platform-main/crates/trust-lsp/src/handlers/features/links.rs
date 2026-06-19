use std::path::{Path, PathBuf};

use text_size::TextRange;
use tower_lsp::lsp_types::{DocumentLink, DocumentLinkParams, Range, Url};

use crate::config::{find_config_file, CONFIG_FILES};
use crate::state::{path_to_uri, uri_to_path, ServerState};

use super::super::lsp_utils::offset_to_position;

pub fn document_link(state: &ServerState, params: DocumentLinkParams) -> Option<Vec<DocumentLink>> {
    let uri = &params.text_document.uri;
    let doc = state.get_document(uri)?;

    let mut links = Vec::new();
    let config_root = config_root_for_uri(state, uri)
        .or_else(|| uri_to_path(uri).and_then(|path| path.parent().map(Path::to_path_buf)));

    if let Some(path) = uri_to_path(uri) {
        if is_config_file(&path) {
            let root = config_root
                .clone()
                .or_else(|| path.parent().map(Path::to_path_buf))
                .unwrap_or_else(|| path.clone());
            links.extend(document_links_for_config_paths(&doc.content, &root));
        } else if is_st_file(&path) {
            links.extend(document_links_for_using(state, &doc));
        }
    }

    if let Some(root) = config_root {
        links.extend(document_links_for_config_mentions(&doc.content, &root));
    }

    Some(links)
}

fn document_links_for_using(
    state: &ServerState,
    doc: &crate::state::Document,
) -> Vec<DocumentLink> {
    let entries = state.with_database(|db| {
        let symbols = db.file_symbols_with_project(doc.file_id);
        let mut entries = Vec::new();
        for scope in symbols.scopes() {
            for using in &scope.using_directives {
                if using.range.is_empty() || using.path.is_empty() {
                    continue;
                }
                let Some(symbol_id) = symbols.resolve_qualified(&using.path) else {
                    continue;
                };
                let Some(symbol) = symbols.get(symbol_id) else {
                    continue;
                };
                let file_id = symbol
                    .origin
                    .map(|origin| origin.file_id)
                    .unwrap_or(doc.file_id);
                entries.push((using.range, file_id));
            }
        }
        entries
    });

    let mut links = Vec::new();
    for (range, file_id) in entries {
        let Some(target_doc) = state.document_for_file_id(file_id) else {
            continue;
        };
        links.push(DocumentLink {
            range: text_range_to_lsp(&doc.content, range),
            target: Some(target_doc.uri),
            tooltip: Some("Open namespace definition".to_string()),
            data: None,
        });
    }
    links
}

fn document_links_for_config_paths(source: &str, root: &Path) -> Vec<DocumentLink> {
    let mut links = Vec::new();
    let mut in_library_block = false;
    let mut offset = 0usize;

    for line in source.split_inclusive('\n') {
        let line_no_newline = line.strip_suffix('\n').unwrap_or(line);
        let line_text = line_no_newline
            .strip_suffix('\r')
            .unwrap_or(line_no_newline);
        let trimmed = line_text.trim();

        if trimmed.starts_with('[') {
            in_library_block = trimmed == "[[libraries]]";
        }

        if let Some((key, value)) = line_text.split_once('=') {
            let key = key.trim();
            let value_start = line_text.find(value).unwrap_or(key.len() + 1);
            let should_scan = key == "include_paths"
                || key == "library_paths"
                || (in_library_block && key == "path");
            if should_scan {
                for (start, end, text) in extract_string_literals(value) {
                    let value_start_offset = offset + value_start;
                    let abs_start = value_start_offset + start;
                    let abs_end = value_start_offset + end;
                    let target =
                        resolve_config_path(root, &text).and_then(|path| path_to_uri(&path));
                    let Some(target) = target else {
                        continue;
                    };
                    links.push(DocumentLink {
                        range: Range {
                            start: offset_to_position(source, abs_start as u32),
                            end: offset_to_position(source, abs_end as u32),
                        },
                        target: Some(target),
                        tooltip: Some("Open config path".to_string()),
                        data: None,
                    });
                }
            }
        }

        offset = offset.saturating_add(line.len());
    }

    links
}

fn document_links_for_config_mentions(source: &str, root: &Path) -> Vec<DocumentLink> {
    let Some(config_path) = find_config_file(root) else {
        return Vec::new();
    };
    let Some(target) = path_to_uri(&config_path) else {
        return Vec::new();
    };

    let mut links = Vec::new();
    for name in CONFIG_FILES {
        let mut search_start = 0usize;
        while let Some(pos) = source[search_start..].find(name) {
            let start = search_start + pos;
            let end = start + name.len();
            links.push(DocumentLink {
                range: Range {
                    start: offset_to_position(source, start as u32),
                    end: offset_to_position(source, end as u32),
                },
                target: Some(target.clone()),
                tooltip: Some("Open trust-lsp config".to_string()),
                data: None,
            });
            search_start = end;
        }
    }
    links
}

fn extract_string_literals(value: &str) -> Vec<(usize, usize, String)> {
    let mut results = Vec::new();
    let mut in_string: Option<char> = None;
    let mut start = 0usize;
    let mut escaped = false;

    for (idx, ch) in value.char_indices() {
        if let Some(delim) = in_string {
            if delim == '"' && escaped {
                escaped = false;
                continue;
            }
            if delim == '"' && ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == delim {
                let content_start = start + 1;
                if idx >= content_start {
                    let text = value[content_start..idx].to_string();
                    results.push((content_start, idx, text));
                }
                in_string = None;
            }
        } else if ch == '"' || ch == '\'' {
            in_string = Some(ch);
            start = idx;
            escaped = false;
        }
    }

    results
}

fn resolve_config_path(root: &Path, entry: &str) -> Option<PathBuf> {
    if entry.is_empty() {
        return None;
    }
    let path = PathBuf::from(entry);
    if path.is_absolute() {
        Some(path)
    } else {
        Some(root.join(path))
    }
}

fn config_root_for_uri(state: &ServerState, uri: &Url) -> Option<PathBuf> {
    state
        .workspace_config_for_uri(uri)
        .map(|config| config.root)
        .or_else(|| uri_to_path(uri).and_then(|path| path.parent().map(Path::to_path_buf)))
}

fn is_st_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "st" | "pou"))
        .unwrap_or(false)
}

fn is_config_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| CONFIG_FILES.iter().any(|candidate| candidate == &name))
        .unwrap_or(false)
}

fn text_range_to_lsp(source: &str, range: TextRange) -> Range {
    Range {
        start: offset_to_position(source, range.start().into()),
        end: offset_to_position(source, range.end().into()),
    }
}
