#[test]
fn scaffold_update_preserves_existing_page_and_fills_missing_files() {
    let root = temp_dir("trust-runtime-hmi-scaffold-update");
    let source = r#"
PROGRAM Main
VAR_INPUT
    start_cmd : BOOL := FALSE;
END_VAR
VAR_OUTPUT
    speed : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let _initial = scaffold_from_sources_with_mode(
        &root,
        "industrial",
        &[("sources/main.st", source)],
        HmiScaffoldMode::Reset,
        false,
    );
    std::fs::write(
        root.join("hmi/overview.toml"),
        "title = \"Overview\"\n[[section]]\ntitle = \"Custom\"\nspan = 12\n",
    )
    .expect("overwrite overview");
    std::fs::remove_file(root.join("hmi/control.toml")).expect("remove control page");
    std::fs::remove_file(root.join("hmi/process.toml")).expect("remove process page");

    let summary = scaffold_from_sources_with_mode(
        &root,
        "industrial",
        &[("sources/main.st", source)],
        HmiScaffoldMode::Update,
        false,
    );
    let preserved_overview =
        std::fs::read_to_string(root.join("hmi/overview.toml")).expect("read overview");
    assert!(preserved_overview.contains("title = \"Custom\""));
    assert!(root.join("hmi/control.toml").is_file());
    assert!(root.join("hmi/process.toml").is_file());
    assert!(summary
        .files
        .iter()
        .any(|entry| entry.path == "overview.toml"
            && (entry.detail == "preserved existing"
                || entry.detail == "merged missing scaffold signals")));
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn scaffold_update_skips_default_process_when_custom_process_page_exists() {
    let root = temp_dir("trust-runtime-hmi-scaffold-update-custom-process");
    let source = r#"
PROGRAM Main
VAR_OUTPUT
    speed : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let _initial = scaffold_from_sources_with_mode(
        &root,
        "industrial",
        &[("sources/main.st", source)],
        HmiScaffoldMode::Reset,
        false,
    );
    std::fs::write(
        root.join("hmi/plant.toml"),
        "title = \"Plant\"\nkind = \"process\"\nsvg = \"plant.svg\"\norder = 20\n",
    )
    .expect("write custom process page");
    std::fs::remove_file(root.join("hmi/process.toml")).expect("remove default process page");
    std::fs::remove_file(root.join("hmi/process.auto.svg")).expect("remove default process svg");

    let summary = scaffold_from_sources_with_mode(
        &root,
        "industrial",
        &[("sources/main.st", source)],
        HmiScaffoldMode::Update,
        false,
    );

    assert!(
        !root.join("hmi/process.toml").is_file(),
        "update should not recreate default process.toml when custom process page exists"
    );
    assert!(
        !root.join("hmi/process.auto.svg").is_file(),
        "update should not recreate default process.auto.svg when custom process page exists"
    );
    assert!(summary.files.iter().any(|entry| {
        entry.path == "process.toml" && entry.detail == "skipped (custom process page exists)"
    }));
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn scaffold_update_skips_default_control_when_no_writable_points() {
    let root = temp_dir("trust-runtime-hmi-scaffold-update-skip-control");
    let source = r#"
PROGRAM Main
VAR_OUTPUT
    speed : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let _initial = scaffold_from_sources_with_mode(
        &root,
        "industrial",
        &[("sources/main.st", source)],
        HmiScaffoldMode::Reset,
        false,
    );
    std::fs::remove_file(root.join("hmi/control.toml")).expect("remove control page");

    let summary = scaffold_from_sources_with_mode(
        &root,
        "industrial",
        &[("sources/main.st", source)],
        HmiScaffoldMode::Update,
        false,
    );

    assert!(
        !root.join("hmi/control.toml").is_file(),
        "update should not recreate control.toml when no writable points exist"
    );
    assert!(summary.files.iter().any(|entry| {
        entry.path == "control.toml" && entry.detail == "skipped (no writable points discovered)"
    }));
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn scaffold_update_merges_missing_signals_without_overwriting_custom_widgets() {
    let root = temp_dir("trust-runtime-hmi-scaffold-update-merge-signals");
    let source_a = r#"
PROGRAM Main
VAR_OUTPUT
    speed : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let source_b = r#"
PROGRAM Main
VAR_OUTPUT
    speed : REAL := 0.0;
    pressure_bar : REAL := 0.0;
END_VAR
END_PROGRAM
"#;
    let _initial = scaffold_from_sources_with_mode(
        &root,
        "industrial",
        &[("sources/main.st", source_a)],
        HmiScaffoldMode::Reset,
        false,
    );
    std::fs::write(
        root.join("hmi/overview.toml"),
        r#"
title = "Overview"
order = 0
kind = "dashboard"

[[section]]
title = "Custom"
span = 12

[[section.widget]]
type = "gauge"
bind = "Main.speed"
label = "Speed Custom"
"#,
    )
    .expect("overwrite overview");

    let summary = scaffold_from_sources_with_mode(
        &root,
        "industrial",
        &[("sources/main.st", source_b)],
        HmiScaffoldMode::Update,
        false,
    );
    let overview = std::fs::read_to_string(root.join("hmi/overview.toml")).expect("read overview");
    assert!(overview.contains("label = \"Speed Custom\""));
    assert!(overview.contains("bind = \"Main.pressure_bar\""));
    assert!(summary.files.iter().any(|entry| {
        entry.path == "overview.toml" && entry.detail == "merged missing scaffold signals"
    }));
    std::fs::remove_dir_all(root).ok();
}
