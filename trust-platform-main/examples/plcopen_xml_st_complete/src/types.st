TYPE
  PumpMode : (Stopped := 0, Running := 1, Fault := 2);
  PumpConfig : STRUCT
    RampTime : TIME := T#2s;
    MaxStartsPerHour : UINT := 10;
  END_STRUCT;
  PumpIndex : INT(1..16);
  PumpAlarmLatch : ARRAY[1..4] OF BOOL;
END_TYPE
