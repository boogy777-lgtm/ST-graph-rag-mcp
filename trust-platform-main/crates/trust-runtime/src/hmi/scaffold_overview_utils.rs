fn select_scaffold_trend_signals(points: &[ScaffoldPoint]) -> Vec<String> {
    let mut scored = points
        .iter()
        .filter(|point| point.type_bucket == ScaffoldTypeBucket::Numeric)
        .map(|point| {
            let name = format!(
                "{} {} {}",
                point.path.to_ascii_lowercase(),
                point.raw_name.to_ascii_lowercase(),
                point.label.to_ascii_lowercase()
            );
            let mut score = 0_i32;
            if contains_any(
                name.as_str(),
                &[
                    "flow",
                    "pressure",
                    "temp",
                    "temperature",
                    "level",
                    "speed",
                    "rpm",
                    "deviation",
                    "error",
                ],
            ) {
                score += 50;
            }
            if contains_any(name.as_str(), &["setpoint", "sp"]) {
                score += 18;
            }
            if contains_any(
                name.as_str(),
                &[
                    "cmd", "command", "mode", "counter", "tick", "scan", "uptime", "config",
                    "limit",
                ],
            ) {
                score -= 28;
            }
            if point.writable {
                score -= 16;
            }
            if point.unit.is_some() {
                score += 5;
            }
            (score, point.path.clone())
        })
        .collect::<Vec<_>>();
    scored.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| left.1.cmp(&right.1)));

    let target = scored.len().clamp(0, 8);
    let mut selected = scored
        .into_iter()
        .take(target)
        .map(|(_, path)| path)
        .collect::<Vec<_>>();
    selected.sort();
    selected.dedup();
    selected
}

fn contains_any(haystack: &str, hints: &[&str]) -> bool {
    hints
        .iter()
        .any(|hint| haystack.contains(&hint.to_ascii_lowercase()))
}

fn overview_widget_span(point: &ScaffoldPoint, tier: Option<&str>) -> u32 {
    if tier == Some("module") {
        return 3;
    }
    match classify_overview_category(point) {
        ScaffoldOverviewCategory::SafetyAlarm => 2,
        ScaffoldOverviewCategory::CommandMode => 2,
        ScaffoldOverviewCategory::Kpi => 4,
        ScaffoldOverviewCategory::Deviation => 3,
        ScaffoldOverviewCategory::Inventory => 4,
        ScaffoldOverviewCategory::Diagnostic => 3,
    }
}

/// Extract an equipment-instance prefix from a variable name.
///
/// Looks for patterns like `pump1_speed`, `tank_001_level`, `valve2_state` –
/// i.e. a word followed by digits, then an underscore separator.  Returns
/// `None` when no recognisable equipment prefix is found.
fn infer_instance_prefix(raw_name: &str) -> Option<String> {
    let name = raw_name.to_ascii_lowercase();
    let bytes = name.as_bytes();
    // Phase 1: consume leading alphabetic chars
    let mut i = 0;
    while i < bytes.len() && bytes[i].is_ascii_lowercase() {
        i += 1;
    }
    if i == 0 {
        return None;
    }
    // Allow an optional underscore before digits (e.g. "tank_001_")
    let alpha_end = i;
    if i < bytes.len() && bytes[i] == b'_' {
        i += 1;
    }
    // Phase 2: consume digits
    let digit_start = i;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
    }
    if i == digit_start {
        return None; // no digits found
    }
    // Phase 3: must be followed by '_' or a capital letter (camelCase)
    if i >= bytes.len() {
        return None; // digits at end of name, no suffix
    }
    if bytes[i] == b'_' && i + 1 < bytes.len() {
        return Some(name[..i].to_string());
    }
    // camelCase: original name must have uppercase after digit run
    let orig_bytes = raw_name.as_bytes();
    if i < orig_bytes.len() && orig_bytes[i].is_ascii_uppercase() {
        return Some(name[..alpha_end].to_string() + &name[alpha_end..i]);
    }
    None
}

