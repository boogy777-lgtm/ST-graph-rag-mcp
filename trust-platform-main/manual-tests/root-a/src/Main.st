NAMESPACE Plant

CLASS Counter
VAR
    x : DINT;
END_VAR

PUBLIC METHOD Next : DINT
    x := x + 1;
    Next := x;
END_METHOD

PROPERTY Value : DINT
    GET
        Value := x;
    END_GET
END_PROPERTY

END_CLASS

FUNCTION AddTwo : DINT
VAR_INPUT
    A : DINT;
    B : DINT;
END_VAR
AddTwo := A + B;
END_FUNCTION

FUNCTION_BLOCK FB_Adder
VAR_INPUT
    A : DINT;
    B : DINT;
END_VAR
VAR_OUTPUT
    Result : DINT;
END_VAR
Result := A + B;
END_FUNCTION_BLOCK

PROGRAM Main
VAR
    counter : Counter;
    adder : FB_Adder;
    outVal : DINT;
    str : STRING;
    (* removed TIME and direct I/O for debug clarity *)
END_VAR

(* formal/non-formal mixing *)
outVal := AddTwo(1, 2);

(* formal before positional: reorder to positional-first *)
adder(2, 3, Result => outVal);

(* output binding operator fix *)
adder(A := 1, B := 2, Result => outVal);

(* simple literal assignment for debug *)
str := 'abc';

(* call hierarchy + refs *)
outVal := counter.Next();
END_PROGRAM

END_NAMESPACE
