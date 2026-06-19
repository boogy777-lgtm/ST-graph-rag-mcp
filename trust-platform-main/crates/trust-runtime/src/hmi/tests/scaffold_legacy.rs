#[test]
fn load_customization_uses_legacy_toml_when_hmi_dir_missing() {
    let root = temp_dir("trust-runtime-hmi-legacy-fallback");
    write_file(
        &root.join("hmi.toml"),
        r##"
[theme]
style = "industrial"
accent = "#ff5500"

[widgets."Main.speed"]
label = "Legacy Speed"
widget = "slider"
page = "ops"
group = "Legacy"
"##,
    );

    let source = r#"
PROGRAM Main
VAR
    speed : REAL := 10.0;
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
    assert!(customization.dir_descriptor().is_none());

    let schema = build_schema("RESOURCE", &metadata, None, true, Some(&customization));
    let speed = schema
        .widgets
        .iter()
        .find(|widget| widget.path == "Main.speed")
        .expect("speed widget");
    assert_eq!(schema.theme.style, "industrial");
    assert_eq!(speed.label, "Legacy Speed");
    assert_eq!(speed.widget, "slider");
    assert_eq!(speed.page, "ops");
    assert_eq!(speed.group, "Legacy");

    std::fs::remove_dir_all(root).ok();
}

