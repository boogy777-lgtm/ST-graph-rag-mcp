FUNCTION_BLOCK FB_Motor
VAR_INPUT
  Speed : INT;
  Enable : BOOL;
END_VAR
VAR_OUTPUT
  Running : BOOL;
  Current : REAL;
END_VAR
VAR
  Timer : TON;
END_VAR

IF Enable THEN
  Running := TRUE;
  Current := Speed * 0.5;
ELSE
  Running := FALSE;
END_IF
END_FUNCTION_BLOCK