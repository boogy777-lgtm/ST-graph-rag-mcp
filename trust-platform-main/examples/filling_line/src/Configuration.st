CONFIGURATION FillingLine
TASK Cycle (INTERVAL := T#50ms, PRIORITY := 1);
PROGRAM P1 WITH Cycle : MainProgram;
VAR_CONFIG
    P1.StartCmd AT %IX0.0 : BOOL;
    P1.StopCmd AT %IX0.1 : BOOL;
    P1.LevelRaw AT %IW0 : INT;
    P1.FillValveOut AT %QX0.0 : BOOL;
    P1.DrainValveOut AT %QX0.1 : BOOL;
    P1.PumpSpeedOut AT %QW0 : INT;
END_VAR
END_CONFIGURATION
