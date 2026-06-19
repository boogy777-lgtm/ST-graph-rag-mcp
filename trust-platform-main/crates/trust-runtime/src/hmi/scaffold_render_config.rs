fn render_trends_toml(signals: &[String]) -> String {
    let mut out = String::new();
    let _ = writeln!(out, "title = \"Trends\"");
    let _ = writeln!(out, "kind = \"trend\"");
    let _ = writeln!(out, "icon = \"line-chart\"");
    let _ = writeln!(out, "order = 50");
    let _ = writeln!(out, "duration_s = 600");
    if signals.is_empty() {
        let _ = writeln!(out, "signals = []");
    } else {
        let formatted = signals
            .iter()
            .take(8)
            .map(|signal| format!("\"{}\"", escape_toml_string(signal)))
            .collect::<Vec<_>>()
            .join(", ");
        let _ = writeln!(out, "signals = [{formatted}]");
    }
    out
}

fn render_alarms_toml() -> String {
    let mut out = String::new();
    let _ = writeln!(out, "title = \"Alarms\"");
    let _ = writeln!(out, "kind = \"alarm\"");
    let _ = writeln!(out, "icon = \"bell\"");
    let _ = writeln!(out, "order = 60");
    out
}

fn render_config_toml(
    style: &str,
    accent: &str,
    header_title: &str,
    alarms: &[(String, String, f64, f64, Option<f64>)],
) -> String {
    let mut out = String::new();
    let _ = writeln!(out, "version = {HMI_DESCRIPTOR_VERSION}");
    let _ = writeln!(out);
    let _ = writeln!(out, "[theme]");
    let _ = writeln!(out, "style = \"{}\"", escape_toml_string(style));
    let _ = writeln!(out, "accent = \"{}\"", escape_toml_string(accent));
    let _ = writeln!(out);
    let _ = writeln!(out, "[layout]");
    let _ = writeln!(out, "navigation = \"sidebar-left\"");
    let _ = writeln!(out, "header = true");
    let _ = writeln!(
        out,
        "header_title = \"{}\"",
        escape_toml_string(header_title)
    );
    let _ = writeln!(out);
    let _ = writeln!(out, "[write]");
    let _ = writeln!(out, "enabled = false");
    let _ = writeln!(out, "allow = []");

    for (bind, label, low, high, deadband) in alarms {
        let _ = writeln!(out);
        let _ = writeln!(out, "[[alarm]]");
        let _ = writeln!(out, "bind = \"{}\"", escape_toml_string(bind));
        let _ = writeln!(out, "high = {}", format_toml_number(*high));
        let _ = writeln!(out, "low = {}", format_toml_number(*low));
        if let Some(deadband) = deadband {
            let _ = writeln!(out, "deadband = {}", format_toml_number(*deadband));
        }
        let _ = writeln!(out, "inferred = true");
        let _ = writeln!(out, "label = \"{}\"", escape_toml_string(label));
    }

    out
}

pub(super) fn format_toml_number(value: f64) -> String {
    if (value.fract()).abs() < f64::EPSILON {
        format!("{value:.0}")
    } else {
        let mut text = format!("{value:.3}");
        while text.ends_with('0') {
            let _ = text.pop();
        }
        if text.ends_with('.') {
            text.push('0');
        }
        text
    }
}

