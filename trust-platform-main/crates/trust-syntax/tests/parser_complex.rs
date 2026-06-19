mod common;
use common::*;

// Complex Examples
#[test]
fn test_complete_function_block() {
    insta::assert_snapshot!(snapshot_parse(
        r#"FUNCTION_BLOCK FB_PID
VAR_INPUT
    setpoint : REAL;
    actual : REAL;
    kp : REAL := 1.0;
    ki : REAL := 0.1;
    kd : REAL := 0.01;
END_VAR
VAR_OUTPUT
    output : REAL;
END_VAR
VAR
    error : REAL;
    prev_error : REAL;
    integral : REAL;
END_VAR

error := setpoint - actual;
integral := integral + error;
output := kp * error + ki * integral + kd * (error - prev_error);
prev_error := error;

END_FUNCTION_BLOCK"#
    ));
}
