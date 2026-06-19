(* Test corpus: Expressions and operator precedence *)

PROGRAM TestExpressions

VAR
    a, b, c, d : INT;
    x, y, z : REAL;
    p, q, r : BOOL;
    s1, s2 : STRING;
    arr : ARRAY[0..9] OF INT;
    ptr : POINTER TO INT;
    fb : FB_Test;
END_VAR

(* ============================================= *)
(* Arithmetic operators *)
(* ============================================= *)

(* Addition *)
a := 1 + 2;
a := b + c;
x := 1.0 + 2.5;

(* Subtraction *)
a := 5 - 3;
a := b - c;
x := 10.0 - 3.5;

(* Multiplication *)
a := 3 * 4;
a := b * c;
x := 2.0 * 3.14;

(* Division *)
a := 10 / 2;
x := 10.0 / 3.0;

(* Modulo *)
a := 10 MOD 3;
a := b MOD c;

(* Exponentiation - right associative *)
x := 2.0 ** 3.0;
x := 2.0 ** 3.0 ** 2.0;  (* = 2^(3^2) = 2^9 = 512 *)

(* Unary operators *)
a := -b;
a := +c;
x := -3.14;

(* ============================================= *)
(* Comparison operators *)
(* ============================================= *)

p := a = b;
p := a <> b;
p := a < b;
p := a <= b;
p := a > b;
p := a >= b;

(* String comparison *)
p := s1 = s2;
p := s1 < s2;

(* ============================================= *)
(* Logical operators *)
(* ============================================= *)

(* AND *)
p := q AND r;
p := q & r;

(* OR *)
p := q OR r;

(* XOR *)
p := q XOR r;

(* NOT *)
p := NOT q;

(* ============================================= *)
(* Bitwise operators *)
(* ============================================= *)

a := b AND c;
a := b OR c;
a := b XOR c;
a := NOT b;

(* ============================================= *)
(* Operator precedence tests *)
(* ============================================= *)

(* Precedence: * before + *)
a := 1 + 2 * 3;         (* = 1 + 6 = 7 *)
a := (1 + 2) * 3;       (* = 3 * 3 = 9 *)

(* Precedence: AND before OR *)
p := TRUE OR FALSE AND FALSE;     (* = TRUE OR FALSE = TRUE *)
p := (TRUE OR FALSE) AND FALSE;   (* = TRUE AND FALSE = FALSE *)

(* Precedence: comparison before logical *)
p := a < b AND c > d;   (* = (a < b) AND (c > d) *)

(* Precedence: arithmetic before comparison *)
p := a + b < c + d;     (* = (a + b) < (c + d) *)

(* Precedence: NOT has highest priority *)
p := NOT q AND r;       (* = (NOT q) AND r *)
p := NOT (q AND r);     (* = NOT (q AND r) *)

(* Complex precedence *)
a := 1 + 2 * 3 - 4 / 2;     (* = 1 + 6 - 2 = 5 *)
p := a > b OR c < d AND NOT r;  (* = (a > b) OR ((c < d) AND (NOT r)) *)

(* Power is right associative *)
x := 2.0 ** 2.0 ** 3.0;     (* = 2^(2^3) = 2^8 = 256 *)

(* ============================================= *)
(* Parenthesized expressions *)
(* ============================================= *)

a := (b);
a := ((b));
a := (b + c);
a := (b + c) * d;
a := ((b + c) * (d - a));

(* ============================================= *)
(* Function calls *)
(* ============================================= *)

x := SIN(3.14);
x := ABS(-42);
a := MAX(b, c);
x := SQRT(y);

(* Nested function calls *)
x := SIN(COS(3.14));
x := ABS(MIN(a, b));

(* Function call in expression *)
x := 2.0 * SIN(y) + 1.0;

(* Named parameters *)
(* result := MyFunc(param1 := 10, param2 := 20); *)

(* ============================================= *)
(* Array indexing *)
(* ============================================= *)

a := arr[0];
a := arr[b];
a := arr[b + 1];
a := arr[b * 2 + c];

(* Multi-dimensional *)
(* a := matrix[i, j]; *)
(* a := matrix[i][j]; *)

(* ============================================= *)
(* Field access *)
(* ============================================= *)

a := fb.value;
x := fb.data.x;
a := fb.nested.deep.value;

(* Method call *)
a := fb.GetValue();
fb.SetValue(10);

(* ============================================= *)
(* Pointer operations *)
(* ============================================= *)

(* Dereference *)
a := ptr^;

(* Address-of *)
ptr := ADR(a);

(* SIZEOF *)
a := SIZEOF(INT);
a := SIZEOF(arr);
a := SIZEOF(fb);

(* ============================================= *)
(* Special expressions *)
(* ============================================= *)

(* THIS and SUPER *)
(* a := THIS.value; *)
(* a := SUPER.GetValue(); *)

(* Direct addresses *)
(* a := %IW10; *)
(* p := %IX0.0; *)

(* Typed literals in expressions *)
a := INT#42 + INT#10;
x := REAL#3.14 * REAL#2.0;

(* ============================================= *)
(* Complex expressions *)
(* ============================================= *)

(* Combined arithmetic and logic *)
p := (a + b > c) AND (d - a < 10) OR NOT q;

(* Expression with function call and array *)
a := arr[MAX(b, c)] + ABS(d);

(* Expression with field access *)
x := fb.value * SIN(fb.angle);

(* Very complex expression *)
x := ((a + b) * SIN(c / d)) / (SQRT(y ** 2.0 + z ** 2.0) + 1.0);

END_PROGRAM

(* Function block for testing *)
FUNCTION_BLOCK FB_Test
VAR
    value : INT;
    angle : REAL;
    data : ST_Data;
    nested : FB_Nested;
END_VAR

METHOD GetValue : INT
    GetValue := value;
END_METHOD

METHOD SetValue
VAR_INPUT
    newValue : INT;
END_VAR
    value := newValue;
END_METHOD
END_FUNCTION_BLOCK

FUNCTION_BLOCK FB_Nested
VAR
    deep : ST_Deep;
END_VAR
END_FUNCTION_BLOCK

TYPE ST_Data :
STRUCT
    x : REAL;
    y : REAL;
END_STRUCT
END_TYPE

TYPE ST_Deep :
STRUCT
    value : INT;
END_STRUCT
END_TYPE

(* Test expression edge cases *)
FUNCTION TestEdgeCases : BOOL
VAR
    a : INT;
    x : REAL;
    p : BOOL;
END_VAR

(* Double negation *)
a := --5;
a := -(-a);
x := --3.14;

(* NOT NOT *)
p := NOT NOT TRUE;
p := NOT NOT p;

(* Chained comparisons need explicit grouping *)
p := (a < 5) AND (5 < 10);

(* Very deep nesting *)
a := ((((((1 + 2) * 3) - 4) / 5) MOD 6) + 7);

TestEdgeCases := TRUE;
END_FUNCTION
