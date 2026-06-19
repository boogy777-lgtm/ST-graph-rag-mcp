(*
    Hardware Backend: 8 Digital Outputs
    
    This is a minimal ST program that defines I/O variables.
    
    The actual control logic can come from:
    - Blockly visual programs (interpreted via control endpoint)
    - Statechart programs (interpreted via control endpoint)
    - ST code written here
    
    For visual editors (Blockly/Statechart), the outputs are controlled
    through the control endpoint at /tmp/trust-debug.sock, not by this code.
*)

PROGRAM Main
VAR
    // Digital outputs mapped to hardware (EL2008 or GPIO)
    DO0 AT %QX0.0 : BOOL;
    DO1 AT %QX0.1 : BOOL;
    DO2 AT %QX0.2 : BOOL;
    DO3 AT %QX0.3 : BOOL;
    DO4 AT %QX0.4 : BOOL;
    DO5 AT %QX0.5 : BOOL;
    DO6 AT %QX0.6 : BOOL;
    DO7 AT %QX0.7 : BOOL;
    
    // Heartbeat to show program is running
    heartbeat : BOOL;
END_VAR

// Toggle heartbeat every cycle
heartbeat := NOT heartbeat;

// For visual editors: outputs controlled via control endpoint
// For ST programs: add your logic here

END_PROGRAM
