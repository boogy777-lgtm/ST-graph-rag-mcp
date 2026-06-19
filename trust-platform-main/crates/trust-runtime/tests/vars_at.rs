use trust_runtime::harness::TestHarness;
use trust_runtime::value::Value;

#[test]
fn iec_6_5_5() {
    let source = r#"
PROGRAM Main
VAR
    inp AT %IX0.0 : BOOL;
    out AT %QX0.1 : BOOL;
END_VAR
out := inp;
END_PROGRAM
"#;

    let mut harness = TestHarness::from_source(source).unwrap();
    harness
        .set_direct_input("%IX0.0", Value::Bool(true))
        .unwrap();
    harness.cycle();

    let out = harness.get_direct_output("%QX0.1").unwrap();
    assert_eq!(out, Value::Bool(true));
}
