use trust_runtime::harness::TestHarness;

#[test]
fn table_examples() {
    let source = r#"
        PROGRAM Example
        VAR
            count: DINT := 0;
            inc: BOOL := FALSE;
        END_VAR
        IF inc THEN
            count := count + 1;
        END_IF;
        END_PROGRAM
    "#;

    let mut harness = TestHarness::from_source(source).unwrap();
    harness.assert_eq("count", 0i32);

    harness.set_input("inc", true);
    harness.cycle();
    harness.assert_eq("count", 1i32);
}

#[test]
fn conversion_usage_examples() {
    // IEC 61131-3:2013 conversion usage examples (see Table 22 usage examples).
    let source = r#"
        PROGRAM Example
        VAR
            b : INT := INT#-7;
            a1 : REAL := 0.0;
            a2 : REAL := 0.0;
            r1 : INT := 0;
            r2 : INT := 0;
            r3 : INT := 0;
            r4 : INT := 0;
        END_VAR
        a1 := INT_TO_REAL(b);
        a2 := TO_REAL(b);
        r1 := REAL_TO_INT(REAL#1.6);
        r2 := REAL_TO_INT(REAL#-1.6);
        r3 := REAL_TO_INT(REAL#1.5);
        r4 := REAL_TO_INT(REAL#2.5);
        END_PROGRAM
    "#;

    let mut harness = TestHarness::from_source(source).unwrap();
    harness.cycle();
    harness.assert_eq("a1", trust_runtime::value::Value::Real(-7.0_f32));
    harness.assert_eq("a2", trust_runtime::value::Value::Real(-7.0_f32));
    harness.assert_eq("r1", 2i16);
    harness.assert_eq("r2", -2i16);
    harness.assert_eq("r3", 2i16);
    harness.assert_eq("r4", 2i16);
}

#[test]
fn logic_usage_example() {
    // IEC 61131-3:2013 ST language example: Z := X AND Y.
    let source = r#"
        PROGRAM Example
        VAR
            x : BOOL := TRUE;
            y : BOOL := FALSE;
            z : BOOL := TRUE;
        END_VAR
        z := x AND y;
        END_PROGRAM
    "#;

    let mut harness = TestHarness::from_source(source).unwrap();
    harness.cycle();
    harness.assert_eq("z", false);
}
