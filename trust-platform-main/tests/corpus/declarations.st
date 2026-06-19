(* Test corpus: Variable declarations and modifiers *)

PROGRAM TestDeclarations

(* Basic variable block *)
VAR
    simpleVar : INT;
    multipleVars, anotherVar : BOOL;
    initialized : REAL := 3.14;
END_VAR

(* Input variables *)
VAR_INPUT
    inputBool : BOOL;
    inputInt : INT := 100;
END_VAR

(* Output variables *)
VAR_OUTPUT
    outputStatus : BOOL;
    outputValue : REAL;
END_VAR

(* In-out variables *)
VAR_IN_OUT
    inoutData : ARRAY[0..9] OF INT;
END_VAR

(* Temporary variables *)
VAR_TEMP
    tempCounter : INT;
    tempBuffer : STRING[80];
END_VAR

(* Constant variables *)
VAR CONSTANT
    PI : REAL := 3.14159;
    MAX_SIZE : INT := 1000;
END_VAR

(* Retain variables *)
VAR RETAIN
    persistentCounter : UDINT;
END_VAR

(* Non-retain variables *)
VAR NON_RETAIN
    volatileData : REAL;
END_VAR

(* Persistent variables *)
VAR PERSISTENT
    savedState : INT;
END_VAR

(* All elementary types *)
VAR
    boolVal : BOOL;
    sintVal : SINT;
    intVal : INT;
    dintVal : DINT;
    lintVal : LINT;
    usintVal : USINT;
    uintVal : UINT;
    udintVal : UDINT;
    ulintVal : ULINT;
    realVal : REAL;
    lrealVal : LREAL;
    byteVal : BYTE;
    wordVal : WORD;
    dwordVal : DWORD;
    lwordVal : LWORD;
    stringVal : STRING;
    stringFixed : STRING[100];
    wstringVal : WSTRING;
    timeVal : TIME;
    ltimeVal : LTIME;
    dateVal : DATE;
    todVal : TIME_OF_DAY;
    dtVal : DATE_AND_TIME;
END_VAR

END_PROGRAM

(* Global variables - must be in CONFIGURATION per IEC 61131-3 *)
CONFIGURATION GlobalConfig
VAR_GLOBAL
    GlobalCounter : UDINT;
    GlobalStatus : BOOL;
END_VAR

VAR_GLOBAL CONSTANT
    APP_VERSION : STRING := '1.0.0';
END_VAR
END_CONFIGURATION

(* External variables *)
PROGRAM TestExternal
VAR_EXTERNAL
    ExternalRef : REAL;
END_VAR
END_PROGRAM

(* Static variables in function block *)
FUNCTION_BLOCK FB_WithStatic
VAR_STAT
    callCount : UDINT;
END_VAR

callCount := callCount + 1;
END_FUNCTION_BLOCK

(* Type declarations *)
TYPE MyInt : INT; END_TYPE

TYPE MyRange : INT (0..100); END_TYPE

TYPE MyArray : ARRAY[0..9] OF INT; END_TYPE

TYPE MyArray2D : ARRAY[0..9, 0..9] OF REAL; END_TYPE

TYPE MyPointer : POINTER TO INT; END_TYPE

TYPE MyRef : REF_TO REAL; END_TYPE

TYPE MyString : STRING[255]; END_TYPE

TYPE MyStruct :
STRUCT
    field1 : INT;
    field2 : REAL;
    field3 : STRING[50];
END_STRUCT
END_TYPE

TYPE MyUnion :
UNION
    asInt : DINT;
    asReal : REAL;
    asBytes : ARRAY[0..3] OF BYTE;
END_UNION
END_TYPE

TYPE Color :
(
    Red := 0,
    Green := 1,
    Blue := 2
);
END_TYPE

(* Function with parameters *)
FUNCTION Add : INT
VAR_INPUT
    a : INT;
    b : INT;
END_VAR

Add := a + b;
END_FUNCTION

(* Function block with inheritance *)
FUNCTION_BLOCK FB_Child EXTENDS FB_Parent IMPLEMENTS I_Interface
VAR
    childVar : INT;
END_VAR
END_FUNCTION_BLOCK

(* Interface declaration *)
INTERFACE I_Counter
    METHOD Increment : INT
    END_METHOD

    METHOD Reset
    END_METHOD

    PROPERTY Count : INT
    END_PROPERTY
END_INTERFACE

(* Method with access modifiers *)
FUNCTION_BLOCK FB_AccessTest
VAR PUBLIC
    publicVar : INT;
END_VAR

VAR PRIVATE
    privateVar : INT;
END_VAR

PROTECTED METHOD ProtectedMethod
END_METHOD

PUBLIC METHOD PublicMethod
END_METHOD

PRIVATE METHOD PrivateMethod
END_METHOD
END_FUNCTION_BLOCK

(* Property with getter and setter *)
FUNCTION_BLOCK FB_PropertyTest
VAR
    _value : INT;
END_VAR

PROPERTY Value : INT
    GET
        Value := _value;
    END_GET
    SET
        _value := Value;
    END_SET
END_PROPERTY
END_FUNCTION_BLOCK

(* Namespace *)
NAMESPACE MyApp
    FUNCTION_BLOCK FB_Nested
    END_FUNCTION_BLOCK
END_NAMESPACE
