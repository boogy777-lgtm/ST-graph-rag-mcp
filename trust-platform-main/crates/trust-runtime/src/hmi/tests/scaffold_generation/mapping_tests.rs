#[test]
fn widget_mapping_covers_required_type_buckets() {
    assert_eq!(widget_for_type(&Type::Bool, false), "indicator");
    assert_eq!(widget_for_type(&Type::Real, false), "value");
    assert_eq!(widget_for_type(&Type::Real, true), "slider");
    assert_eq!(
        widget_for_type(
            &Type::Enum {
                name: SmolStr::new("MODE"),
                base: trust_hir::TypeId::INT,
                values: vec![(SmolStr::new("AUTO"), 1)],
            },
            false,
        ),
        "readout"
    );
    assert_eq!(
        widget_for_type(&Type::String { max_len: None }, false),
        "text"
    );
    assert_eq!(
        widget_for_type(
            &Type::Array {
                element: trust_hir::TypeId::INT,
                dimensions: vec![(1, 4)],
            },
            false,
        ),
        "table"
    );
    assert_eq!(
        widget_for_type(
            &Type::Struct {
                name: SmolStr::new("POINT"),
                fields: Vec::new(),
            },
            false,
        ),
        "tree"
    );
}

#[test]
fn annotation_parser_handles_valid_invalid_and_missing_fields() {
    let valid = parse_hmi_annotation_payload(
            r#"label="Motor Speed", unit="rpm", min=0, max=100, widget="gauge", page="ops", group="Drive", order=2"#,
        )
        .expect("valid annotation");
    assert_eq!(valid.label.as_deref(), Some("Motor Speed"));
    assert_eq!(valid.unit.as_deref(), Some("rpm"));
    assert_eq!(valid.widget.as_deref(), Some("gauge"));
    assert_eq!(valid.page.as_deref(), Some("ops"));
    assert_eq!(valid.group.as_deref(), Some("Drive"));
    assert_eq!(valid.order, Some(2));
    assert_eq!(valid.min, Some(0.0));
    assert_eq!(valid.max, Some(100.0));

    let invalid = parse_hmi_annotation_payload(r#"label"#);
    assert!(invalid.is_none(), "invalid annotation should be rejected");

    let missing = parse_hmi_annotation_payload(" ");
    assert!(missing.is_none(), "empty annotation should be ignored");
}

