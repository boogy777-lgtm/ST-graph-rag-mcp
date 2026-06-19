(*
  Auto-generated from ladder source: ethercat-snake.ladder.json
  Source of truth is the visual file unless migrated fully to ST.
*)
(*
  Auto-generated Ladder Diagram companion (schema v2).
  Source of truth remains the .ladder.json file.
  Generated to support .st-first runtime workflows.
*)

FUNCTION_BLOCK FB_ethercat_snake_LADDER
(* Network 0: rung_step0_set *)
IF %MX0.0 AND NOT (%MX1.0) THEN
  %MX1.0 := TRUE;
END_IF;

(* Network 1: rung_step0_output *)
%QX0.0 := %MX1.0;

(* Network 2: rung_step1_set *)
IF %MX1.0 AND NOT (%MX2.0) THEN
  %MX2.0 := TRUE;
END_IF;
IF %MX1.0 AND NOT (%MX2.0) THEN
  %MX1.0 := FALSE;
END_IF;

(* Network 3: rung_step1_output *)
%QX0.1 := %MX2.0;

(* Network 4: rung_step2_set *)
IF %MX2.0 AND NOT (%MX3.0) THEN
  %MX3.0 := TRUE;
END_IF;
IF %MX2.0 AND NOT (%MX3.0) THEN
  %MX2.0 := FALSE;
END_IF;

(* Network 5: rung_step2_output *)
%QX0.2 := %MX3.0;

(* Network 6: rung_step3_set *)
IF %MX3.0 AND NOT (%MX4.0) THEN
  %MX4.0 := TRUE;
END_IF;
IF %MX3.0 AND NOT (%MX4.0) THEN
  %MX3.0 := FALSE;
END_IF;

(* Network 7: rung_step3_output *)
%QX0.3 := %MX4.0;

(* Network 8: rung_step4_set *)
IF %MX4.0 AND NOT (%MX5.0) THEN
  %MX5.0 := TRUE;
END_IF;
IF %MX4.0 AND NOT (%MX5.0) THEN
  %MX4.0 := FALSE;
END_IF;

(* Network 9: rung_step4_output *)
%QX0.4 := %MX5.0;

(* Network 10: rung_step5_set *)
IF %MX5.0 AND NOT (%MX6.0) THEN
  %MX6.0 := TRUE;
END_IF;
IF %MX5.0 AND NOT (%MX6.0) THEN
  %MX5.0 := FALSE;
END_IF;

(* Network 11: rung_step5_output *)
%QX0.5 := %MX6.0;

(* Network 12: rung_step6_set *)
IF %MX6.0 AND NOT (%MX7.0) THEN
  %MX7.0 := TRUE;
END_IF;
IF %MX6.0 AND NOT (%MX7.0) THEN
  %MX6.0 := FALSE;
END_IF;

(* Network 13: rung_step6_output *)
%QX0.6 := %MX7.0;

(* Network 14: rung_step7_set *)
IF %MX7.0 AND NOT (%MX8.0) THEN
  %MX8.0 := TRUE;
END_IF;
IF %MX7.0 AND NOT (%MX8.0) THEN
  %MX7.0 := FALSE;
END_IF;

(* Network 15: rung_step7_output *)
%QX0.7 := %MX8.0;

(* Network 16: rung_restart *)
IF %MX8.0 AND NOT (%MX1.0) THEN
  %MX1.0 := TRUE;
END_IF;
IF %MX8.0 AND NOT (%MX1.0) THEN
  %MX8.0 := FALSE;
END_IF;

END_FUNCTION_BLOCK
