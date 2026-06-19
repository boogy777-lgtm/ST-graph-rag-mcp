PROGRAM Main
VAR
    Controller : PumpController;
    StartCmd : BOOL := TRUE;
END_VAR

Controller(Enable := StartCmd);
END_PROGRAM

FUNCTION_BLOCK PumpController
VAR_INPUT
    Enable : BOOL;
END_VAR
VAR
    Config : PumpConfig;
    RunTimer : TON;
END_VAR

RunTimer(IN := Enable, PT := Config.RampTime);
END_FUNCTION_BLOCK
