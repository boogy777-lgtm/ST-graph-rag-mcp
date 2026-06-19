USING Demo.Math;

PROGRAM Main
VAR
    value : DINT;
    result : DINT;
    t : TIME;
END_VAR

value := 41;
result := AddOne(value);
t := T#1s;

END_PROGRAM
