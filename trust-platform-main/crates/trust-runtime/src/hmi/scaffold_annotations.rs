fn normalize_symbol_key(program: &str, variable: &str) -> String {
    format!(
        "{}.{}",
        program.trim().to_ascii_uppercase(),
        variable.trim().to_ascii_uppercase()
    )
}

pub(super) fn parse_annotations(
    sources: &[HmiSourceRef<'_>],
) -> BTreeMap<String, HmiWidgetOverride> {
    let mut overrides = BTreeMap::new();
    for source in sources {
        parse_annotations_in_source(source.text, &mut overrides);
    }
    overrides
}

fn parse_annotations_in_source(source: &str, out: &mut BTreeMap<String, HmiWidgetOverride>) {
    let mut scope = AnnotationScope::None;
    let mut in_var_block = false;
    let mut global_var_block = false;
    let mut pending: Option<HmiWidgetOverride> = None;

    for raw_line in source.lines() {
        let line = raw_line.trim();
        let upper = line.to_ascii_uppercase();

        if let Some(program_name) = parse_program_header(line) {
            scope = AnnotationScope::Program(program_name);
            in_var_block = false;
            global_var_block = false;
            pending = None;
            continue;
        }
        if upper.starts_with("END_PROGRAM") {
            scope = AnnotationScope::None;
            in_var_block = false;
            global_var_block = false;
            pending = None;
            continue;
        }
        if upper.starts_with("VAR_GLOBAL") {
            in_var_block = true;
            global_var_block = true;
        } else if upper.starts_with("VAR") {
            in_var_block = true;
            global_var_block = false;
        } else if upper.starts_with("END_VAR") {
            in_var_block = false;
            global_var_block = false;
            pending = None;
            continue;
        }

        let inline = parse_hmi_annotation_from_line(line);
        let var_name = parse_var_name(line);

        if let Some(var_name) = var_name {
            let mut merged = pending.take().unwrap_or_default();
            if let Some(inline) = inline {
                merged.merge_from(&inline);
            }
            if merged.is_empty() {
                continue;
            }
            let key = match (&scope, global_var_block) {
                (_, true) => format!("global.{var_name}"),
                (AnnotationScope::Program(program_name), false) => {
                    format!("{program_name}.{var_name}")
                }
                _ => format!("global.{var_name}"),
            };
            out.insert(key, merged);
            continue;
        }

        if inline.is_some() && in_var_block {
            pending = inline;
        }
    }
}

fn parse_program_header(line: &str) -> Option<String> {
    let mut parts = line.split_whitespace();
    let keyword = parts.next()?;
    if !keyword.eq_ignore_ascii_case("PROGRAM") {
        return None;
    }
    let name = parts.next()?.trim_end_matches(';').trim();
    if name.is_empty() || !is_identifier(name) {
        return None;
    }
    Some(name.to_string())
}

fn parse_var_name(line: &str) -> Option<String> {
    let mut text = line;
    if let Some(index) = text.find("//") {
        text = &text[..index];
    }
    if let Some(index) = text.find("(*") {
        text = &text[..index];
    }
    let left = text.split(':').next()?.trim();
    if left.is_empty() {
        return None;
    }
    let candidate = left
        .split(|ch: char| ch.is_whitespace() || ch == ',')
        .find(|token| !token.is_empty())?;
    if !is_identifier(candidate) {
        return None;
    }
    Some(candidate.to_string())
}

fn parse_hmi_annotation_from_line(line: &str) -> Option<HmiWidgetOverride> {
    let lower = line.to_ascii_lowercase();
    let marker = lower.find("@hmi(")?;
    let start = marker + "@hmi(".len();
    let tail = &line[start..];
    let mut depth = 1usize;
    let mut end_index = None;
    for (idx, ch) in tail.char_indices() {
        match ch {
            '(' => depth += 1,
            ')' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    end_index = Some(idx);
                    break;
                }
            }
            _ => {}
        }
    }
    let end = end_index?;
    let payload = &tail[..end];
    parse_hmi_annotation_payload(payload)
}

pub(super) fn parse_hmi_annotation_payload(payload: &str) -> Option<HmiWidgetOverride> {
    let mut override_spec = HmiWidgetOverride::default();
    for part in split_csv(payload) {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }
        let (key, raw_value) = trimmed.split_once('=')?;
        let key = key.trim().to_ascii_lowercase();
        let raw_value = raw_value.trim();
        match key.as_str() {
            "label" => override_spec.label = parse_annotation_string(raw_value),
            "unit" => override_spec.unit = parse_annotation_string(raw_value),
            "widget" => override_spec.widget = parse_annotation_string(raw_value),
            "page" => override_spec.page = parse_annotation_string(raw_value),
            "group" => override_spec.group = parse_annotation_string(raw_value),
            "min" => override_spec.min = raw_value.parse::<f64>().ok(),
            "max" => override_spec.max = raw_value.parse::<f64>().ok(),
            "order" => override_spec.order = raw_value.parse::<i32>().ok(),
            _ => {}
        }
    }
    if override_spec.is_empty() {
        None
    } else {
        Some(override_spec)
    }
}

fn split_csv(text: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut in_quotes: Option<char> = None;
    for ch in text.chars() {
        match ch {
            '"' | '\'' => {
                if in_quotes == Some(ch) {
                    in_quotes = None;
                } else if in_quotes.is_none() {
                    in_quotes = Some(ch);
                }
                current.push(ch);
            }
            ',' if in_quotes.is_none() => {
                parts.push(current.trim().to_string());
                current.clear();
            }
            _ => current.push(ch),
        }
    }
    if !current.trim().is_empty() {
        parts.push(current.trim().to_string());
    }
    parts
}

fn parse_annotation_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    if (trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('\'') && trimmed.ends_with('\''))
    {
        return Some(trimmed[1..trimmed.len().saturating_sub(1)].to_string());
    }
    Some(trimmed.to_string())
}

fn is_identifier(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !(first.is_ascii_alphabetic() || first == '_') {
        return false;
    }
    chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
}

pub(super) fn title_case(value: &str) -> String {
    value
        .split(|ch: char| ch == '_' || ch == '-' || ch.is_whitespace())
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            let Some(first) = chars.next() else {
                return String::new();
            };
            let mut title = String::new();
            title.push(first.to_ascii_uppercase());
            title.push_str(&chars.as_str().to_ascii_lowercase());
            title
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub(super) fn is_hex_color(value: &str) -> bool {
    let bytes = value.as_bytes();
    if !(bytes.len() == 7 || bytes.len() == 4) {
        return false;
    }
    if bytes.first().copied() != Some(b'#') {
        return false;
    }
    bytes[1..].iter().all(|byte| byte.is_ascii_hexdigit())
}

#[derive(Debug, Clone)]
enum AnnotationScope {
    Program(String),
    None,
}
