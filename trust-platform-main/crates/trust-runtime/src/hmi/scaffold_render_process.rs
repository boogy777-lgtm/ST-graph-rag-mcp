fn render_process_toml(points: &[ScaffoldPoint], svg_name: &str) -> String {
    const TANK_FILL_BOTTOM_Y: i32 = 480;
    const TANK_FILL_TOP_Y: i32 = 200;
    const TANK_FILL_MAX_HEIGHT: i32 = TANK_FILL_BOTTOM_Y - TANK_FILL_TOP_Y;

    let mut out = String::new();
    let _ = writeln!(out, "title = \"Process\"");
    let _ = writeln!(out, "kind = \"process\"");
    let _ = writeln!(out, "icon = \"workflow\"");
    let _ = writeln!(out, "order = 20");
    let _ = writeln!(out, "svg = \"{}\"", escape_toml_string(svg_name));

    let running = select_scaffold_point(points, &["run", "running", "enabled"], None);
    let flow = select_scaffold_point(points, &["flow"], Some(ScaffoldTypeBucket::Numeric));
    let pressure = select_scaffold_point(
        points,
        &["pressure", "bar", "pt"],
        Some(ScaffoldTypeBucket::Numeric),
    );
    let feed_level = select_scaffold_point(
        points,
        &["feed", "source", "inlet", "level"],
        Some(ScaffoldTypeBucket::Numeric),
    );
    let product_level = select_scaffold_point(
        points,
        &["product", "outlet", "tank", "level"],
        Some(ScaffoldTypeBucket::Numeric),
    );

    if let Some(point) = flow.as_ref() {
        let _ = writeln!(out);
        let _ = writeln!(out, "[[bind]]");
        let _ = writeln!(out, "selector = \"#pid-flow-value\"");
        let _ = writeln!(out, "attribute = \"text\"");
        let _ = writeln!(
            out,
            "source = \"{}\"",
            escape_toml_string(point.path.as_str())
        );
        let _ = writeln!(out, "format = \"{}\"", escape_toml_string("{} m3/h"));
    }

    if let Some(point) = pressure.as_ref() {
        let _ = writeln!(out);
        let _ = writeln!(out, "[[bind]]");
        let _ = writeln!(out, "selector = \"#pid-pressure-value\"");
        let _ = writeln!(out, "attribute = \"text\"");
        let _ = writeln!(
            out,
            "source = \"{}\"",
            escape_toml_string(point.path.as_str())
        );
        let _ = writeln!(out, "format = \"{}\"", escape_toml_string("{} bar"));
    }

    if let Some(point) = feed_level.as_ref() {
        let _ = writeln!(out);
        let _ = writeln!(out, "[[bind]]");
        let _ = writeln!(out, "selector = \"#pid-feed-level-value\"");
        let _ = writeln!(out, "attribute = \"text\"");
        let _ = writeln!(
            out,
            "source = \"{}\"",
            escape_toml_string(point.path.as_str())
        );
        let _ = writeln!(out, "format = \"{}\"", escape_toml_string("{} %"));

        let min = point.min.unwrap_or(0.0);
        let max = point.max.unwrap_or(100.0);
        if max > min {
            let _ = writeln!(out);
            let _ = writeln!(out, "[[bind]]");
            let _ = writeln!(out, "selector = \"#pid-feed-level-fill\"");
            let _ = writeln!(out, "attribute = \"y\"");
            let _ = writeln!(
                out,
                "source = \"{}\"",
                escape_toml_string(point.path.as_str())
            );
            let _ = writeln!(
                out,
                "scale = {{ min = {}, max = {}, output_min = {}, output_max = {} }}",
                format_toml_number(min),
                format_toml_number(max),
                TANK_FILL_BOTTOM_Y,
                TANK_FILL_TOP_Y
            );

            let _ = writeln!(out);
            let _ = writeln!(out, "[[bind]]");
            let _ = writeln!(out, "selector = \"#pid-feed-level-fill\"");
            let _ = writeln!(out, "attribute = \"height\"");
            let _ = writeln!(
                out,
                "source = \"{}\"",
                escape_toml_string(point.path.as_str())
            );
            let _ = writeln!(
                out,
                "scale = {{ min = {}, max = {}, output_min = 0, output_max = {} }}",
                format_toml_number(min),
                format_toml_number(max),
                TANK_FILL_MAX_HEIGHT
            );
        }
    }

    if let Some(point) = product_level.as_ref() {
        let _ = writeln!(out);
        let _ = writeln!(out, "[[bind]]");
        let _ = writeln!(out, "selector = \"#pid-product-level-value\"");
        let _ = writeln!(out, "attribute = \"text\"");
        let _ = writeln!(
            out,
            "source = \"{}\"",
            escape_toml_string(point.path.as_str())
        );
        let _ = writeln!(out, "format = \"{}\"", escape_toml_string("{} %"));

        let min = point.min.unwrap_or(0.0);
        let max = point.max.unwrap_or(100.0);
        if max > min {
            let _ = writeln!(out);
            let _ = writeln!(out, "[[bind]]");
            let _ = writeln!(out, "selector = \"#pid-product-level-fill\"");
            let _ = writeln!(out, "attribute = \"y\"");
            let _ = writeln!(
                out,
                "source = \"{}\"",
                escape_toml_string(point.path.as_str())
            );
            let _ = writeln!(
                out,
                "scale = {{ min = {}, max = {}, output_min = {}, output_max = {} }}",
                format_toml_number(min),
                format_toml_number(max),
                TANK_FILL_BOTTOM_Y,
                TANK_FILL_TOP_Y
            );

            let _ = writeln!(out);
            let _ = writeln!(out, "[[bind]]");
            let _ = writeln!(out, "selector = \"#pid-product-level-fill\"");
            let _ = writeln!(out, "attribute = \"height\"");
            let _ = writeln!(
                out,
                "source = \"{}\"",
                escape_toml_string(point.path.as_str())
            );
            let _ = writeln!(
                out,
                "scale = {{ min = {}, max = {}, output_min = 0, output_max = {} }}",
                format_toml_number(min),
                format_toml_number(max),
                TANK_FILL_MAX_HEIGHT
            );
        }
    }

    if let Some(point) = running.as_ref() {
        let _ = writeln!(out);
        let _ = writeln!(out, "[[bind]]");
        let _ = writeln!(out, "selector = \"#pid-pump-indicator\"");
        let _ = writeln!(out, "attribute = \"fill\"");
        let _ = writeln!(
            out,
            "source = \"{}\"",
            escape_toml_string(point.path.as_str())
        );
        let _ = writeln!(
            out,
            "map = {{ \"true\" = \"#22c55e\", \"false\" = \"#ef4444\" }}"
        );

        let _ = writeln!(out);
        let _ = writeln!(out, "[[bind]]");
        let _ = writeln!(out, "selector = \"#pid-main-line\"");
        let _ = writeln!(out, "attribute = \"stroke\"");
        let _ = writeln!(
            out,
            "source = \"{}\"",
            escape_toml_string(point.path.as_str())
        );
        let _ = writeln!(
            out,
            "map = {{ \"true\" = \"#2563eb\", \"false\" = \"#94a3b8\" }}"
        );
    }

    out
}

fn render_process_auto_svg() -> String {
    [
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1280 720\">",
        "  <defs>",
        "    <style>",
        "      .pid-title { font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif; fill: #1f2937; }",
        "      .pid-label { font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif; fill: #64748b; }",
        "      .pid-value { font-family: 'IBM Plex Mono', 'Consolas', monospace; fill: #2563eb; }",
        "      .pid-shell { fill: #ffffff; stroke: #475569; stroke-width: 2.5; }",
        "      .pid-line { fill: none; stroke: #94a3b8; stroke-width: 6; stroke-linecap: round; }",
        "      .pid-symbol { fill: none; stroke: #475569; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }",
        "      .pid-solid { fill: #475569; }",
        "      .pid-flow-arrow { fill: #94a3b8; }",
        "    </style>",
        "    <pattern id=\"pid-layout-grid\" width=\"40\" height=\"40\" patternUnits=\"userSpaceOnUse\">",
        "      <path d=\"M40 0H0V40\" fill=\"none\" stroke=\"#cbd5e1\" stroke-width=\"1\"/>",
        "    </pattern>",
        "  </defs>",
        "  <rect x=\"0\" y=\"0\" width=\"1280\" height=\"720\" fill=\"#f8fafc\"/>",
        "  <rect x=\"20\" y=\"20\" width=\"1240\" height=\"680\" rx=\"10\" fill=\"#ffffff\" stroke=\"#e2e8f0\" stroke-width=\"1.5\"/>",
        "  <g id=\"pid-layout-guides\" opacity=\"0\" pointer-events=\"none\">",
        "    <rect x=\"120\" y=\"180\" width=\"1040\" height=\"320\" fill=\"url(#pid-layout-grid)\"/>",
        "    <rect x=\"120\" y=\"180\" width=\"1040\" height=\"320\" fill=\"none\" stroke=\"#cbd5e1\" stroke-width=\"1\"/>",
        "  </g>",
        "  <text class=\"pid-title\" x=\"120\" y=\"96\" font-size=\"30\" font-weight=\"700\">Auto Process View</text>",
        "  <text class=\"pid-label\" x=\"120\" y=\"122\" font-size=\"15\">Deterministic grid layout (40px cell): FIT/PT use identical instrument templates and value offsets.</text>",
        "  <rect x=\"120\" y=\"180\" width=\"200\" height=\"320\" rx=\"12\" class=\"pid-shell\"/>",
        "  <rect id=\"pid-feed-level-fill\" x=\"140\" y=\"480\" width=\"160\" height=\"0\" rx=\"6\" fill=\"#60a5fa\" opacity=\"0.62\"/>",
        "  <text class=\"pid-title\" x=\"145\" y=\"220\" font-size=\"20\" font-weight=\"700\">FEED TANK</text>",
        "  <text id=\"pid-feed-level-value\" class=\"pid-value\" x=\"145\" y=\"248\" font-size=\"18\">-- %</text>",
        "  <line id=\"pid-main-line\" x1=\"320\" y1=\"360\" x2=\"960\" y2=\"360\" class=\"pid-line\"/>",
        "  <polygon class=\"pid-flow-arrow\" points=\"430,352 444,360 430,368\"/>",
        "  <polygon class=\"pid-flow-arrow\" points=\"630,352 644,360 630,368\"/>",
        "  <polygon class=\"pid-flow-arrow\" points=\"840,352 854,360 840,368\"/>",
        "  <g id=\"pid-pump-001\" transform=\"translate(400,280)\">",
        "    <circle cx=\"80\" cy=\"80\" r=\"24\" class=\"pid-symbol\"/>",
        "    <path d=\"M66 98 L94 98 L80 74 Z\" class=\"pid-solid\" transform=\"rotate(90 80 80)\"/>",
        "    <circle id=\"pid-pump-indicator\" cx=\"122\" cy=\"44\" r=\"10\" fill=\"#ef4444\" stroke=\"#ffffff\" stroke-width=\"2\"/>",
        "    <text class=\"pid-title\" x=\"38\" y=\"158\" font-size=\"16\" font-weight=\"700\">PUMP</text>",
        "  </g>",
        "  <g id=\"pid-fit-001\" transform=\"translate(500,240)\">",
        "    <line x1=\"80\" y1=\"62\" x2=\"80\" y2=\"120\" class=\"pid-symbol\"/>",
        "    <circle cx=\"80\" cy=\"40\" r=\"22\" class=\"pid-symbol\"/>",
        "    <line x1=\"62\" y1=\"40\" x2=\"98\" y2=\"40\" class=\"pid-symbol\"/>",
        "    <text class=\"pid-title\" x=\"80\" y=\"-24\" font-size=\"14\" font-weight=\"700\" text-anchor=\"middle\">FIT-001</text>",
        "    <text id=\"pid-flow-value\" class=\"pid-value\" x=\"80\" y=\"-4\" font-size=\"14\" text-anchor=\"middle\">-- m3/h</text>",
        "  </g>",
        "  <g id=\"pid-valve-001\" transform=\"translate(620,280)\">",
        "    <polygon points=\"46,52 80,80 46,108\" class=\"pid-symbol\"/>",
        "    <polygon points=\"114,52 80,80 114,108\" class=\"pid-symbol\"/>",
        "    <text class=\"pid-title\" x=\"28\" y=\"158\" font-size=\"16\" font-weight=\"700\">VALVE</text>",
        "  </g>",
        "  <g id=\"pid-pt-001\" transform=\"translate(740,240)\">",
        "    <line x1=\"80\" y1=\"62\" x2=\"80\" y2=\"120\" class=\"pid-symbol\"/>",
        "    <circle cx=\"80\" cy=\"40\" r=\"22\" class=\"pid-symbol\"/>",
        "    <line x1=\"62\" y1=\"40\" x2=\"98\" y2=\"40\" class=\"pid-symbol\"/>",
        "    <text class=\"pid-title\" x=\"80\" y=\"-24\" font-size=\"14\" font-weight=\"700\" text-anchor=\"middle\">PT-001</text>",
        "    <text id=\"pid-pressure-value\" class=\"pid-value\" x=\"80\" y=\"-4\" font-size=\"14\" text-anchor=\"middle\">-- bar</text>",
        "  </g>",
        "  <rect x=\"960\" y=\"180\" width=\"200\" height=\"320\" rx=\"12\" class=\"pid-shell\"/>",
        "  <rect id=\"pid-product-level-fill\" x=\"980\" y=\"480\" width=\"160\" height=\"0\" rx=\"6\" fill=\"#34d399\" opacity=\"0.72\"/>",
        "  <text class=\"pid-title\" x=\"985\" y=\"220\" font-size=\"20\" font-weight=\"700\">PRODUCT</text>",
        "  <text id=\"pid-product-level-value\" class=\"pid-value\" x=\"985\" y=\"248\" font-size=\"18\">-- %</text>",
        "</svg>",
    ]
    .join("\n")
}

fn select_scaffold_point<'a>(
    points: &'a [ScaffoldPoint],
    hints: &[&str],
    bucket: Option<ScaffoldTypeBucket>,
) -> Option<&'a ScaffoldPoint> {
    let mut by_score = points
        .iter()
        .filter(|point| bucket.is_none_or(|kind| point.type_bucket == kind))
        .map(|point| {
            let haystack = format!(
                "{} {} {}",
                point.path.to_ascii_lowercase(),
                point.raw_name.to_ascii_lowercase(),
                point.label.to_ascii_lowercase()
            );
            let score = hints
                .iter()
                .filter(|hint| haystack.contains(&hint.to_ascii_lowercase()))
                .count();
            (score, point)
        })
        .collect::<Vec<_>>();
    by_score.sort_by(|left, right| {
        right
            .0
            .cmp(&left.0)
            .then_with(|| left.1.path.cmp(&right.1.path))
    });
    by_score
        .into_iter()
        .find(|(score, _)| *score > 0)
        .map(|(_, point)| point)
}

fn render_control_toml(points: &[ScaffoldPoint]) -> String {
    let mut commands = Vec::new();
    let mut setpoints = Vec::new();
    let mut modes = Vec::new();
    let mut text_fields = Vec::new();

    for point in points {
        if !point.writable {
            continue;
        }
        match point.type_bucket {
            ScaffoldTypeBucket::Bool => commands.push(point.clone()),
            ScaffoldTypeBucket::Numeric => setpoints.push(point.clone()),
            ScaffoldTypeBucket::Text => text_fields.push(point.clone()),
            _ => modes.push(point.clone()),
        }
    }

    for entries in [&mut commands, &mut setpoints, &mut modes, &mut text_fields] {
        entries.sort_by(|left, right| {
            left.label
                .cmp(&right.label)
                .then_with(|| left.path.cmp(&right.path))
        });
    }

    let mut out = String::new();
    let _ = writeln!(out, "title = \"Control\"");
    let _ = writeln!(out, "icon = \"sliders\"");
    let _ = writeln!(out, "order = 30");
    let _ = writeln!(out, "kind = \"dashboard\"");
    render_control_section(&mut out, "Commands", 4, &commands);
    render_control_section(&mut out, "Setpoints", 8, &setpoints);
    render_control_section(&mut out, "Modes", 6, &modes);
    render_control_section(&mut out, "Text Inputs", 6, &text_fields);
    out
}

fn render_control_section(out: &mut String, title: &str, span: u32, widgets: &[ScaffoldPoint]) {
    if widgets.is_empty() {
        return;
    }
    let _ = writeln!(out);
    let _ = writeln!(out, "[[section]]");
    let _ = writeln!(out, "title = \"{}\"", escape_toml_string(title));
    let _ = writeln!(out, "span = {}", span.clamp(1, 12));

    for point in widgets {
        let widget_type = match point.type_bucket {
            ScaffoldTypeBucket::Bool => "toggle",
            ScaffoldTypeBucket::Numeric => "slider",
            _ => point.widget.as_str(),
        };
        let _ = writeln!(out);
        let _ = writeln!(out, "[[section.widget]]");
        let _ = writeln!(out, "type = \"{}\"", escape_toml_string(widget_type));
        let _ = writeln!(
            out,
            "bind = \"{}\"",
            escape_toml_string(point.path.as_str())
        );
        if point.inferred_interface {
            let _ = writeln!(out, "inferred_interface = true");
        }
        let _ = writeln!(
            out,
            "label = \"{}\"",
            escape_toml_string(point.label.as_str())
        );
        let _ = writeln!(
            out,
            "span = {}",
            if point.type_bucket == ScaffoldTypeBucket::Numeric {
                6
            } else {
                4
            }
        );
        if let Some(unit) = point.unit.as_ref() {
            let _ = writeln!(out, "unit = \"{}\"", escape_toml_string(unit));
        }
        if let Some(min) = point.min {
            let _ = writeln!(out, "min = {}", format_toml_number(min));
        }
        if let Some(max) = point.max {
            let _ = writeln!(out, "max = {}", format_toml_number(max));
        }
    }
}

pub(super) fn write_scaffold_file(path: &Path, text: &str) -> anyhow::Result<()> {
    std::fs::write(path, text)
        .map_err(|err| anyhow::anyhow!("failed to write scaffold file '{}': {err}", path.display()))
}

