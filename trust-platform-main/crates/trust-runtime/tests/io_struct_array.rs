use trust_runtime::harness::TestHarness;
use trust_runtime::value::Value;

#[test]
fn io_struct_array() {
    let source = r#"
TYPE S :
STRUCT
    a : INT;
    b : BYTE;
END_STRUCT
END_TYPE

PROGRAM Main
VAR
    arr AT %QW0 : ARRAY[0..2] OF INT;
    st AT %QB6 : S;
END_VAR
arr[0] := INT#1;
arr[1] := INT#2;
arr[2] := INT#3;
st.a := INT#16#1234;
st.b := BYTE#16#56;
END_PROGRAM
"#;

    let mut harness = TestHarness::from_source(source).unwrap();
    harness.cycle();

    assert_eq!(harness.get_direct_output("%QW0").unwrap(), Value::Word(1));
    assert_eq!(harness.get_direct_output("%QW2").unwrap(), Value::Word(2));
    assert_eq!(harness.get_direct_output("%QW4").unwrap(), Value::Word(3));
    assert_eq!(
        harness.get_direct_output("%QW6").unwrap(),
        Value::Word(0x1234)
    );
    assert_eq!(
        harness.get_direct_output("%QB8").unwrap(),
        Value::Byte(0x56)
    );
}
