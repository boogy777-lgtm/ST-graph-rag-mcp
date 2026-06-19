use trust_runtime::harness::TestHarness;
use trust_runtime::value::Value;

#[test]
fn fb_instance_io() {
    let source = r#"
FUNCTION_BLOCK FBOut
VAR_INPUT
    enable : BOOL;
END_VAR
VAR_OUTPUT
    out AT %QX0.2 : BOOL;
END_VAR
IF enable THEN
    out := TRUE;
END_IF;
END_FUNCTION_BLOCK

PROGRAM Main
VAR
    fb : FBOut;
END_VAR
fb(enable := TRUE);
END_PROGRAM
"#;

    let mut harness = TestHarness::from_source(source).unwrap();
    harness.cycle();

    let out = harness.get_direct_output("%QX0.2").unwrap();
    assert_eq!(out, Value::Bool(true));
}

#[test]
fn fb_instance_wildcard_requires_config() {
    let source = r#"
FUNCTION_BLOCK FBWild
VAR_OUTPUT
    out AT %Q* : BOOL;
END_VAR
END_FUNCTION_BLOCK

PROGRAM Main
VAR
    fb : FBWild;
END_VAR
fb();
END_PROGRAM
"#;

    assert!(TestHarness::from_source(source).is_err());
}
