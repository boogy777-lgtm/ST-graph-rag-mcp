FUNCTION_BLOCK FB_CycleC
VAR_INPUT
    Trigger : BOOL;
END_VAR
VAR_OUTPUT
    ResultC : BOOL;
END_VAR
VAR
    InstanceA : FB_CycleA;
END_VAR
    // Циклический вызов обратно к FB_CycleA
    InstanceA(Trigger := Trigger);
    ResultC := InstanceA.ResultA;
END_FUNCTION_BLOCK
