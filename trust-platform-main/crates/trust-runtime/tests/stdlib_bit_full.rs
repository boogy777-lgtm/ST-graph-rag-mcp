use trust_runtime::stdlib::StandardLibrary;
use trust_runtime::value::Value;

#[test]
fn bit_full() {
    let lib = StandardLibrary::new();

    assert_eq!(
        lib.call("SHL", &[Value::Word(0x0001), Value::Int(3)])
            .unwrap(),
        Value::Word(0x0008)
    );

    assert_eq!(
        lib.call("SHR", &[Value::Word(0x0008), Value::Int(3)])
            .unwrap(),
        Value::Word(0x0001)
    );

    assert_eq!(
        lib.call("ROL", &[Value::Byte(0x81), Value::Int(1)])
            .unwrap(),
        Value::Byte(0x03)
    );

    assert_eq!(
        lib.call("ROR", &[Value::Byte(0x03), Value::Int(1)])
            .unwrap(),
        Value::Byte(0x81)
    );

    assert_eq!(
        lib.call("AND", &[Value::Word(0x00FF), Value::Word(0x0F0F)])
            .unwrap(),
        Value::Word(0x000F)
    );

    assert_eq!(
        lib.call("OR", &[Value::Byte(0x0F), Value::Byte(0xF0)])
            .unwrap(),
        Value::Byte(0xFF)
    );

    assert_eq!(
        lib.call("XOR", &[Value::Byte(0xFF), Value::Byte(0x0F)])
            .unwrap(),
        Value::Byte(0xF0)
    );

    assert_eq!(
        lib.call("NOT", &[Value::Word(0x0000)]).unwrap(),
        Value::Word(0xFFFF)
    );

    assert_eq!(
        lib.call("OR", &[Value::Byte(0x0F), Value::Word(0x00F0)])
            .unwrap(),
        Value::Word(0x00FF)
    );
}
