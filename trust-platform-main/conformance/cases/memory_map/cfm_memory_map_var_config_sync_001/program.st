PROGRAM Main
VAR
    counter : INT;
    observed : INT;
END_VAR

observed := counter;
counter := counter + 1;
END_PROGRAM

CONFIGURATION Conf
PROGRAM P1 : Main;
VAR_CONFIG
    P1.counter AT %MW0 : INT;
END_VAR
END_CONFIGURATION
