NAMESPACE DemoImpl

CLASS Motor IMPLEMENTS DemoApi.IMotor
VAR
    speed_value : DINT := 0;
    running : BOOL := FALSE;
END_VAR

METHOD PUBLIC Start : BOOL
VAR_INPUT
    speed : DINT;
END_VAR
speed_value := speed;
running := TRUE;
Start := running;
END_METHOD

METHOD PUBLIC Stop : BOOL
running := FALSE;
Stop := running;
END_METHOD

PUBLIC PROPERTY Speed : DINT
GET
    Speed := speed_value;
END_GET
SET
    speed_value := Speed;
END_SET
END_PROPERTY
END_CLASS
END_NAMESPACE
