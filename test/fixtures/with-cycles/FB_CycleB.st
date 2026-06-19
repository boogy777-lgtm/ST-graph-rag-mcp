FUNCTION_BLOCK FB_CycleB
VAR_INPUT
    Trigger : BOOL;
END_VAR
VAR_OUTPUT
    ResultB : BOOL;
END_VAR
VAR
    InstanceC : FB_CycleC;
END_VAR
    // Вызывает FB_CycleC
    InstanceC(Trigger := Trigger);
    ResultB := InstanceC.ResultC;
END_FUNCTION_BLOCK
