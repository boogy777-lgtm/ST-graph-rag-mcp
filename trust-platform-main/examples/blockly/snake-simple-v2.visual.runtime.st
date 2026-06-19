(*
  Auto-generated runtime entry for snake-simple-v2.blockly.json.
  This wrapper is used to run visual editors through the Structured Text debugger path.
*)

PROGRAM PRG_snake_simple_v2_VISUAL
fb_snake_simple_v2();
END_PROGRAM

CONFIGURATION CFG_snake_simple_v2_VISUAL
VAR_GLOBAL
  fb_snake_simple_v2 : FB_snake_simple_v2_BLOCKLY;
END_VAR
  RESOURCE RES_snake_simple_v2_VISUAL ON PLC
    TASK TASK_snake_simple_v2_VISUAL(INTERVAL := T#20ms, PRIORITY := 1);
    PROGRAM PLC_PRG_snake_simple_v2 WITH TASK_snake_simple_v2_VISUAL : PRG_snake_simple_v2_VISUAL;
  END_RESOURCE
END_CONFIGURATION
