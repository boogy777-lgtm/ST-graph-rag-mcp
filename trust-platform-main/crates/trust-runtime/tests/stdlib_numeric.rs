use trust_runtime::stdlib::StandardLibrary;
use trust_runtime::value::Value;

#[test]
fn numeric_functions() {
    let lib = StandardLibrary::new();

    assert_eq!(lib.call("ABS", &[Value::Int(-5)]).unwrap(), Value::Int(5));

    let sqrt = lib.call("SQRT", &[Value::Real(9.0)]).unwrap();
    match sqrt {
        Value::Real(value) => assert!((value - 3.0).abs() < 1e-6),
        _ => panic!("expected REAL result"),
    }

    let sin = lib.call("SIN", &[Value::Real(0.0)]).unwrap();
    match sin {
        Value::Real(value) => assert!(value.abs() < 1e-6),
        _ => panic!("expected REAL result"),
    }
}
