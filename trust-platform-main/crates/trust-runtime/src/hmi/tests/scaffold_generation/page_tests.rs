#[test]
fn scaffold_groups_repeated_instance_prefixes_into_separate_sections() {
    let root = temp_dir("trust-runtime-hmi-scaffold-instance-grouping");
    let source = r#"
PROGRAM Main
VAR_OUTPUT
    pump1_speed : REAL := 0.0;
    pump1_pressure : REAL := 0.0;
    pump2_speed : REAL := 0.0;
    pump2_pressure : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let _summary = scaffold_from_sources(&root, "industrial", &[("sources/main.st", source)]);
    let overview = std::fs::read_to_string(root.join("hmi/overview.toml")).expect("read overview");
    // Tiered layout puts numeric KPIs into a "Key Metrics" hero section
    assert!(overview.contains("title = \"Key Metrics\""));
    assert!(overview.contains("tier = \"hero\""));
    assert!(overview.contains("bind = \"Main.pump1_speed\""));
    assert!(overview.contains("bind = \"Main.pump2_speed\""));
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn scaffold_generates_control_and_process_pages() {
    let root = temp_dir("trust-runtime-hmi-scaffold-required-pages");
    let source = r#"
PROGRAM Main
VAR_INPUT
    start_cmd : BOOL := FALSE;
    flow_setpoint_m3h : REAL := 40.0;
END_VAR
VAR_OUTPUT
    running : BOOL := FALSE;
    flow_m3h : REAL := 0.0;
    pressure_bar : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let summary = scaffold_from_sources(&root, "industrial", &[("sources/main.st", source)]);
    let file_names = summary
        .files
        .iter()
        .map(|entry| entry.path.as_str())
        .collect::<Vec<_>>();
    assert!(file_names.contains(&"process.toml"));
    assert!(file_names.contains(&"process.auto.svg"));
    assert!(file_names.contains(&"control.toml"));
    assert!(root.join("hmi/process.toml").is_file());
    assert!(root.join("hmi/process.auto.svg").is_file());
    assert!(root.join("hmi/control.toml").is_file());
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn scaffold_process_auto_svg_uses_grid_aligned_instrument_templates() {
    let root = temp_dir("trust-runtime-hmi-scaffold-process-grid");
    let source = r#"
PROGRAM Main
VAR_OUTPUT
    running : BOOL := FALSE;
    flow_m3h : REAL := 0.0;
    pressure_bar : REAL := 0.0;
    feed_level_pct : REAL := 0.0;
    product_level_pct : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let _summary = scaffold_from_sources(&root, "classic", &[("sources/main.st", source)]);
    let svg = std::fs::read_to_string(root.join("hmi/process.auto.svg")).expect("read process svg");
    assert!(svg.contains("id=\"pid-layout-guides\""));
    assert!(svg.contains("<g id=\"pid-fit-001\" transform=\"translate(500,240)\">"));
    assert!(svg.contains("<g id=\"pid-pt-001\" transform=\"translate(740,240)\">"));
    assert!(svg.contains("<text id=\"pid-flow-value\" class=\"pid-value\" x=\"80\" y=\"-4\""));
    assert!(svg.contains("<text id=\"pid-pressure-value\" class=\"pid-value\" x=\"80\" y=\"-4\""));
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn scaffold_process_toml_binds_level_fill_y_and_height() {
    let root = temp_dir("trust-runtime-hmi-scaffold-process-level-scale");
    let source = r#"
PROGRAM Main
VAR_OUTPUT
    feed_level_pct : REAL := 0.0;
    product_level_pct : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let _summary = scaffold_from_sources(&root, "classic", &[("sources/main.st", source)]);
    let process =
        std::fs::read_to_string(root.join("hmi/process.toml")).expect("read process page");
    assert!(process.contains(
            "selector = \"#pid-feed-level-fill\"\nattribute = \"y\"\nsource = \"Main.feed_level_pct\"\nscale = { min = 0, max = 100, output_min = 480, output_max = 200 }"
        ));
    assert!(process.contains(
            "selector = \"#pid-feed-level-fill\"\nattribute = \"height\"\nsource = \"Main.feed_level_pct\"\nscale = { min = 0, max = 100, output_min = 0, output_max = 280 }"
        ));
    assert!(process.contains(
            "selector = \"#pid-product-level-fill\"\nattribute = \"y\"\nsource = \"Main.product_level_pct\"\nscale = { min = 0, max = 100, output_min = 480, output_max = 200 }"
        ));
    assert!(process.contains(
            "selector = \"#pid-product-level-fill\"\nattribute = \"height\"\nsource = \"Main.product_level_pct\"\nscale = { min = 0, max = 100, output_min = 0, output_max = 280 }"
        ));
    std::fs::remove_dir_all(root).ok();
}
