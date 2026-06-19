CONFIGURATION OpcUaFixture
VAR_GLOBAL
    counter : DINT := 42;
    ready : BOOL := TRUE;
    name : STRING := 'pump';
END_VAR
TASK Fast (INTERVAL := T#10ms, PRIORITY := 0);
PROGRAM App WITH Fast : Main;
END_CONFIGURATION

PROGRAM Main
END_PROGRAM
