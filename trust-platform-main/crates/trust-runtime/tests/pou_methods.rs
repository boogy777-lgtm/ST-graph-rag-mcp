use trust_runtime::harness::TestHarness;

#[test]
fn method_calls() {
    let source = r#"
CLASS Counter
VAR PUBLIC
    value : INT := INT#0;
END_VAR
METHOD PUBLIC Inc : INT
VAR_INPUT
    inc_step : INT;
END_VAR
value := value + inc_step;
Inc := value;
END_METHOD
END_CLASS

FUNCTION_BLOCK FBMath
VAR PUBLIC
    acc : INT := INT#0;
END_VAR
METHOD PUBLIC Add : INT
VAR_INPUT
    delta : INT;
END_VAR
acc := acc + delta;
Add := acc;
END_METHOD
END_FUNCTION_BLOCK

PROGRAM Main
VAR
    c : Counter;
    fb : FBMath;
    out_c1 : INT := INT#0;
    out_c2 : INT := INT#0;
    out_fb : INT := INT#0;
END_VAR
out_c1 := c.Inc(INT#1);
out_c2 := c.Inc(inc_step := INT#2);
out_fb := fb.Add(INT#3);
END_PROGRAM
"#;

    let mut harness = TestHarness::from_source(source).unwrap();
    let result = harness.cycle();
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    harness.assert_eq("out_c1", 1i16);
    harness.assert_eq("out_c2", 3i16);
    harness.assert_eq("out_fb", 3i16);
}
