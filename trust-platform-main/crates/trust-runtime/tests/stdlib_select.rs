use trust_runtime::stdlib::StandardLibrary;
use trust_runtime::value::Value;

#[test]
fn selection_functions() {
    let lib = StandardLibrary::new();

    assert_eq!(
        lib.call("SEL", &[Value::Bool(true), Value::Int(1), Value::Int(2)])
            .unwrap(),
        Value::Int(2)
    );

    assert_eq!(
        lib.call("MIN", &[Value::Int(3), Value::Int(7)]).unwrap(),
        Value::Int(3)
    );

    let max = lib
        .call("MAX", &[Value::Real(1.0), Value::Real(2.5)])
        .unwrap();
    match max {
        Value::Real(value) => assert!((value - 2.5).abs() < 1e-6),
        _ => panic!("expected REAL result"),
    }
}
