NAMESPACE Repro

INTERFACE IFoo
    METHOD Next : DINT
    END_METHOD
END_INTERFACE

CLASS Foo IMPLEMENTS IFoo
VAR
    x : DINT;
END_VAR

METHOD Next : DINT
    x := x + 1;
    Next := x;
END_METHOD
END_CLASS

FUNCTION AddTwo : DINT
VAR_INPUT
    A : DINT;
    B : DINT;
END_VAR
AddTwo := A + B;
END_FUNCTION

PROGRAM ReproMain
VAR
    foo : Foo;
    outVal : DINT;
END_VAR

outVal := AddTwo(A := 1, 2);
outVal := foo.Next();
END_PROGRAM

END_NAMESPACE
