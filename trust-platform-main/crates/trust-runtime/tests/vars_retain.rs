use trust_runtime::harness::TestHarness;
use trust_runtime::value::Value;
use trust_runtime::RestartMode;

#[test]
fn iec_6_5_6() {
    let source = r#"
PROGRAM Main
VAR RETAIN
    r : INT := 1;
END_VAR
VAR NON_RETAIN
    n : INT := 2;
END_VAR
VAR
    u : INT := 3;
END_VAR
END_PROGRAM
"#;

    let mut harness = TestHarness::from_source(source).unwrap();
    harness.cycle();

    harness.set_input("r", Value::Int(10));
    harness.set_input("n", Value::Int(20));
    harness.set_input("u", Value::Int(30));

    harness.restart(RestartMode::Warm).unwrap();
    assert_eq!(harness.get_output("r"), Some(Value::Int(10)));
    assert_eq!(harness.get_output("n"), Some(Value::Int(2)));
    assert_eq!(harness.get_output("u"), Some(Value::Int(3)));

    harness.restart(RestartMode::Cold).unwrap();
    assert_eq!(harness.get_output("r"), Some(Value::Int(1)));
    assert_eq!(harness.get_output("n"), Some(Value::Int(2)));
    assert_eq!(harness.get_output("u"), Some(Value::Int(3)));
}
