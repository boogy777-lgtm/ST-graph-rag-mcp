FUNCTION_BLOCK FB_BaseController
VAR_INPUT
    Enable : BOOL;
    Reset : BOOL;
END_VAR
VAR_OUTPUT
    Status : INT;
    Ready : BOOL;
END_VAR
VAR
    InternalState : INT := 0;
END_VAR
    IF Reset THEN
        InternalState := 0;
        Status := 0;
        Ready := FALSE;
    ELSIF Enable THEN
        InternalState := 1;
        Ready := TRUE;
    END_IF;
END_FUNCTION_BLOCK
