use trust_runtime::harness::TestHarness;
use trust_runtime::value::Value;

#[test]
fn iec_6_5_5_2() {
    let source = r#"
PROGRAM Main
VAR
    inp AT %IX1.2.3 : BOOL;
    out AT %QX1.2.4 : BOOL;
END_VAR
out := inp;
END_PROGRAM
"#;

    let mut harness = TestHarness::from_source(source).unwrap();
    harness
        .set_direct_input("%IX1.2.3", Value::Bool(true))
        .unwrap();
    harness.cycle();

    let out = harness.get_direct_output("%QX1.2.4").unwrap();
    assert_eq!(out, Value::Bool(true));
}
