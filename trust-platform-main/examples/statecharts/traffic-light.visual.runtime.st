(*
  Auto-generated runtime entry for traffic-light.statechart.json.
  This wrapper is used to run visual editors through the Structured Text debugger path.
*)

PROGRAM PRG_traffic_light_VISUAL
fb_traffic_light();
END_PROGRAM

CONFIGURATION CFG_traffic_light_VISUAL
VAR_GLOBAL
  fb_traffic_light : FB_traffic_light_STATECHART;
END_VAR
  RESOURCE RES_traffic_light_VISUAL ON PLC
    TASK TASK_traffic_light_VISUAL(INTERVAL := T#20ms, PRIORITY := 1);
    PROGRAM PLC_PRG_traffic_light WITH TASK_traffic_light_VISUAL : PRG_traffic_light_VISUAL;
  END_RESOURCE
END_CONFIGURATION
