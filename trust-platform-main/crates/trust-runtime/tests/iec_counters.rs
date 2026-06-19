use trust_runtime::harness::TestHarness;
use trust_runtime::value::Value;

#[test]
fn counter_examples() {
    // IEC 61131-3:2013, Table 45 counter examples (CTU/CTD usage in ST).
    let source = r#"
        PROGRAM Example
        VAR
            your_ctu : CTU;
            r : BOOL := FALSE;
            v : INT := INT#3;
            q_u : BOOL := FALSE;
            cv_u : INT := 0;

            your_ctd : CTD;
            cd : BOOL := FALSE;
            ld : BOOL := TRUE;
            pv_d : INT := INT#3;
            q_d : BOOL := FALSE;
            cv_d : INT := 0;
        END_VAR
        your_ctu(CU := r, PV := v, Q => q_u, CV => cv_u);
        your_ctd(CD := cd, LD := ld, PV := pv_d, Q => q_d, CV => cv_d);
        END_PROGRAM
    "#;

    let mut harness = TestHarness::from_source(source).unwrap();

    // Initial load for CTD (LD true), CTU idle.
    harness.cycle();
    harness.assert_eq("cv_u", Value::Int(0));
    harness.assert_eq("q_u", Value::Bool(false));
    harness.assert_eq("cv_d", Value::Int(3));
    harness.assert_eq("q_d", Value::Bool(false));

    // Disable load for CTD.
    harness.set_input("ld", false);

    // CTU pulses.
    harness.set_input("r", true);
    harness.cycle();
    harness.assert_eq("cv_u", Value::Int(1));
    harness.assert_eq("q_u", Value::Bool(false));
    harness.set_input("r", false);
    harness.cycle();

    harness.set_input("r", true);
    harness.cycle();
    harness.assert_eq("cv_u", Value::Int(2));
    harness.assert_eq("q_u", Value::Bool(false));
    harness.set_input("r", false);
    harness.cycle();

    harness.set_input("r", true);
    harness.cycle();
    harness.assert_eq("cv_u", Value::Int(3));
    harness.assert_eq("q_u", Value::Bool(true));
    harness.set_input("r", false);
    harness.cycle();

    // CTD pulses.
    harness.set_input("cd", true);
    harness.cycle();
    harness.assert_eq("cv_d", Value::Int(2));
    harness.assert_eq("q_d", Value::Bool(false));
    harness.set_input("cd", false);
    harness.cycle();

    harness.set_input("cd", true);
    harness.cycle();
    harness.assert_eq("cv_d", Value::Int(1));
    harness.assert_eq("q_d", Value::Bool(false));
    harness.set_input("cd", false);
    harness.cycle();

    harness.set_input("cd", true);
    harness.cycle();
    harness.assert_eq("cv_d", Value::Int(0));
    harness.assert_eq("q_d", Value::Bool(true));
}
