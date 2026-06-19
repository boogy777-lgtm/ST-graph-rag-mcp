fn widget_for_scaffold_type(ty: &Type, writable: bool, qualifier: SourceVarKind) -> &'static str {
    if !writable
        && matches!(qualifier, SourceVarKind::Output | SourceVarKind::Global)
        && matches!(ty, Type::Real | Type::LReal)
    {
        return "gauge";
    }
    widget_for_type(ty, writable)
}

fn widget_for_scaffold_value(value: &Value) -> &'static str {
    match value {
        Value::Real(_) | Value::LReal(_) => "gauge",
        _ => widget_for_value(value, false),
    }
}

fn enum_values_for_type(ty: &Type) -> Vec<String> {
    match ty {
        Type::Enum { values, .. } => values.iter().map(|(name, _)| name.to_string()).collect(),
        _ => Vec::new(),
    }
}

fn scaffold_type_bucket_for_type(ty: &Type) -> ScaffoldTypeBucket {
    match ty {
        Type::Bool => ScaffoldTypeBucket::Bool,
        ty if ty.is_numeric() || ty.is_bit_string() || ty.is_time() => ScaffoldTypeBucket::Numeric,
        ty if ty.is_string() || ty.is_char() => ScaffoldTypeBucket::Text,
        Type::Array { .. }
        | Type::Struct { .. }
        | Type::Union { .. }
        | Type::FunctionBlock { .. }
        | Type::Class { .. }
        | Type::Interface { .. } => ScaffoldTypeBucket::Composite,
        _ => ScaffoldTypeBucket::Other,
    }
}

fn scaffold_type_bucket_for_value(value: &Value, data_type: &str) -> ScaffoldTypeBucket {
    match value {
        Value::Bool(_) => ScaffoldTypeBucket::Bool,
        Value::SInt(_)
        | Value::Int(_)
        | Value::DInt(_)
        | Value::LInt(_)
        | Value::USInt(_)
        | Value::UInt(_)
        | Value::UDInt(_)
        | Value::ULInt(_)
        | Value::Byte(_)
        | Value::Word(_)
        | Value::DWord(_)
        | Value::LWord(_)
        | Value::Real(_)
        | Value::LReal(_)
        | Value::Time(_)
        | Value::LTime(_)
        | Value::Date(_)
        | Value::LDate(_)
        | Value::Tod(_)
        | Value::LTod(_)
        | Value::Dt(_)
        | Value::Ldt(_) => ScaffoldTypeBucket::Numeric,
        Value::String(_) | Value::WString(_) | Value::Char(_) | Value::WChar(_) => {
            ScaffoldTypeBucket::Text
        }
        Value::Array(_) | Value::Struct(_) => ScaffoldTypeBucket::Composite,
        _ if is_numeric_data_type(data_type) => ScaffoldTypeBucket::Numeric,
        _ => ScaffoldTypeBucket::Other,
    }
}

fn infer_unit_and_range(
    path: &str,
    data_type: &str,
    type_bucket: ScaffoldTypeBucket,
) -> (Option<String>, Option<f64>, Option<f64>) {
    if type_bucket != ScaffoldTypeBucket::Numeric && !is_numeric_data_type(data_type) {
        return (None, None, None);
    }

    let name = path.to_ascii_lowercase();
    if name.contains("rpm") || name.contains("speed") {
        return (Some("rpm".to_string()), Some(0.0), Some(3600.0));
    }
    if name.contains("pressure") || name.contains("bar") {
        return (Some("bar".to_string()), Some(0.0), Some(16.0));
    }
    if name.contains("temp") || name.contains("temperature") {
        return (Some("C".to_string()), Some(0.0), Some(120.0));
    }
    if name.contains("level") || name.contains("percent") || name.contains('%') {
        return (Some("%".to_string()), Some(0.0), Some(100.0));
    }
    if name.contains("flow") {
        return (Some("l/min".to_string()), Some(0.0), Some(500.0));
    }

    (None, Some(0.0), Some(100.0))
}

fn infer_icon_for_points(points: &[ScaffoldPoint]) -> String {
    for point in points {
        let name = point.path.to_ascii_lowercase();
        if name.contains("pump") || name.contains("motor") {
            return "activity".to_string();
        }
        if name.contains("valve") {
            return "sliders".to_string();
        }
        if name.contains("tank") || name.contains("level") {
            return "droplets".to_string();
        }
        if name.contains("temp") {
            return "thermometer".to_string();
        }
        if name.contains("pressure") {
            return "gauge".to_string();
        }
    }
    "activity".to_string()
}

fn infer_label(raw: &str) -> String {
    let mut normalized = String::new();
    let mut prev_was_lower = false;
    for ch in raw.chars() {
        if ch == '_' || ch == '-' || ch == '.' {
            normalized.push(' ');
            prev_was_lower = false;
            continue;
        }
        if ch.is_ascii_uppercase() && prev_was_lower {
            normalized.push(' ');
        }
        normalized.push(ch);
        prev_was_lower = ch.is_ascii_lowercase() || ch.is_ascii_digit();
    }

    normalized
        .split_whitespace()
        .map(expand_label_token)
        .collect::<Vec<_>>()
        .join(" ")
}

fn expand_label_token(token: &str) -> String {
    let lower = token.to_ascii_lowercase();
    match lower.as_str() {
        "sp" => "Setpoint".to_string(),
        "pv" => "Process Value".to_string(),
        "temp" | "tmp" => "Temperature".to_string(),
        "cmd" => "Command".to_string(),
        "rpm" => "RPM".to_string(),
        "pid" => "PID".to_string(),
        _ => {
            if lower.len() <= 3 && lower.chars().all(|ch| ch.is_ascii_alphanumeric()) {
                token.to_ascii_uppercase()
            } else {
                title_case(token)
            }
        }
    }
}

pub(super) fn escape_toml_string(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', " ")
}

pub(super) fn collect_source_symbol_index(sources: &[HmiSourceRef<'_>]) -> SourceSymbolIndex {
    let mut index = SourceSymbolIndex::default();
    for source in sources {
        collect_source_symbols_in_file(source.path, source.text, &mut index);
    }
    index
}

fn collect_source_symbols_in_file(path: &Path, source: &str, out: &mut SourceSymbolIndex) {
    let path_text = path.to_string_lossy().to_string();
    let mut current_program: Option<String> = None;
    let mut current_kind: Option<SourceVarKind> = None;

    for raw_line in source.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(program_name) = parse_program_header(line) {
            out.program_files
                .entry(program_name.to_ascii_uppercase())
                .or_insert_with(|| path_text.clone());
            current_program = Some(program_name);
            current_kind = None;
            continue;
        }
        let upper = line.to_ascii_uppercase();
        if upper.starts_with("END_PROGRAM") {
            current_program = None;
            current_kind = None;
            continue;
        }
        if upper.starts_with("END_VAR") {
            current_kind = None;
            continue;
        }
        if let Some(kind) = parse_source_var_block_kind(line) {
            current_kind = Some(kind);
            continue;
        }
        let Some(kind) = current_kind else {
            continue;
        };
        let names = parse_var_names(line);
        if names.is_empty() {
            continue;
        }
        for name in names {
            match (kind, current_program.as_ref()) {
                (SourceVarKind::Global | SourceVarKind::External, _) => {
                    out.globals.insert(name.to_ascii_uppercase());
                }
                (_, Some(program_name)) => {
                    out.programs_with_entries
                        .insert(program_name.to_ascii_uppercase());
                    out.program_vars.insert(
                        normalize_symbol_key(program_name.as_str(), name.as_str()),
                        kind,
                    );
                }
                _ => {}
            }
        }
    }
}

fn parse_source_var_block_kind(line: &str) -> Option<SourceVarKind> {
    let upper = line.trim().to_ascii_uppercase();
    if upper.starts_with("VAR_IN_OUT") {
        return Some(SourceVarKind::InOut);
    }
    if upper.starts_with("VAR_INPUT") {
        return Some(SourceVarKind::Input);
    }
    if upper.starts_with("VAR_OUTPUT") {
        return Some(SourceVarKind::Output);
    }
    if upper.starts_with("VAR_GLOBAL") {
        return Some(SourceVarKind::Global);
    }
    if upper.starts_with("VAR_EXTERNAL") {
        return Some(SourceVarKind::External);
    }
    if upper.starts_with("VAR_TEMP") {
        return Some(SourceVarKind::Temp);
    }
    if upper.starts_with("VAR") {
        return Some(SourceVarKind::Var);
    }
    None
}

fn parse_var_names(line: &str) -> Vec<String> {
    let mut text = line;
    if let Some(index) = text.find("//") {
        text = &text[..index];
    }
    if let Some(index) = text.find("(*") {
        text = &text[..index];
    }
    if !text.contains(':') {
        return Vec::new();
    }
    let Some(left) = text.split(':').next() else {
        return Vec::new();
    };
    left.split(',')
        .map(str::trim)
        .filter(|candidate| is_identifier(candidate))
        .map(ToString::to_string)
        .collect::<Vec<_>>()
}

