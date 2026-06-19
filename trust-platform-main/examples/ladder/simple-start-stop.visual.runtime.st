(*
  Auto-generated runtime entry for simple-start-stop.ladder.json.
  This wrapper is used to run visual editors through the Structured Text debugger path.
*)

PROGRAM PRG_simple_start_stop_VISUAL
fb_simple_start_stop();
END_PROGRAM

CONFIGURATION CFG_simple_start_stop_VISUAL
VAR_GLOBAL
  fb_simple_start_stop : FB_simple_start_stop_LADDER;
  StartPB AT %IX0.0 : BOOL;
  StopPB AT %IX0.1 : BOOL;
  MotorRun AT %QX0.0 : BOOL;
  AlarmLamp AT %QX0.1 : BOOL;
END_VAR
  RESOURCE RES_simple_start_stop_VISUAL ON PLC
    TASK TASK_simple_start_stop_VISUAL(INTERVAL := T#20ms, PRIORITY := 1);
    PROGRAM PLC_PRG_simple_start_stop WITH TASK_simple_start_stop_VISUAL : PRG_simple_start_stop_VISUAL;
  END_RESOURCE
END_CONFIGURATION
