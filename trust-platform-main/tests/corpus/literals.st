(* Test corpus: All literal types *)

PROGRAM TestLiterals

VAR
    (* Integer literals *)
    intDec : INT := 123;
    intNeg : INT := -456;
    intZero : INT := 0;
    intWithUnder : DINT := 1_000_000;

    (* Hexadecimal literals *)
    intHex : DWORD := 16#FF;
    intHexLower : DWORD := 16#ff;
    intHexMixed : DWORD := 16#DeAdBeEf;
    intHexUnder : DWORD := 16#DEAD_BEEF;

    (* Binary literals *)
    intBin : BYTE := 2#10101010;
    intBinUnder : WORD := 2#1111_0000_1111_0000;

    (* Octal literals *)
    intOct : INT := 8#77;
    intOctUnder : INT := 8#7_7_7;

    (* Real literals *)
    realSimple : REAL := 3.14;
    realNeg : REAL := -2.718;
    realZero : REAL := 0.0;
    realSmall : REAL := 0.001;
    realWithUnder : LREAL := 1_000.000_001;

    (* Scientific notation *)
    realSci1 : LREAL := 1.0E10;
    realSci2 : LREAL := 2.5e-3;
    realSci3 : LREAL := 6.022E+23;
    realSciNeg : LREAL := -1.6E-19;

    (* Boolean literals *)
    boolTrue : BOOL := TRUE;
    boolFalse : BOOL := FALSE;
    boolTrueLower : BOOL := true;
    boolFalseLower : BOOL := false;

    (* String literals - single quote *)
    strEmpty : STRING := '';
    strSimple : STRING := 'Hello, World!';
    strWithEscape : STRING := 'Line1$NLine2';
    strWithQuote : STRING := 'It$'s working';
    strPath : STRING := 'C:\Program Files\App';

    (* Wide string literals - double quote *)
    wstrEmpty : WSTRING := "";
    wstrSimple : WSTRING := "Wide string";
    wstrUnicode : WSTRING := "日本語";

    (* Time literals *)
    timeSimple : TIME := T#1s;
    timeLong : TIME := TIME#1h30m45s;
    timeMs : TIME := T#100ms;
    timeComplex : TIME := T#1d2h3m4s5ms;
    timeUnder : TIME := T#1000ms;
    ltimeVal : LTIME := LTIME#1h;

    (* Date literals *)
    dateSimple : DATE := D#2024-01-15;
    dateFull : DATE := DATE#2024-12-31;

    (* Time of day literals *)
    todSimple : TIME_OF_DAY := TOD#12:30:00;
    todFull : TIME_OF_DAY := TIME_OF_DAY#23:59:59.999;
    todMidnight : TIME_OF_DAY := TOD#00:00:00;

    (* Date and time literals *)
    dtSimple : DATE_AND_TIME := DT#2024-01-15-12:30:00;
    dtFull : DATE_AND_TIME := DATE_AND_TIME#2024-12-31-23:59:59;
END_VAR

VAR
    (* Typed literals *)
    typedInt : INT := INT#42;
    typedDint : DINT := DINT#1000000;
    typedReal : REAL := REAL#3.14;
    typedBool : BOOL := BOOL#TRUE;
    typedByte : BYTE := BYTE#16#FF;
    typedWord : WORD := WORD#2#1010101010101010;
    typedLreal : LREAL := LREAL#1.0E-10;

    (* Typed literals with type prefix *)
    hexTyped : DWORD := DWORD#16#DEADBEEF;
    binTyped : BYTE := BYTE#2#11110000;

    (* Enum typed literals - common pattern *)
    (* enumVal : MyEnum := MyEnum#Value1; *)
END_VAR

VAR CONSTANT
    (* Constants with various literal types *)
    CONST_PI : LREAL := 3.14159265358979;
    CONST_E : LREAL := 2.71828182845905;
    CONST_MAX_INT : DINT := 2147483647;
    CONST_MIN_INT : DINT := -2147483648;
    CONST_HEX : DWORD := 16#FFFFFFFF;
    CONST_TIMEOUT : TIME := T#30s;
    CONST_MSG : STRING := 'Constant message';
END_VAR

END_PROGRAM

(* Test literals in expressions *)
FUNCTION TestLiteralExpressions : BOOL
VAR
    result : REAL;
    flag : BOOL;
    text : STRING;
END_VAR

(* Literals in arithmetic *)
result := 10 + 20;
result := 3.14 * 2.0;
result := 16#FF + 1;
result := 2#1010 AND 2#1100;

(* Literals in comparisons *)
flag := 100 > 50;
flag := 3.14 < 4.0;
flag := 'abc' < 'abd';

(* Literals in function calls *)
result := SIN(3.14159);
result := ABS(-42);

(* Time arithmetic *)
(* delay := T#1s + T#500ms; *)

(* Literals in array access *)
(* arr[0] := 1; *)
(* arr[16#0A] := 10; *)

TestLiteralExpressions := TRUE;
END_FUNCTION

(* Test edge cases *)
PROGRAM TestLiteralEdgeCases
VAR
    (* Very large numbers *)
    bigInt : LINT := 9223372036854775807;
    bigReal : LREAL := 1.7976931348623157E+308;

    (* Very small numbers *)
    smallReal : LREAL := 2.2250738585072014E-308;

    (* Zero variants *)
    zeroInt : INT := 0;
    zeroReal : REAL := 0.0;
    zeroHex : DWORD := 16#0;
    zeroBin : BYTE := 2#0;

    (* Long strings *)
    longStr : STRING[255] := 'This is a very long string that contains many characters and is used to test the parser handling of long string literals in the source code.';
END_VAR
END_PROGRAM
