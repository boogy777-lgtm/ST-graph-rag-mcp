(* 
    FB_Motor - Motor control function block
    Demonstrates various IEC 61131-3 ST features
*)
FUNCTION_BLOCK FB_Motor EXTENDS FB_BaseDevice IMPLEMENTS I_Device, I_Diagnostics
VAR_INPUT
    enable : BOOL;              // Enable the motor
    speedSetpoint : REAL;       // Target speed in RPM
    direction : E_Direction;    // Forward or reverse
END_VAR
VAR_OUTPUT
    running : BOOL;             // Motor is running
    actualSpeed : REAL;         // Current speed in RPM
    error : BOOL;               // Error flag
    errorId : UDINT;            // Error code
END_VAR
VAR
    _state : E_MotorState;      // Internal state machine
    _rampTimer : TON;           // Ramp up timer
    _speedRamp : REAL;          // Current ramp value
END_VAR
VAR CONSTANT
    MAX_SPEED : REAL := 3000.0; // Maximum RPM
    RAMP_TIME : TIME := T#2s;   // Ramp up time
END_VAR

// Main execution
IF NOT enable THEN
    _state := E_MotorState.Stopped;
    running := FALSE;
    _speedRamp := 0.0;
ELSE
    CASE _state OF
        E_MotorState.Stopped:
            IF enable THEN
                _state := E_MotorState.Starting;
                _rampTimer(IN := TRUE, PT := RAMP_TIME);
            END_IF
            
        E_MotorState.Starting:
            _rampTimer(IN := TRUE);
            IF _rampTimer.Q THEN
                _state := E_MotorState.Running;
                _rampTimer(IN := FALSE);
            ELSE
                // Linear ramp
                _speedRamp := speedSetpoint * LREAL_TO_REAL(_rampTimer.ET) / LREAL_TO_REAL(RAMP_TIME);
            END_IF
            
        E_MotorState.Running:
            running := TRUE;
            _speedRamp := speedSetpoint;
            
            // Check for overspeed
            IF actualSpeed > MAX_SPEED THEN
                _state := E_MotorState.Error;
                error := TRUE;
                errorId := 16#8001;
            END_IF
            
        E_MotorState.Error:
            running := FALSE;
            _speedRamp := 0.0;
            // Reset on disable
            IF NOT enable THEN
                _state := E_MotorState.Stopped;
                error := FALSE;
                errorId := 0;
            END_IF
    END_CASE
END_IF

actualSpeed := _speedRamp;
END_FUNCTION_BLOCK

// Type definitions
TYPE E_Direction :
(
    Forward := 0,
    Reverse := 1
);
END_TYPE

TYPE E_MotorState :
(
    Stopped := 0,
    Starting := 1,
    Running := 2,
    Stopping := 3,
    Error := 99
);
END_TYPE
