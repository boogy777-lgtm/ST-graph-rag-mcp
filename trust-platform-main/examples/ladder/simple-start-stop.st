(*
  Auto-generated from ladder source: simple-start-stop.ladder.json
  Source of truth is the visual file unless migrated fully to ST.
*)
(*
  Auto-generated Ladder Diagram companion (schema v2).
  Source of truth remains the .ladder.json file.
  Generated to support .st-first runtime workflows.
*)

FUNCTION_BLOCK FB_simple_start_stop_LADDER
VAR_EXTERNAL
  StartPB : BOOL;
  StopPB : BOOL;
  MotorRun : BOOL;
  AlarmLamp : BOOL;
END_VAR

VAR
  dfg : BOOL := FALSE; (* Ladder local *)
  test : BOOL := FALSE; (* Ladder local *)
END_VAR

(* Network 0: rung_1 *)
MotorRun := StartPB OR dfg OR test;

(* Network 1: rung_2 *)
AlarmLamp := NOT (StopPB);

END_FUNCTION_BLOCK
