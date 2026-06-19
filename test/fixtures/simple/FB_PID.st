FUNCTION_BLOCK FB_PID EXTENDS FB_BaseController IMPLEMENTS I_Controller
VAR_INPUT
    Enable : BOOL;
    SetPoint : REAL;
    ProcessValue : REAL;
    Kp : REAL := 1.0;
    Ki : REAL := 0.1;
    Kd : REAL := 0.01;
END_VAR
VAR_OUTPUT
    Output : REAL;
    Error : REAL;
    IsActive : BOOL;
END_VAR
VAR
    Integral : REAL;
    Derivative : REAL;
    LastError : REAL;
END_VAR
VAR_TEMP
    TempError : REAL;
    TempOutput : REAL;
END_VAR
    // Основной алгоритм PID
    TempError := SetPoint - ProcessValue;
    Error := TempError;
    Integral := Integral + TempError * Ki;
    Derivative := (TempError - LastError) * Kd;
    LastError := TempError;
    TempOutput := Kp * TempError + Integral + Derivative;
    Output := LIMIT(0.0, TempOutput, 100.0);
    IsActive := Enable;
END_FUNCTION_BLOCK
