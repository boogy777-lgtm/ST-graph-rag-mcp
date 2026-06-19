use trust_runtime::error::RuntimeError;
use trust_runtime::harness::TestHarness;

#[test]
fn error_policy() {
    let source = r#"
PROGRAM Main
VAR
    x : DINT := 0;
END_VAR
x := 1 / 0;
END_PROGRAM
"#;

    let mut harness = TestHarness::from_source(source).unwrap();
    let result = harness.cycle();
    assert!(result.errors.contains(&RuntimeError::DivisionByZero));
}
