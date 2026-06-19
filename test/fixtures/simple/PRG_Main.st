PROGRAM PRG_Main
VAR
    PidController : FB_PID;
    SensorValue : REAL;
    TargetValue : REAL := 50.0;
    ControlOutput : REAL;
END_VAR
VAR_INPUT
    StartCommand : BOOL;
END_VAR
VAR_OUTPUT
    SystemReady : BOOL;
END_VAR
    // Инициализация контроллера
    PidController(Enable := StartCommand, SetPoint := TargetValue, ProcessValue := SensorValue);
    
    // Чтение выхода PID
    ControlOutput := PidController.Output;
    SystemReady := PidController.IsActive;
END_PROGRAM
