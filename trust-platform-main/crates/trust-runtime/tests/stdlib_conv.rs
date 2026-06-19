use trust_runtime::stdlib::StandardLibrary;
use trust_runtime::value::Value;

#[test]
fn conversion_functions() {
    let lib = StandardLibrary::new();

    assert_eq!(
        lib.call("BOOL_TO_INT", &[Value::Bool(true)]).unwrap(),
        Value::Int(1)
    );

    assert_eq!(
        lib.call("INT_TO_DINT", &[Value::Int(5)]).unwrap(),
        Value::DInt(5)
    );

    assert_eq!(
        lib.call("DINT_TO_INT", &[Value::DInt(7)]).unwrap(),
        Value::Int(7)
    );

    assert_eq!(
        lib.call("INT_TO_REAL", &[Value::Int(4)]).unwrap(),
        Value::Real(4.0)
    );

    assert_eq!(
        lib.call("REAL_TO_INT", &[Value::Real(3.9)]).unwrap(),
        Value::Int(4)
    );
}
