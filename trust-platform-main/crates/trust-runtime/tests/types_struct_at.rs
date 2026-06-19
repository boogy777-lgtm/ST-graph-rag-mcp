use trust_runtime::harness::TestHarness;
use trust_runtime::value::Value;

#[test]
fn struct_field_io() {
    let source = r#"
TYPE Rel :
STRUCT
    a AT %B0 : BYTE;
    b AT %B1 : BYTE;
END_STRUCT
END_TYPE

TYPE Abs :
STRUCT
    in_sig AT %I* : BOOL;
    out_sig AT %Q* : BOOL;
END_STRUCT
END_TYPE

PROGRAM Main
VAR
    rel AT %QB0 : Rel;
    abs : Abs;
END_VAR
rel.a := BYTE#16#11;
rel.b := BYTE#16#22;
abs.out_sig := abs.in_sig;
END_PROGRAM

CONFIGURATION Conf
PROGRAM P1 : Main;
VAR_CONFIG
    P1.abs.in_sig AT %IX2.0 : BOOL;
    P1.abs.out_sig AT %QX2.0 : BOOL;
END_VAR
END_CONFIGURATION
"#;

    let mut harness = TestHarness::from_source(source).unwrap();
    harness
        .set_direct_input("%IX2.0", Value::Bool(true))
        .unwrap();
    harness.cycle();

    assert_eq!(
        harness.get_direct_output("%QX2.0").unwrap(),
        Value::Bool(true)
    );
    assert_eq!(
        harness.get_direct_output("%QB0").unwrap(),
        Value::Byte(0x11)
    );
    assert_eq!(
        harness.get_direct_output("%QB1").unwrap(),
        Value::Byte(0x22)
    );
}
