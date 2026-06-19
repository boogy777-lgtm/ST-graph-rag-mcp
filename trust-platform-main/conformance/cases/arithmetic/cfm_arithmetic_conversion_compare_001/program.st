PROGRAM Main
VAR
    rounded_even_low : INT := 0;
    rounded_even_high : INT := 0;
    cmp_lt : BOOL := FALSE;
    cmp_eq : BOOL := FALSE;
    near_max : DINT := 0;
END_VAR

rounded_even_low := REAL_TO_INT(REAL#1.5);
rounded_even_high := REAL_TO_INT(REAL#2.5);
cmp_lt := INT#-1 < INT#0;
cmp_eq := REAL#1.0 = REAL#1.0;
near_max := DINT#2147483647 - DINT#1;
END_PROGRAM
