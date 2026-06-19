(*
  Auto-generated from statechart source: traffic-light.statechart.json
  Source of truth is the visual file unless migrated fully to ST.
*)
(*
  Auto-generated Statechart companion.
  Source of truth remains the .statechart.json file.
  Generated to support .st-first runtime workflows.
*)

FUNCTION_BLOCK FB_traffic_light_STATECHART
VAR_INPUT
  EV_TIMER : BOOL;
  EV_NEXT : BOOL;
END_VAR
VAR_OUTPUT
  STATE_INDEX : INT;
  STATE_NAME : STRING[80];
END_VAR
VAR
  _initialized : BOOL := FALSE;
  _state : INT := 0;
END_VAR

(* State encoding *)
(*  0 = Red *)
(*  1 = Green *)
(*  2 = Yellow *)
(*  3 = State4 *)

IF NOT _initialized THEN
  _state := 0;
  _initialized := TRUE;
END_IF;

CASE _state OF
  0:
    IF EV_TIMER THEN
      %QX0.0 := FALSE;
      (* LOG: Traffic light transition *)
      (* LOG: Entering GREEN state *)
      %QX0.1 := TRUE;
      _state := 1;
    END_IF;
  1:
    IF EV_TIMER THEN
      %QX0.1 := FALSE;
      (* LOG: Traffic light transition *)
      (* LOG: Entering YELLOW state *)
      %QX0.2 := TRUE;
      _state := 2;
    ELSIF EV_NEXT THEN
      %QX0.1 := FALSE;
      _state := 3;
    END_IF;
  2:
    IF EV_TIMER THEN
      %QX0.2 := FALSE;
      (* LOG: Traffic light transition *)
      (* LOG: Entering RED state *)
      %QX0.0 := TRUE;
      _state := 0;
    END_IF;
  3:
    IF EV_NEXT THEN
      (* LOG: Entering YELLOW state *)
      %QX0.2 := TRUE;
      _state := 2;
    END_IF;
END_CASE;

STATE_INDEX := _state;
CASE _state OF
  0: STATE_NAME := 'Red';
  1: STATE_NAME := 'Green';
  2: STATE_NAME := 'Yellow';
  3: STATE_NAME := 'State4';
  ELSE
    STATE_NAME := 'UNKNOWN';
END_CASE;
END_FUNCTION_BLOCK
