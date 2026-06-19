PROGRAM Main
VAR
    a : DINT := 1;
    prev_a : DINT := 0;
    b : DINT := 0;
    c : DINT := 0;
END_VAR

prev_a := a;
a := a + 1;
b := a;
c := b + prev_a;
END_PROGRAM
