//! External library documentation ingestion (markdown headings).

use rustc_hash::FxHashMap;
use std::fs;

use crate::config::ProjectConfig;

pub(crate) fn library_doc_map(config: &ProjectConfig) -> FxHashMap<String, String> {
    let mut docs = FxHashMap::default();
    for lib in &config.libraries {
        for path in &lib.docs {
            if let Ok(contents) = fs::read_to_string(path) {
                parse_markdown_docs(&contents, &mut docs);
            }
        }
    }
    docs
}

fn parse_markdown_docs(contents: &str, docs: &mut FxHashMap<String, String>) {
    let mut current: Option<String> = None;
    let mut buffer: Vec<String> = Vec::new();

    let flush =
        |name: Option<String>, buffer: &mut Vec<String>, docs: &mut FxHashMap<String, String>| {
            let Some(name) = name else {
                buffer.clear();
                return;
            };
            let text = buffer.join("\n").trim().to_string();
            buffer.clear();
            if !text.is_empty() {
                docs.insert(name, text);
            }
        };

    for line in contents.lines() {
        let trimmed = line.trim_start();
        if let Some(stripped) = trimmed.strip_prefix('#') {
            let heading = stripped.trim_start_matches('#').trim();
            flush(current.take(), &mut buffer, docs);
            if !heading.is_empty() {
                current = Some(heading.to_ascii_uppercase());
            }
        } else {
            buffer.push(line.to_string());
        }
    }

    flush(current.take(), &mut buffer, docs);
}

pub(crate) fn doc_for_name<'a>(docs: &'a FxHashMap<String, String>, name: &str) -> Option<&'a str> {
    docs.get(&name.to_ascii_uppercase())
        .map(|value| value.as_str())
}
