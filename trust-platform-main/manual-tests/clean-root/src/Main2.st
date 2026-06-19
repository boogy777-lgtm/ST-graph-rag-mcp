PROGRAM Main2
VAR
    counter : CounterFb;
    outVal : DINT;
    ok : BOOL;
END_VAR
outVal := AddTwo(A := 1, B := 2);
outVal := AddTwo(EN := TRUE, A := 1, B := 2, ENO => ok);
outVal := counter.Next();
outVal := counter.Value;
END_PROGRAM
