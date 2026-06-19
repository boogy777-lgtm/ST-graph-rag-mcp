FUNCTION Inc : DINT
VAR_INPUT
    Value : DINT;
END_VAR
Inc := Value + 1;
END_FUNCTION

PROGRAM Main
VAR
    InSignal : BOOL;
    OutSignal : BOOL;
    Count : DINT := 0;
    WordIn : WORD;
    WordInCopy : WORD;
END_VAR

OutSignal := InSignal;
Count := Inc(Count);
WordInCopy := WordIn;
END_PROGRAM
