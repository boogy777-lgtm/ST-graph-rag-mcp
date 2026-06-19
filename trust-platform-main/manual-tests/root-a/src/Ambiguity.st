USING Core.Math;
USING Vendor.LibA;

PROGRAM Ambiguity
VAR
    x : DINT;
END_VAR
x := AddOne(x); (* ambiguous; expect disambiguation quick fix *)
END_PROGRAM
