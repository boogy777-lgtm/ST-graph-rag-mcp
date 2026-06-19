PROGRAM Main
VAR
  StartBtn : BOOL := FALSE;
  StopBtn : BOOL := FALSE;
  FaultReset : BOOL := FALSE;
  Overload : BOOL := FALSE;
  MotorRun : BOOL := FALSE;
  FaultLatched : BOOL := FALSE;
  RunHours : REAL := 0.0;
  CycleSeconds : REAL := 0.02;
END_VAR

IF StopBtn THEN
  MotorRun := FALSE;
END_IF;

IF Overload THEN
  FaultLatched := TRUE;
  MotorRun := FALSE;
END_IF;

IF FaultReset THEN
  FaultLatched := FALSE;
END_IF;

IF StartBtn AND NOT FaultLatched THEN
  MotorRun := TRUE;
END_IF;

IF MotorRun THEN
  RunHours := RunHours + (CycleSeconds / 3600.0);
END_IF;
END_PROGRAM
