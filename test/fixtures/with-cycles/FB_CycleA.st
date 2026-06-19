FUNCTION_BLOCK FB_CycleA
VAR_INPUT
    Trigger : BOOL;
END_VAR
VAR_OUTPUT
    ResultA : BOOL;
END_VAR
VAR
    InstanceB : FB_CycleB;
END_VAR
    // Вызывает FB_CycleB, который вызывает FB_CycleC, который вызывает FB_CycleA
    InstanceB(Trigger := Trigger);
    ResultA := InstanceB.ResultB;
END_FUNCTION_BLOCK
