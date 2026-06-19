(*
  Auto-generated runtime entry for ethercat-snake.ladder.json.
  This wrapper is used to run visual editors through the Structured Text debugger path.
*)

PROGRAM PRG_ethercat_snake_VISUAL
fb_ethercat_snake();
END_PROGRAM

CONFIGURATION CFG_ethercat_snake_VISUAL
VAR_GLOBAL
  fb_ethercat_snake : FB_ethercat_snake_LADDER;
END_VAR
  RESOURCE RES_ethercat_snake_VISUAL ON PLC
    TASK TASK_ethercat_snake_VISUAL(INTERVAL := T#20ms, PRIORITY := 1);
    PROGRAM PLC_PRG_ethercat_snake WITH TASK_ethercat_snake_VISUAL : PRG_ethercat_snake_VISUAL;
  END_RESOURCE
END_CONFIGURATION
