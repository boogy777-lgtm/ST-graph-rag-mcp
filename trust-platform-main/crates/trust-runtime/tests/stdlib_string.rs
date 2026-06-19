use trust_runtime::stdlib::StandardLibrary;
use trust_runtime::value::Value;

#[test]
fn string_functions() {
    let lib = StandardLibrary::new();

    assert_eq!(
        lib.call("LEN", &[Value::String("abc".into())]).unwrap(),
        Value::Int(3)
    );

    assert_eq!(
        lib.call(
            "CONCAT",
            &[Value::String("foo".into()), Value::String("bar".into())]
        )
        .unwrap(),
        Value::String("foobar".into())
    );
}
