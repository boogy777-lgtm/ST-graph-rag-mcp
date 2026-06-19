#[test]
fn schema_merge_applies_defaults_annotations_and_file_overrides() {
    let root = temp_dir("trust-runtime-hmi-merge");
    write_file(
        &root.join("hmi.toml"),
        r##"
[theme]
style = "industrial"
accent = "#ff5500"

[[pages]]
id = "ops"
title = "Operations"
order = 1

[widgets."Main.speed"]
label = "Speed (Override)"
widget = "slider"
page = "ops"
group = "Drive"
min = 5
max = 95
"##,
    );

    let source = r#"
PROGRAM Main
VAR
    // @hmi(label="Speed (Annotation)", unit="rpm", min=0, max=100, widget="gauge")
    speed : REAL := 42.5;
END_VAR
END_PROGRAM
"#;
    let metadata = metadata_for_source(source);
    let source_path = root.join("sources/main.st");
    let source_refs = [HmiSourceRef {
        path: &source_path,
        text: source,
    }];
    let customization = load_customization(Some(&root), &source_refs);
    let schema = build_schema("RESOURCE", &metadata, None, true, Some(&customization));

    let speed = schema
        .widgets
        .iter()
        .find(|widget| widget.path == "Main.speed")
        .expect("speed widget");
    assert_eq!(speed.label, "Speed (Override)");
    assert_eq!(speed.widget, "slider");
    assert_eq!(speed.unit.as_deref(), Some("rpm"));
    assert_eq!(speed.page, "ops");
    assert_eq!(speed.group, "Drive");
    assert_eq!(speed.min, Some(5.0));
    assert_eq!(speed.max, Some(95.0));

    assert_eq!(schema.theme.style, "industrial");
    assert_eq!(schema.theme.accent, "#ff5500");
    assert!(schema.pages.iter().any(|page| page.id == "ops"));

    std::fs::remove_dir_all(root).ok();
}

#[test]
fn hmi_dir_loader_discovers_and_sorts_pages() {
    let root = temp_dir("trust-runtime-hmi-dir-load");
    write_file(
        &root.join("hmi/_config.toml"),
        r##"
[theme]
style = "mint"
accent = "#14b8a6"

[write]
enabled = true
allow = ["Main.speed"]
"##,
    );
    write_file(
        &root.join("hmi/beta.toml"),
        r#"
title = "Beta"
kind = "dashboard"

[[section]]
title = "B"
span = 6

[[section.widget]]
type = "value"
bind = "Main.speed"
"#,
    );
    write_file(
        &root.join("hmi/alpha.toml"),
        r#"
title = "Alpha"
order = 1
kind = "dashboard"

[[section]]
title = "A"
span = 6

[[section.widget]]
type = "indicator"
bind = "Main.run"
"#,
    );

    let descriptor = load_hmi_dir(&root).expect("load hmi dir");
    assert_eq!(descriptor.pages.len(), 2);
    assert_eq!(descriptor.pages[0].id, "alpha");
    assert_eq!(descriptor.pages[1].id, "beta");
    assert_eq!(descriptor.config.theme.style.as_deref(), Some("mint"));
    assert_eq!(descriptor.config.write.enabled, Some(true));
    assert_eq!(
        descriptor.config.write.allow,
        vec!["Main.speed".to_string()]
    );
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn hmi_dir_loader_returns_none_for_invalid_toml() {
    let root = temp_dir("trust-runtime-hmi-dir-invalid");
    write_file(
        &root.join("hmi/overview.toml"),
        r#"
title = "Overview"
[[section]]
title = "Bad"
span = "wide"
"#,
    );
    assert!(load_hmi_dir(&root).is_none());
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn hmi_dir_loader_promotes_process_auto_svg_to_custom_asset() {
    let root = temp_dir("trust-runtime-hmi-dir-process-promotion");
    write_file(
        &root.join("hmi/process.toml"),
        r#"
title = "Process"
kind = "process"
svg = "process.auto.svg"
"#,
    );
    write_file(
        &root.join("hmi/process.auto.svg"),
        "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
    );
    write_file(
        &root.join("hmi/plant.svg"),
        "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
    );
    let descriptor = load_hmi_dir(&root).expect("load descriptor");
    let process = descriptor
        .pages
        .iter()
        .find(|page| page.id == "process")
        .expect("process page");
    assert_eq!(process.svg.as_deref(), Some("plant.svg"));
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn load_customization_prefers_hmi_dir_over_legacy_toml() {
    let root = temp_dir("trust-runtime-hmi-dir-priority");
    write_file(
        &root.join("hmi.toml"),
        r##"
[theme]
style = "industrial"
accent = "#ff5500"

[widgets."Main.speed"]
label = "Legacy Speed"
"##,
    );
    write_file(
        &root.join("hmi/_config.toml"),
        r##"
[theme]
style = "mint"
accent = "#14b8a6"
"##,
    );
    write_file(
        &root.join("hmi/overview.toml"),
        r#"
title = "Overview"

[[section]]
title = "Process"
span = 12

[[section.widget]]
type = "gauge"
bind = "Main.speed"
label = "Dir Speed"
"#,
    );

    let source = r#"
PROGRAM Main
VAR
    speed : REAL := 42.0;
END_VAR
END_PROGRAM
"#;
    let metadata = metadata_for_source(source);
    let source_path = root.join("src/main.st");
    let source_refs = [HmiSourceRef {
        path: &source_path,
        text: source,
    }];
    let customization = load_customization(Some(&root), &source_refs);
    let schema = build_schema("RESOURCE", &metadata, None, true, Some(&customization));
    let speed = schema
        .widgets
        .iter()
        .find(|widget| widget.path == "Main.speed")
        .expect("speed widget");
    assert_eq!(schema.theme.style, "mint");
    assert_eq!(speed.label, "Dir Speed");
    assert_eq!(speed.widget, "gauge");
    std::fs::remove_dir_all(root).ok();
}

