#[test]
fn scaffold_includes_external_symbols_and_excludes_internals() {
    let root = temp_dir("trust-runtime-hmi-scaffold-scope");
    let source = r#"
PROGRAM Main
VAR_INPUT
    speed_sp : REAL := 1200.0;
END_VAR
VAR_OUTPUT
    speed_pv : REAL := 1200.0;
END_VAR
VAR
    internal_counter : DINT := 0;
END_VAR
END_PROGRAM
"#;
    let _summary = scaffold_from_sources(&root, "industrial", &[("sources/main.st", source)]);
    let overview = std::fs::read_to_string(root.join("hmi/overview.toml")).expect("read overview");
    assert!(overview.contains("bind = \"Main.speed_sp\""));
    assert!(overview.contains("bind = \"Main.speed_pv\""));
    assert!(!overview.contains("internal_counter"));
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn scaffold_local_only_program_uses_inferred_interface_fallback() {
    let root = temp_dir("trust-runtime-hmi-scaffold-local-fallback");
    let source = r#"
PROGRAM Main
VAR
    speed_pv : REAL := 1200.0;
    running : BOOL := FALSE;
END_VAR
END_PROGRAM
"#;
    let _summary = scaffold_from_sources(&root, "industrial", &[("sources/main.st", source)]);
    let overview = std::fs::read_to_string(root.join("hmi/overview.toml")).expect("read overview");
    assert!(overview.contains("bind = \"Main.speed_pv\""));
    assert!(overview.contains("bind = \"Main.running\""));
    assert!(overview.contains("inferred_interface = true"));
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn scaffold_widget_mapping_respects_type_and_writability() {
    let root = temp_dir("trust-runtime-hmi-scaffold-widget-map");
    let source = r#"
PROGRAM Main
VAR_INPUT
    run_cmd : BOOL := FALSE;
END_VAR
VAR_OUTPUT
    running : BOOL := FALSE;
    pressure_bar : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let _summary = scaffold_from_sources(&root, "industrial", &[("sources/main.st", source)]);
    let overview = std::fs::read_to_string(root.join("hmi/overview.toml")).expect("read overview");
    assert!(overview.contains("type = \"toggle\"\nbind = \"Main.run_cmd\""));
    assert!(overview.contains("type = \"indicator\"\nbind = \"Main.running\""));
    assert!(overview.contains("type = \"gauge\"\nbind = \"Main.pressure_bar\""));
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn scaffold_output_is_deterministic_for_same_input() {
    let source = r#"
PROGRAM Main
VAR_INPUT
    speed_sp : REAL := 1200.0;
END_VAR
VAR_OUTPUT
    speed_pv : REAL := 1000.0;
    running : BOOL := FALSE;
END_VAR
END_PROGRAM
"#;
    let root_a = temp_dir("trust-runtime-hmi-scaffold-deterministic-a");
    let root_b = temp_dir("trust-runtime-hmi-scaffold-deterministic-b");
    let summary_a = scaffold_from_sources(&root_a, "classic", &[("sources/main.st", source)]);
    let summary_b = scaffold_from_sources(&root_b, "classic", &[("sources/main.st", source)]);
    assert_eq!(summary_a, summary_b);

    let overview_a =
        std::fs::read_to_string(root_a.join("hmi/overview.toml")).expect("read overview a");
    let overview_b =
        std::fs::read_to_string(root_b.join("hmi/overview.toml")).expect("read overview b");
    assert_eq!(overview_a, overview_b);

    let config_a = std::fs::read_to_string(root_a.join("hmi/_config.toml")).expect("read config a");
    let config_b = std::fs::read_to_string(root_b.join("hmi/_config.toml")).expect("read config b");
    assert_eq!(config_a, config_b);

    std::fs::remove_dir_all(root_a).ok();
    std::fs::remove_dir_all(root_b).ok();
}

#[test]
fn scaffold_overview_enforces_budget_and_config_version() {
    let root = temp_dir("trust-runtime-hmi-scaffold-overview-budget");
    let source = r#"
PROGRAM Main
VAR_INPUT
    start_cmd : BOOL := FALSE;
    stop_cmd : BOOL := FALSE;
    flow_setpoint : REAL := 50.0;
    pressure_setpoint : REAL := 4.0;
END_VAR
VAR_OUTPUT
    alarm_active : BOOL := FALSE;
    flow_main : REAL := 0.0;
    pressure_bar : REAL := 0.0;
    tank_feed_level : REAL := 0.0;
    tank_product_level : REAL := 0.0;
    flow_deviation : REAL := 0.0;
    scan_tick : DINT := 0;
    energy_kwh : REAL := 0.0;
    motor_speed_rpm : REAL := 0.0;
    ambient_temperature : REAL := 0.0;
    line_current : REAL := 0.0;
    valve_position_pct : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let _summary = scaffold_from_sources(&root, "industrial", &[("sources/main.st", source)]);
    let overview = std::fs::read_to_string(root.join("hmi/overview.toml")).expect("read overview");
    let count = overview.matches("[[section.widget]]").count();
    assert!(
        count <= 10,
        "overview widget count exceeded budget: {count} > 10"
    );
    assert!(overview.contains("bind = \"Main.alarm_active\""));
    let config = std::fs::read_to_string(root.join("hmi/_config.toml")).expect("read _config.toml");
    assert!(config.contains("version = 1"));
    assert!(config.contains("inferred = true"));
    std::fs::remove_dir_all(root).ok();
}
