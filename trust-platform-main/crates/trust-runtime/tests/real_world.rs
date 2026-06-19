use trust_runtime::harness::TestHarness;

#[test]
fn samples() {
    // Vendor-neutral ST sample covering common constructs without vendor extensions.
    let source = r#"
        FUNCTION ClampReal : REAL
        VAR_INPUT
            Value : REAL;
            Min : REAL;
            Max : REAL;
        END_VAR
        IF Value < Min THEN
            ClampReal := Min;
        ELSIF Value > Max THEN
            ClampReal := Max;
        ELSE
            ClampReal := Value;
        END_IF
        END_FUNCTION

        FUNCTION Avg4 : REAL
        VAR_INPUT
            Samples : ARRAY[0..3] OF REAL;
        END_VAR
        VAR
            i : INT;
            sum : REAL;
        END_VAR
        sum := REAL#0.0;
        FOR i := INT#0 TO INT#3 DO
            sum := sum + Samples[i];
        END_FOR
        Avg4 := sum / REAL#4.0;
        END_FUNCTION

        FUNCTION_BLOCK FB_Valve
        VAR_INPUT
            Enable : BOOL;
            Setpoint : REAL;
        END_VAR
        VAR_OUTPUT
            Open : BOOL;
            Position : REAL;
        END_VAR
        VAR
            ramp : REAL;
        END_VAR
        IF Enable THEN
            Open := TRUE;
            ramp := ClampReal(Setpoint, REAL#0.0, REAL#100.0);
        ELSE
            Open := FALSE;
            ramp := REAL#0.0;
        END_IF
        Position := ramp;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
            Valve : FB_Valve;
            Mode : INT := INT#0;
            CmdEnable : BOOL;
            CmdSetpoint : REAL;
            Samples : ARRAY[0..3] OF REAL;
            Avg : REAL;
            i : INT;
            OpenOut : BOOL;
            PosOut : REAL;
            RefPos : REF_TO REAL;
            Opened : BOOL := FALSE;
            Watchdog : TON;
            WatchdogQ : BOOL;
        END_VAR

        CmdEnable := TRUE;
        CmdSetpoint := REAL#42.5;

        FOR i := INT#0 TO INT#3 DO
            Samples[i] := REAL#15.0;
        END_FOR
        Avg := Avg4(Samples);
        CmdSetpoint := Avg;

        Valve(Enable := CmdEnable, Setpoint := CmdSetpoint, Open => OpenOut, Position => PosOut);
        Opened := OpenOut;

        Watchdog(IN := CmdEnable, PT := T#50ms, Q => WatchdogQ);
        IF WatchdogQ THEN
            Mode := INT#0;
        END_IF

        CASE Mode OF
            INT#0:
                IF Opened THEN
                    Mode := INT#1;
                END_IF
            INT#1:
                Mode := INT#2;
            INT#2:
                Mode := INT#0;
        END_CASE

        RefPos := REF(PosOut);
        RefPos^ := ClampReal(RefPos^, REAL#0.0, REAL#100.0);
        END_PROGRAM
    "#;

    let mut harness = TestHarness::from_source(source).unwrap();
    let result = harness.cycle();
    assert!(result.errors.is_empty(), "{:?}", result.errors);
}
