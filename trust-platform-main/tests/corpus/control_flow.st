(* Test corpus: Control flow statements *)

PROGRAM TestControlFlow

VAR
    i, j, k : INT;
    condition : BOOL;
    state : INT;
    result : INT;
    sum : INT;
    arr : ARRAY[0..9] OF INT;
END_VAR

(* Simple IF *)
IF condition THEN
    result := 1;
END_IF

(* IF-ELSE *)
IF condition THEN
    result := 1;
ELSE
    result := 0;
END_IF

(* IF-ELSIF-ELSE *)
IF i < 0 THEN
    result := -1;
ELSIF i = 0 THEN
    result := 0;
ELSIF i > 0 AND i < 10 THEN
    result := 1;
ELSE
    result := 2;
END_IF

(* Nested IF *)
IF condition THEN
    IF i > 0 THEN
        result := 1;
    ELSE
        result := 2;
    END_IF
END_IF

(* Simple CASE *)
CASE state OF
    0: result := 0;
    1: result := 1;
    2: result := 2;
END_CASE

(* CASE with multiple labels *)
CASE state OF
    0, 1, 2:
        result := 0;
    3, 4, 5:
        result := 1;
    6..10:
        result := 2;
END_CASE

(* CASE with ELSE *)
CASE state OF
    0:
        result := 0;
    1:
        result := 1;
ELSE
    result := -1;
END_CASE

(* CASE with multiple statements *)
CASE state OF
    0:
        result := 0;
        condition := FALSE;
    1:
        result := 1;
        condition := TRUE;
END_CASE

(* Simple FOR *)
FOR i := 0 TO 9 DO
    arr[i] := i;
END_FOR

(* FOR with BY *)
FOR i := 0 TO 100 BY 10 DO
    sum := sum + i;
END_FOR

(* FOR counting down *)
FOR i := 10 TO 0 BY -1 DO
    arr[i] := i * 2;
END_FOR

(* Nested FOR *)
FOR i := 0 TO 9 DO
    FOR j := 0 TO 9 DO
        result := i * 10 + j;
    END_FOR
END_FOR

(* Simple WHILE *)
i := 0;
WHILE i < 10 DO
    sum := sum + i;
    i := i + 1;
END_WHILE

(* WHILE with complex condition *)
WHILE i < 10 AND NOT condition DO
    i := i + 1;
END_WHILE

(* Nested WHILE *)
i := 0;
WHILE i < 5 DO
    j := 0;
    WHILE j < 5 DO
        result := i * j;
        j := j + 1;
    END_WHILE
    i := i + 1;
END_WHILE

(* Simple REPEAT *)
i := 0;
REPEAT
    sum := sum + i;
    i := i + 1;
UNTIL i >= 10
END_REPEAT

(* REPEAT with complex condition *)
REPEAT
    i := i + 1;
    condition := i MOD 2 = 0;
UNTIL condition OR i > 100
END_REPEAT

(* EXIT from loop *)
FOR i := 0 TO 100 DO
    IF i > 50 THEN
        EXIT;
    END_IF
    sum := sum + i;
END_FOR

(* CONTINUE in loop *)
FOR i := 0 TO 9 DO
    IF i MOD 2 = 0 THEN
        CONTINUE;
    END_IF
    sum := sum + i;
END_FOR

(* EXIT from nested loop *)
FOR i := 0 TO 9 DO
    FOR j := 0 TO 9 DO
        IF i * j > 50 THEN
            EXIT;
        END_IF
    END_FOR
END_FOR

(* Empty statement *)
;

(* Multiple empty statements *)
;;

END_PROGRAM

(* Function with RETURN *)
FUNCTION CalcSum : INT
VAR_INPUT
    n : INT;
END_VAR
VAR
    i : INT;
    sum : INT;
END_VAR

IF n <= 0 THEN
    RETURN;
END_IF

FOR i := 1 TO n DO
    sum := sum + i;
END_FOR

CalcSum := sum;
END_FUNCTION

(* Function with early RETURN *)
FUNCTION FindIndex : INT
VAR_INPUT
    arr : ARRAY[0..9] OF INT;
    value : INT;
END_VAR
VAR
    i : INT;
END_VAR

FOR i := 0 TO 9 DO
    IF arr[i] = value THEN
        FindIndex := i;
        RETURN;
    END_IF
END_FOR

FindIndex := -1;
END_FUNCTION

(* Complex control flow *)
FUNCTION_BLOCK FB_StateMachine
VAR
    state : INT;
    counter : INT;
    done : BOOL;
END_VAR

CASE state OF
    0: (* Init *)
        counter := 0;
        state := 1;

    1: (* Process *)
        WHILE counter < 100 AND NOT done DO
            counter := counter + 1;
            IF counter MOD 10 = 0 THEN
                (* Check condition *)
                IF counter > 50 THEN
                    done := TRUE;
                    EXIT;
                END_IF
            END_IF
        END_WHILE

        IF done THEN
            state := 2;
        END_IF

    2: (* Done *)
        ; (* Empty - wait *)
END_CASE

END_FUNCTION_BLOCK
