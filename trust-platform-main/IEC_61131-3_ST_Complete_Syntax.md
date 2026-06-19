# IEC 61131-3 — Structured Text: Complete Syntax Reference

> Исходный материал: `IEC_61131-3_Syntax_Reference.md` (CODESYS Development System, стр. 1–183). Документ покрывает **только** подмножество ST; IL, SFC, FBD, LD, CFC упомянуты только там, где требуется для контекста. Каждый оператор/инструкция снабжены (a) синтаксисом BNF-like, (b) снипетом `st`, (c) одной строкой семантики. Источник дополнен из IEC 61131-3:2013, где в исходнике нет примера (отмечено: *IEC 61131-3:2013 — добавлено из стандарта*).

---

## 1. Lexical elements

### 1.1 Character set

```st
letter       := 'A'..'Z' | 'a'..'z' | '_'
digit        := '0'..'9'
hex_digit    := digit | 'A'..'F' | 'a'..'f'
oct_digit    := '0'..'7'
bin_digit    := '0' | '1'

special      := ' ' | '\t' | '\r' | '\n'         // whitespace
nl_comment   := '//' .. end-of-line
block_open   := '(*'
block_close  := '*)'
string_delim := "'"
wstring_delim:= '"'
pragma_open  := '{'
pragma_close := '}'
assign_op    := ':='
output_op    := '=>'
ref_assign   := 'REF='
set_assign   := 'S='
reset_assign := 'R='
```

```csv
Category,Characters (in source order)
Letters,A..Z  a..z
Digits,0..9
Special,`+  -  *  /  =  <  >  (  )  [  ]  {  }  :  ;  ,  .  _  ^  @  %  $  ?  !  '  "  #  &`
Whitespace,`SP` (0x20)  `HT`  `LF`  `VT`  `FF`  `CR`
National,(IEC 61131-3:2013 — добавлено из стандарта) 8-bit national characters in `STRING` literals per ISO/IEC 8859-1
```

Rules:
- Source is encoded as ASCII subset; extended 8-bit chars allowed in `STRING` literals (`'$XX'` hex form for any byte).
- CODESYS uses ISO/IEC 8859-1 for `STRING`; WSTRING uses UTF-16.
- Tokens separated by whitespace or special characters; whitespace itself is insignificant except inside literals/comments.

### 1.2 Identifiers

```st
identifier        := letter { letter | digit }                  (* IEC 61131-3:2013 *)
qualified_id      := identifier { '.' identifier }              (* dot-separated path *)
lib_qualified_id  := identifier { '.' identifier }               (* library/namespace prefix *)
```

Rules:
- **No spaces**, no special characters except underscore.
- **Case-insensitive** — `VAR1` ≡ `var1`.
- Underscore `_` recognized; **multiple underscores in a row** (`__`) are reserved for the compiler/implicit names (CODESYS rejects them in user code).
- **Length** — not limited.
- **Cannot equal a keyword**.
- **Cannot duplicate** within the same scope.
- Globally the identifier may appear multiple times (in different GVLs); a local declaration shadows the global one in its POU.

**Library / namespace qualified names** (CODESYS V3):

```st
.ivar                          // dot-leader: opens global namespace path
globlist1.ivar                 // access variable 'ivar' from GVL 'globlist1'
Lib0.Lib1.fun                  // nested libraries: list in order
LIB_A.FB_A                     // library.FB for unique disambiguation
COLOR.RED                      // enum constant access
fbInst.METH1                   // FB method access
```

**Hungarian prefixes** (CODESYS recommended convention):

```csv
Type,Prefix,Comment
BOOL,x (recommended) / b (reserved),`x` to distinguish from BYTE
BYTE,by,bit-string
WORD,w,bit-string
DWORD,dw,bit-string
LWORD,lw,bit-string
SINT,si,
USINT,usi,
INT,i,
UINT,ui,
DINT,di,
UDINT,udi,
LINT,li,
ULINT,uli,
REAL,r,
LREAL,lr,
STRING,s,
WSTRING,ws,
TIME,tim,
LTIME,ltim,
TIME_OF_DAY,tod,
DATE_AND_TIME,dt,
DATE,date,
POINTER,p,
ARRAY,a,
Enum,e,
```

**Naming scheme per object** (CODESYS V3):

```csv
Object,Scheme
Nested declaration,prefixes in declaration order: `pabyTelegramData : POINTER TO ARRAY [0..7] OF BYTE`
FB instance,prefix = FB abbrev.: `cansdoReceivedTelegram : CAN_SDOTelegram`
Local constant,`C_<type-prefix><name>`: `c_uiSyncID : UINT := 16#80;`
Global variable,`<lib-prefix>g_<name>`: `CAN_g_iTest : INT;`
Global constant,`<lib-prefix>gc_<name>`: `CAN_gc_dwExample : DWORD;`
DUT struct,`<lib-prefix>_<description>`: `TYPE CAN_SDOTelegram : STRUCT ... END_STRUCT END_TYPE`
DUT enum,`<lib-prefix>_<IDENTIFIER>`: `TYPE CAL_Day : (CAL_MONDAY, ..., CAL_SUNDAY);`
POU (FB/function/program),`<lib-prefix>_<description>`: `FUNCTION_BLOCK CAN_SendTelegram`
Actions (called by FB),`prv_<name>` (or no prefix)
Methods (called by FB),`prv_<name>` (or no prefix)
Interface,`I<Name>`: `ICANDevice`
```

In CODESYS V3 libraries the library prefix is **omitted**; the namespace replaces it.

### 1.3 Reserved keywords

Keywords are written in uppercase; case-insensitive in source. They **cannot be used as identifiers**. CODESYS automatically checks valid usage.

**Identifiers with double underscore** `__` are reserved for implicit code and blocked in user code.

**CODESYS export-format keywords (cannot be used as identifiers):**
- `ACTION`, `END_ACTION`
- `END_FUNCTION`, `END_FUNCTION_BLOCK`, `END_PROGRAM`

**Other active keywords:**
- `VAR_ACCESS`, `READ_ONLY`, `READ_WRITE`, `PARAMS`

**Full keyword list (alphabetical):**

```csv
Keyword,Keyword,Keyword,Keyword
ABSTRACT,ABS,ACTION,ADD
AND,AND_THEN,ARRAY,AT
BIT,BOOL,BY,BYTE
CAL,CALCDATE,AND_TIME,CASE
CLASS,CONSTANT,CONTINUE,CONCAT
DATE,DATE_AND_TIME,DELETE,DINT
DO,DT,DWORD,ELSE
ELSIF,END_ACTION,END_CASE,END_CLASS,END_FOR,END_FUNCTION,END_FUNCTION_BLOCK,END_IF,END_IMPLEMENTS,END_INTERFACE,END_METHOD,END_NAMESPACE,END_PROPERTY,END_STRUCT,END_TRANSITION,END_TYPE,END_UNION,END_VAR,END_WHILE,EN,ENO,EQ,EXIT
EXP,EXPT,EXTENDS,FALSE
FINAL,FIND,FUNCTION,FUNCTION_BLOCK,FOR,GE
GET,GT,IF,IMPLEMENTS
INDEXOF,INITIAL_VALUE,INT,INTEGER,INTERFACE,INTERNAL
IS_VALID,LIMIT,LE,LINT
LN,LOG,LONG,LOOP,LREAL,LT
LTIME,LWORD,MAX,METHOD,MID,MIN,MOD
MUL,MUX,NAMESPACE,NE,NEW,NOT
NULL,OF,OR,OR_ELSE
ORD,OVERRIDE,POINTER,PRG
PRIVATE,PROGRAM,PROPERTY,PROTECTED
PUBLIC,READ_WRITE,READ_ONLY,REAL,REF
REFERENCE,REPLACE,REPEAT,RETAIN,RETURN
RIGHT,ROL,ROR,S=,S0,SD,SL,DS,D
S,SELECT,SEL,SET,SHL,SHR,SINT
STRING,STRUCT,SUPER,THEN,THIS
TIME,TIME_OF_DAY,TIMES,TO,TOD
TO_,TRUE,TRY,TS,UINT,ULINT
UNION,UNION,UNTIL,USINT,VALID,VALUE
VAR,VARACCESS,CONFIG,EXTERNAL,GLOBAL,IN_OUT,INPUT,INST,OUTPUT,TEMP,STAT
VOID,WCHAR,WHILE,WORD,WSTRING,XOR
```

**Operators that are also keywords (IEC 61131-3:2013 — добавлено из стандарта):**

```csv
Operator,Form,Semantics
:=,assignment,replace L-value with R-value
=>,output,assign function/FB/method output
S=,set,set L to TRUE iff R is TRUE
R=,reset,reset L to FALSE iff R is TRUE
REF=,ref assign,bind reference to address of operand
```

**Reserved/legacy keywords (deprecated):**
- `FUNCTIONBLOCK` — use `FUNCTION_BLOCK` (C0098)
- `INDEXOF` — use `ADR` (C0191)
- `INI` — use `FB_Init` (CoDeSys V2.3 compat)
- `PRG` — alias for `PROGRAM`

### 1.4 Comments

#### 1.4.1 Single-line `//`

```st
// This is a single-line comment
a := 5;  // inline comment
```

#### 1.4.2 Block `(* ... *)`

```st
(* This is a
   multi-line block comment *)
a := b + c;  (* inline block comment *)
```

#### 1.4.3 Nested block comments

IEC 61131-3 explicitly allows nesting of `(* ... *)` comments.

```st
(* outer
   (* inner 1 *)
   code := 1;
   (* inner 2 *)
 *)
```

#### 1.4.4 Comments inside strings

Comments inside `'…'` and `"…"` are **NOT** treated as comments; they are part of the literal.

```st
s := 'this // is not a comment';
s2 := "this (* is also *) not a comment";
```

**Embedded escape `$`** is interpreted in `STRING` literals per ISO/IEC 8859-1 (see §1.5.6).

### 1.5 Literals and constants

#### 1.5.1 Boolean literals

```st
b := TRUE;
b := FALSE;     // 0 and 1 are also accepted
b := 1;         // implicit BOOL
```

#### 1.5.2 Integer literals (binary, octal, decimal, hex)

```st
14                  // decimal
2#1001_0011         // binary  (underscore allowed as visual separator)
8#67                // octal
16#A                // hex
DINT#16#A1          // typed: DINT and base 16#
```

- Bases 2/8/16 require a `<base>#` prefix.
- Hex digits A..F case-insensitive.
- Underscore `_` is allowed inside the digit run (e.g. `2#1001_0011`).
- Without a typed prefix, the compiler picks the **smallest** integer type that fits.

```csv
Suffix/Base,Semantics
(no prefix),decimal; type = smallest ANY_INT that fits
2#,binary
8#,octal
16#,hex
DINT#,USINT#,etc.,force specific base type
```

#### 1.5.3 Real literals

```st
7.4                // decimal (comma `7,4` is compile error)
1/3.0              // = 0.333333343
1.64e+009          // mantissa + signed exponent
-3.402823e+38      // min REAL
1.0E-44            // smallest positive REAL
1.7976931348623157E+308   // max LREAL
```

- Mantissa `e|E` exponent (REAL: −44..+38; LREAL: −324..+308).
- Decimal point **must** be a dot.
- `LREAL#` typed literal forces 64-bit float.

```csv
Range,Type
−3.402823e+38 .. −1.0E-44,REAL (negative)
0,REAL
+1.0E-44 .. +3.402823e+38,REAL (positive)
−1.7976931348623157E+308 .. −4.94065645841247E-324,LREAL
+4.94065645841247E-324 .. +1.7976931348623157E+308,LREAL
```

> **1/10 = 0**; **1.0/10 = 0.1** — integer division truncates; use real literal to keep fraction.

#### 1.5.4 Time literals (TIME, LTIME)

```st
<keyword>#<duration>
keyword     := TIME | time | T | t
duration    := ( <n>d )? ( <n>h )? ( <n>m )? ( <n>s )? ( <n>ms )?
```

Units **cannot be reordered**; uppercase letters allowed; lower unit **may overflow** (e.g. `T#100s12ms`).

```csv
Unit,Meaning
d / D,days
h / H,hours
m / M,minutes
s / S,seconds
ms / MS,milliseconds
```

```st
VAR
    timLength  : TIME := T#14ms;
    timLength1 : TIME := T#100s12ms;          // overflow on highest unit allowed
    timLength2 : TIME := T#12h34m15s;
    timLongest : TIME := T#49D17H2M47S295MS;  // = 4294967295
END_VAR
```

**LTIME** adds `us` and `ns`:

```st
<keyword>#<duration>
keyword     := LTIME | ltime
duration    := <TIME-duration> ( <n>us )? ( <n>ns )?

ltim : LTIME := LTIME#1000d15h23m12s34ms2us44ns;
```

Internal: `TIME` = DWORD (32-bit ms); `LTIME` = LWORD (64-bit ns).

```csv
Type,Internal,Range
TIME,DWORD 32-bit,T#0d0h0m0s0ms .. T#49d17h2m47s295ms
LTIME,LWORD 64-bit,0 .. 213503d23h34m33s709ms551us615ns
```

#### 1.5.5 Date / TOD / DT literals

```st
// DATE
<keyword>#<year>-<month>-<day>
keyword : DATE | date | D | d
year    : 1970..2106
month   : 1..12
day     : 1..31

dStart : DATE := D#2018-8-8;
```

```st
// DATE_AND_TIME (DT)
<keyword>#<year>-<month>-<day>-<hour>:<minute>:<second>
keyword : DATE_AND_TIME | date_and_time | DT | dt
year    : 1970..2106, month 1..12, day 1..31
hour    : 0..24, minute 0..59, second 0..59

dtDate  : DATE_AND_TIME := DT#2018-08-08-13:33:20.5;   // .5 = ½ second
```

```st
// TIME_OF_DAY (TOD)
<keyword>#<hour>:<minute>:<second>.<ms>
keyword : TIME_OF_DAY | time_of_day | TOD | tod
hour    : 0..23, minute 0..59, second 0.000..59.999

todClock : TIME_OF_DAY := TOD#15:36:30.123;
```

```csv
Type,Internal,Resolution
DATE,DWORD,days (seconds since 1970-01-01)
DATE_AND_TIME / DT,DWORD,seconds
TIME_OF_DAY / TOD,DWORD,milliseconds
```

#### 1.5.6 String literals (single-quoted)

```st
str := 'Hello world!';
str := '';                              // empty string
str := 'Hello $21';                     // $21 = '!'  → "Hello !"
```

`$` escape sequences (ISO/IEC 8859-1 hex):

```csv
Escape,Interpretation
`$XX`,2-digit hex (ISO/IEC 8859-1)
`$$`,literal `$`
`$'`,literal `'` (single quote)
`$0D` or `$R`,CR (carriage return)
`$0A` or `$N` or `$L`,LF (line feed)
`$P`,form feed
`$T`,tab
```

Encoding: `STRING` is ISO/IEC 8859-1 (1 byte per char + 1 trailing length byte).

```st
VAR CONSTANT
    constA : STRING := 'Hello world';
    constB : STRING := 'Hello world $21';
END_VAR
```

#### 1.5.7 WSTRING literals (double-quoted)

```st
wstr : WSTRING := "This is a WString";
```

- Unicode (UTF-16 in CODESYS). 1 WORD per char + 1 trailing WORD.
- Same `$XX` escape semantics as STRING.
- `WSTRING[10]` = max 10 WORDS (not 10 chars).

#### 1.5.8 Typed literals

```st
<type>#<literal>
type : BOOL | SINT | USINT | BYTE | INT | UINT | WORD
     | DINT | UDINT | DWORD | REAL | LREAL | TIME | LTIME
     | DATE | TIME_OF_DAY | DATE_AND_TIME | STRING | WSTRING
```

Type name must be uppercase. If the literal cannot be converted to the target type without loss, compile error.

```st
var1 := DINT#34;       // force DINT
si   := SINT#16#FF;    // = -1
r    := REAL#3.14;
```

#### 1.5.9 Bit access on bit-strings (`.Xn`)

```st
VAR
    wA   : WORD := 16#FF;
    xB   : BOOL;
END_VAR
wA.2 := xB;                    // bit 2 of wA = xB → wA = 16#FFFB
iX.c_usiENABLE := TRUE;        // bit indexed by global USINT constant
```

Rules:
- Index 0..n−1 (n = bit-width of base type).
- Index may be a literal or a symbolic integer constant (not a variable; C0050).

#### 1.5.10 Enumerated literals

```st
TYPE COLOR :
    ( RED, GREEN := 5, BLUE := 10 );
END_TYPE

c : COLOR := RED;          // unqualified
c : COLOR := COLOR.GREEN;  // qualified
```

With `{attribute 'strict'}`: only enum component values allowed, no arithmetic.

### 1.6 Pragmas

All pragmas are `{ ... }` blocks. They affect either the message window (compile-time diagnostics) or code generation (precompile / conditional).

#### 1.6.1 Message pragmas

```st
{text    'free text'}        // plain text
{info    'informational'}
{warning 'warn message'}     // local to current position
{error   'fatal message'}
```

```st
VAR
    var  : INT; {info 'TODO: rename me'}
    bvar : BOOL;
END_VAR
{warning 'deprecated call'}
{text 'module xy compiled'}
```

#### 1.6.2 Attribute pragmas

```st
{attribute '<name>' := '<value>'}
```

Apply on declaration lines (or first line of POU/method body). For Action/Transition objects: attribute is the **first** line of the implementation.

**Catalogue of attributes:**

```csv
Attribute,Purpose / position
`call_after_global_init_slot`,Functions/programs with this attribute are called after global init. Slot sets the rank. *VAR_INPUT in such functions/methods → compile error.*
`call_after_init`,Method called implicitly after `FB_Init`. Applied to FB and method, first line.
`call_after_online_change_slot`,Call after online change; slot sets the order.
`call_before_global_exit_slot`,Call before GlobalExit (before new load / reset).
`call_on_type_change`,Method of FB A is called when data type changes for FB B, C, ... (via POINTER/REFERENCE).
`const_replaced` / `const_non_replaced`,Enable/disable constant substitution for global constants.
`dataflow`,Controls FB dataflow in FBD/LD/IL: sets one input and one output.
`displaymode`,`'bin'` / `'binary'` / `'dec'` / `'decimal'` / `'hex'` / `'hexadecimal'`.
`estimated-stack-usage`,Suppress recursive-method warning: `'127'` (bytes).
`ExpandFully`,Array components are expanded in visualization properties.
`global_init_slot`,Init slot for GVL/POU (default 50000 POU, 49990 GVL).
`hide`,Hide variable/POU in UI.
`hide_all_locals`,Hide all local variables of a signature.
`initialize_on_call`,Reinitialize FB input variables on every call.
`init_namespace`,STRING/WSTRING variable is initialized with current library namespace.
`init_on_onlchange`,Initialize variable on online change. (Compiler ≥ 3.5.0.0 with fast online-change → use `no_fast_online_change`.)
`instance-path`,STRING variable is initialized with the POU's instance path. Requires `reflection` on POU and `noinit` on variable.
`io_function_block` / `io_function_block_mapping`,Mark FB for I/O mapping in device configuration.
`linkalways`,Object is always compiled and downloaded.
`monitoring`,`'variable'` or `'call'`. Online monitoring of properties.
`no_assign` / `no_assign_warning`,Forbid/warn assigning FB instances (C0328).
`no_check`,Disable check functions for POU (and children).
`no_copy`,Do not copy variable value on online change — reinitialize.
`no-exit`,Block `FB_exit` call for FB instance.
`noinit` / `no_init` / `no-init`,Variable is not implicitly initialized.
`no_instance_in_retain`,Forbid saving FB instance in retain area.
`no_virtual_actions`,Protect actions of base SFC-FB from being overwritten in derived class.
`pingroup`,Group FB inputs/outputs in FBD/LD.
`pin_presentation_order_inputs` / `pin_presentation_order_outputs`,Pin order. `*` = substitute unlisted.
`obsolete`,Warning when type is used. `{attribute 'obsolete' := 'text'}`.
`pack_mode`,`0` (aligned, no gaps), `1` (1-byte), `2` (2-byte), `4` (4-byte), `8` (8-byte).
`qualified_only`,Access only via `<GVL>.<var>`.
`reflection`,Mark FB for `instance-path` lookup.
`to_string`,`TO_STRING` of enum component returns the name.
`subsequent`,Place variables contiguously. VAR_TEMP with this → compile error.
`symbol`,Export variable to symbol configuration. Rights: `none` / `read` / `write` / `readwrite`.
`warning disable` / `warning restore`,Block/restore warning by compiler ID.
`enable_dynamic_creation`,Allow `__NEW` for FB. First line of FB declaration.
`ProcessValue`,Mark struct component for scalar CFC input connection.
```

**Examples:**

```st
{attribute 'qualified_only'}
VAR_GLOBAL
    g_iCounter : INT;
END_VAR

{attribute 'pack_mode' := '2'}
TYPE CTRL : STRUCT
    a : INT;
    b : BOOL;
END_STRUCT
END_TYPE

{attribute 'symbol' := 'readwrite'}
PROGRAM PLC_PRG
VAR
    {attribute 'symbol' := 'read'}  D : INT;
END_VAR

{attribute 'instance-path'}
{attribute 'noinit'}
str : STRING;

{attribute 'init_namespace'}
myStr : STRING;

{attribute 'io_function_block_mapping'}
iOutput : INT;

{attribute 'estimated-stack-usage' := '99'}
METHOD PUBLIC m_Pragmaed : UDINT
```

**`monitoring` modes (property attribute):**
- `'variable'` — implicit variable holds last Set/Get result; monitoring shows that snapshot.
- `'call'` — monitoring triggers an actual Get/Set call. Use for simple types / pointers only; beware side effects. In symbol config the `'variable'` mode is read-only.

**`pack_mode` alignment table:**

```csv
Value,1-byte,2-byte,4-byte,8-byte,Strings
0 (aligned),byte,no gaps,no gaps,no gaps,"byte addr, no gaps"
1,byte,max step 1,max step 1,max step 1,"byte addr, no gaps"
2,byte,addr/2 step ≤1,addr/2 step ≤1,addr/2 step ≤1,"byte addr, no gaps"
4,byte,even addr step ≤1,addr/4 step ≤3,addr/4 step ≤3,"byte addr, no gaps"
8,byte,addr/2 step ≤1,addr/4 step ≤3,addr/8 step ≤7,"byte addr, no gaps"
```

**`symbol` syntax:**

```st
{attribute 'symbol' := '<none|read|write|readwrite>'}
```

Default: `readwrite`. Place: first line of POU/GVL or directly above a variable.

**`warning disable/restore`:**

```st
{warning disable <CompilerID>}
{warning restore <CompilerID>}
```

#### 1.6.3 Conditional pragmas (preprocessor)

Operate on ExST (Extended ST) during precompile. Placed in the **implementation body** of a POU (not in the declaration).

```st
{define    <id> <string>}                  // declare identifier, queried via hasvalue
{undefine  <id>}                            // reverse {define}
{IF        <expr>}                         // conditional code
{ELSIF     <expr>}
{ELSE}
{END_IF}
```

Operators inside `{IF}`/`{ELSIF}`:

```csv
Operator,Meaning
`defined (<id>)`,is identifier defined?
`defined (variable: <var>)`,is variable present?
`defined (type: <id>)`,is type defined?
`defined (pou: <name>)`,is POU defined?
`defined (task: <id>)`,is task defined?
`defined (resource: <id>)`,is resource defined?
`defined (IsSimulationMode)`,is simulation mode?
`defined (IsLittleEndian)`,is little-endian target?
`defined (IsFPUSupported)`,FPU available?
`hasvalue (RegisterSize, '<size>')`,compiler const value
`hasvalue (PackMode, '<value>')`,pack mode setting
`hasattribute (pou: <name>, '<attr>')`,attribute on POU
`hasattribute (variable: <var>, '<attr>')`,attribute on var
`hastype (variable: <var>, <type>)`,type check
`hasvalue (<define-ident>, '<char-string>')`,defined-identifier value
`hasconstantvalue(<var>, <literal-expr>)`,variable constant value
`NOT <op>` / `<op> AND <op>` / `<op> OR <op>`,boolean composition
```

`define` values may be passed as compiler directives in the POU properties (without `{define}` keyword).

```st
{define MY_BUILD 'release'}
{IF defined (MY_BUILD) AND hasvalue (MY_BUILD, 'release')}
    x := 1;
{ELSIF defined (IsSimulationMode)}
    x := 2;
{ELSE}
    x := 0;
{END_IF}
```

#### 1.6.4 Region pragmas

```st
{region 'MyRegion'}
    ... code ...
{endregion}
```

Allows named folding regions. Nesting is permitted.

#### 1.6.5 `defined()` operator in pragmas

See §1.6.3 for the full list of `defined()` flavors. Quick example:

```st
{IF defined (variable: g_iCounter)}
    // emit code only if the variable exists
{END_IF}
```

### 1.7 Whitespace and statement separators

```st
statement      := <expression> ';'
statements     := statement { statement }
empty_stmt     := ';'
```

- **Whitespace** (SP, HT, LF, VT, FF, CR) is **insignificant** outside literals/comments.
- **Semicolon `;`** terminates every statement. Empty statement is a bare `;`.
- Line breaks are equivalent to a single space.
- Multi-line statements are allowed:
  ```st
  result := a +
            b * c;
  ```

---

## 2. Data types — ST-specific

Every identifier has a data type. The type determines memory footprint and interpretation of values.

### 2.1 Elementary types

```st
elementary_type := BOOL | SINT | USINT | BYTE | INT | UINT | WORD
                 | DINT | UDINT | DWORD | LINT | ULINT | LWORD
                 | REAL | LREAL
```

#### 2.1.1 BOOL

```csv
Type,Values,Memory
BOOL,"TRUE (1), FALSE (0)",8 bit
```

```st
b : BOOL := TRUE;
b := NOT b;       // toggle
```

#### 2.1.2 Integer and bit-string types

```csv
Type,Range,Memory
BYTE,0..255,8 bit (bit-string)
WORD,0..65535,16 bit (bit-string)
DWORD,0..4294967295,32 bit (bit-string)
LWORD,0..2^64−1,64 bit (bit-string)
SINT,−128..127,8 bit (signed)
USINT,0..255,8 bit (unsigned)
INT,−32768..32767,16 bit (signed)
UINT,0..65535,16 bit (unsigned)
DINT,−2147483648..2147483647,32 bit (signed)
UDINT,0..4294967295,32 bit (unsigned)
LINT,−2^63..2^63−1,64 bit (signed)
ULINT,0..2^64−1,64 bit (unsigned)
```

```st
si   : SINT  := -128;
ui   : UINT  := 65535;
lr   : LINT  := 9223372036854775807;
wVar : WORD  := 16#ABCD;
```

Notes:
- Implicit narrowing conversion (`DINT → INT`) is **forbidden**; use explicit `DINT_TO_INT(...)`.
- Bit-string types `BYTE/WORD/DWORD/LWORD` allow bit access `.Xn` (see §1.5.9).
- When assigning a wider to a narrower type, data may be lost.

#### 2.1.3 REAL / LREAL

IEEE 754 floating point.

```csv
Type,Smallest abs,Biggest abs,Memory
REAL,1.0E-44,3.402823E+38,32 bit
LREAL,4.94065645841247E-324,1.7976931348623157E+308,64 bit
```

```st
rMax    : REAL  := 3.402823E+38;
lrMax   : LREAL := 1.7976931348623157E+308;
r := r + 0.1;     // may not be exact
```

`LREAL` support depends on target. Conversion of out-of-range `REAL/LREAL` to integer yields target-dependent undefined result.

### 2.2 Bit data type `BIT`

```st
TYPE CTRL_BITS :
    STRUCT
        bOp   : BIT;
        bErr  : BIT;
        bWarn : BIT;
    END_STRUCT
END_TYPE
```

```csv
Aspect,Value
Values,TRUE (1), FALSE (0)
Memory,1 bit (packed into bytes)
Usage,only inside STRUCT or FB (C0203)
Forbidden,`POINTER TO BIT` (C0064), `ARRAY OF BIT` (C0206)
Cannot,be passed directly to `VAR_IN_OUT` (C0201)
```

```st
b : BIT;            // bad: outside STRUCT/FB (C0203)
```

### 2.3 Time types

```csv
Type,Lower,Upper,Memory,Resolution
TIME,T#0d0h0m0s0ms,T#49d17h2m47s295ms,32 bit (DWORD),ms
TIME_OF_DAY / TOD,00:00:00.000,23:59:59.999,32 bit (DWORD),ms
DATE,D#1970-1-1,D#2106-2-7,32 bit (DWORD),day
DATE_AND_TIME / DT,DT#1970-1-1-00:00:00,DT#2106-2-7-6:28:15,32 bit (DWORD),seconds
LTIME,0,213503d23h34m33s709ms551us615ns,64 bit (LWORD),ns
```

```st
t   : TIME := T#12ms;
dt  : DATE_AND_TIME := DT#2024-01-15-12:30:00;
tod : TIME_OF_DAY := TOD#15:36:30.123;
lt  : LTIME := LTIME#1d2h3m4s5ms6us7ns;
```

**`TIME()` function** (runtime): returns ms since PLC start, type `TIME`.

```st
systime := TIME();
```

### 2.4 String types

```st
STRING  := 'STRING' [ '(' <n> ')' ]    // n = 1..255 default 80
WSTRING := 'WSTRING' [ '(' <n> ')' ]  // n = 1..65535, default 80
```

- `STRING` = ISO/IEC 8859-1; 1 byte/char + 1 trailing length byte. Total size = `n+1`.
- `WSTRING` = Unicode (UTF-16 in CODESYS); 1 WORD/char + 1 trailing length WORD.
- `STRING(4) := '12345'` is a compile error (C0198) — string is truncated to declared length.

```st
str  : STRING(35)  := 'This is a String';
wstr : WSTRING     := "Unicode";
```

### 2.5 Generic / platform-dependent types

```csv
Pseudo-type,32-bit target,64-bit target
__UXINT,UDINT,ULINT
__XWORD,DWORD,LWORD
```

`__UXINT` / `__XWORD` are platform-independent; pick the right width for atomic ops and pointers.

### 2.6 `ANY` / `ANY_DERIVED` / `ANY_ELEMENTARY` / `ANY_<type>`

Generic type hierarchy (compiler ≥ 3.5.1.0):

```csv
Generic type,Elementary types covered
ANY_BIT,"BYTE, WORD, DWORD, LWORD"
ANY_DATE,"DATE_AND_TIME, DT, DATE, TIME_OF_DAY, TOD"
ANY_NUM,"ANY_REAL, ANY_INT"
ANY_REAL,"REAL, LREAL"
ANY_INT,"USINT, UINT, UDINT, ULINT, SINT, INT, DINT, LINT"
ANY_STRING,"STRING, WSTRING"
ANY_ELEMENTARY,union of all elementary types above
ANY_DERIVED,"user-defined types (DUT), FB types, ARRAY, POINTER, REFERENCE, etc."
ANY,ANY_ELEMENTARY ∪ ANY_DERIVED
```

```st
FUNCTION AnyBitFunc : BOOL
VAR_INPUT
    value : ANY_BIT;
END_VAR
```

Generic inputs enable polymorphic functions.

### 2.7 Derived types (DUT)

Declared in `TYPE ... END_TYPE` blocks (see §2.9). Includes:

```st
// Array
TYPE IntArray10 : ARRAY[0..9] OF INT; END_TYPE

// Struct
TYPE Point : STRUCT x : REAL; y : REAL; END_STRUCT END_TYPE

// Sub-range
TYPE Percent : INT (0..100); END_TYPE

// Enum
TYPE Day : ( MON, TUE, WED, THU, FRI, SAT, SUN ); END_TYPE
```

#### 2.7.1 ARRAY

```st
TYPE ARR :
    ARRAY [ <lo> .. <hi> ] OF <elem> ( := <init> )? ;
END_TYPE
```

```st
TYPE M2D : ARRAY[1..2, 3..4] OF INT := [2(10), 2(20)]; END_TYPE   // = [10,10,20,20]
```

**Multi-dimensional array** (comma-separated ranges):

```st
m[i, j, k]       // 3-D access
```

**Array of arrays** (alternative):

```st
ai2 : ARRAY[1..2] OF ARRAY[1..3] OF INT := [[1,2,3], [4,5,6]];
ai2[1][2] := 1200;
```

**Variable-length array** (only in `VAR_IN_OUT`):

```st
FUNCTION_BLOCK POU
VAR_IN_OUT
    arrin : ARRAY [*] OF INT;
END_VAR
```

```st
LOWER_BOUND(arrin, <dim>)
UPPER_BOUND(arrin, <dim>)
```

`UPPER_BOUND(arr, 0)` for a fixed array is a compile error (C0380).

**Array initialization**:
```st
ai : ARRAY[0..9] OF INT := [0,10,20,30,40,50,60,70,80,90];
ai2 : ARRAY[0..3] OF INT := [2(0)];       // = [0,0,0,0]
```

**Errors (see §11)**: C0047 (index non-array), C0048 (wrong dim count), C0049 (out of range), C0074/C0075 (init shape mismatch), C0161 (non-const bounds), C0162 (non-const repeat), C0380 (`UPPER_BOUND` on fixed array).

#### 2.7.2 STRUCT

```st
TYPE <name> :
    STRUCT
        <decl_1>
        ...
        <decl_n>
    END_STRUCT
END_TYPE
```

- Nesting allowed.
- `AT` declarations inside STRUCT are **forbidden** (CODESYS).
- Struct initializer:
  ```st
  pPoly_1 : polygonline := ( start := [3,3], point1 := [5,2],
                             point2 := [7,3], point3 := [8,5],
                             point4 := [5,7], end := [3,5] );
  ```
- `BIT` components are valid in STRUCT and accessed by name (see §2.2).

#### 2.7.3 ENUM

```st
( {attribute 'strict'} )?   // recommended
TYPE <name> :
    ( <comp_1> ( := <init> )?,
      ( <comp> , )+
      <last_comp>
    ) ( <base_type> )? ( := <default_init> )? ;
END_TYPE
```

- Base types: `INT | UINT | SINT | USINT | DINT | UDINT | LINT | ULINT | BYTE | WORD | DWORD | LWORD` (default `INT`).
- ≥ 2 components required.
- `{attribute 'strict'}` (auto-added since V3.5 SP7): forbids arithmetic on enum values and assignment of non-enum constants.
- `{attribute 'qualified_only'}`: forces `<EnumName>.<comp>`.
- `{attribute 'to_string'}`: `TO_STRING(e)` returns the component name.

```st
{attribute 'strict'}
{attribute 'qualified_only'}
TYPE COLOR : ( YELLOW, GREEN, BLUE, BLACK ); END_TYPE

{attribute 'to_string'}
TYPE Color2 : ( RED := 0, BLUE := 1, GREEN := 2 ); END_TYPE
```

Default-init rule: explicit value → that one. If neither type nor variable specifies: 0-valued component if present, else first component.

Errors: C0124 (init not ANY_INT), C0125 (two zero-valued components).

#### 2.7.4 Sub-range types

```st
TYPE <name> : <int_type> ( <lo> .. <hi> ) ; END_TYPE
```

Base types: `SINT USINT INT UINT DINT UDINT BYTE WORD DWORD LINT ULINT LWORD`.
Bounds: constants of base type. Inclusive.

```st
iPerc  : INT  (-4095..4095);
uiDays : UINT (0..10000);
```

Out-of-range assignment is compile error. Runtime: `CheckRangeSigned` / `CheckRangeUnsigned` may emit a check.

#### 2.7.5 UNION

```st
TYPE <name> :
    UNION
        <field_a> : <type_a>;
        <field_b> : <type_b>;
    END_UNION
END_TYPE
```

All members share the same offset and memory size; assigning to one alters all.

```st
TYPE U64 :
    UNION
        lr : LREAL;
        li : LINT;
    END_UNION
END_TYPE
u.lr := 1.0;       // same memory as u.li
```

### 2.8 Reference types: POINTER, REFERENCE TO, REF

#### 2.8.1 POINTER TO

```st
<id> : POINTER TO <type | FB | PROGRAM | METHOD | FUNCTION>;
```

Operators: `^` (dereference), `ADR` (take address).

```st
VAR
    pt       : POINTER TO INT;
    var_int1 : INT := 5;
    var_int2 : INT;
END_VAR
pt := ADR(var_int1);
var_int2 := pt^;            // = 5
```

Pointer arithmetic:
- `pint[i]` = `(pint + i * SIZEOF(base))^` — implicit deref + offset.
- `str[i]` = i-th char of STRING as SINT.
- `wstr[i]` = i-th char of WSTRING as INT.
- `p1 - p2` = DWORD (always 32-bit, even on 64-bit target).
- `ADR` works on functions, programs, FB, methods — returns address of function pointer (not callable from CODESYS).

Errors: C0022 (too many operands), C0064 (POINTER TO BIT), C0131 (dereference non-pointer), C0140/C0141 (validation), C0205 (ADR of constant), C0222 (POINTER requires exactly 1 index).

#### 2.8.2 REFERENCE TO

```st
<id> : REFERENCE TO <type>;
```

- Reference, no explicit `^` needed.
- Assign with `REF=` (= `A := ADR(B)`).
- Read/write with `A := x` (compiles to `A^ := x`).
- Compiler enforces identical base type on assignment.
- CODESYS ≥ V3.3.0.0 initializes references to 0.
- **Cannot** declare: `REFERENCE TO REFERENCE`, `ARRAY OF REFERENCE`, `POINTER TO REFERENCE`. No reference to bit variables. **Not allowed** in `VAR_OUTPUT`.

```st
A : REFERENCE TO DUT;
B : DUT;
C : DUT;
A REF= B;        // A := ADR(B)
A := C;          // A^ := C
```

**Validity check:**
```st
ok := __ISVALIDREF(A);   // TRUE if A <> 0
```

Error: C0126 (must be REFERENCE TO …).

#### 2.8.3 `REF` shorthand (CODESYS V3.4+, *IEC 61131-3:2013 — добавлено из стандарта*)

`REF` is an alias for `REFERENCE TO` in declaration position.

```st
A : REF TO DUT;     // = A : REFERENCE TO DUT;
```

### 2.9 User-defined types (DUT) — `TYPE ... END_TYPE`

```st
TYPE <name> : <definition> ; END_TYPE
```

`<definition>` can be:
- Elementary alias: `TYPE MyByte : BYTE; END_TYPE`
- Array / sub-range / struct / enum / union (see §2.7).
- FB alias: `TYPE MyFB : FB_Some; END_TYPE`
- POINTER / REFERENCE alias.
- Function-pointer-like types.

```st
TYPE BOOL_ARR_8  : ARRAY[0..7] OF BOOL; END_TYPE
TYPE DUT_CTRL    : STRUCT enabled : BOOL; speed : REAL; END_STRUCT END_TYPE
TYPE E_STATE     : ( OFF := 0, INIT, RUN, FAULT ); END_TYPE
TYPE PVOID       : POINTER TO BYTE; END_TYPE
TYPE REF_CTRL    : REFERENCE TO DUT_CTRL; END_TYPE
```

DUT visibility:
- DUT declared in a POU body is local.
- DUT declared in GVL is global.
- DUT in a library has the library namespace as prefix.

---

## 3. Variables and declaration sections

The declaration section of a POU contains one or more **variable sections** introduced by a section keyword and closed by `END_VAR`. Each section has its own visibility, lifetime, and storage class.

### 3.1 VAR / VAR_INPUT / VAR_OUTPUT / VAR_IN_OUT

```st
<POU> <Name> ...
VAR
    <id> : <type> ( := <init> )? ;
END_VAR

VAR_INPUT
    <id> : <type> ( := <init> )? ;
END_VAR

VAR_OUTPUT
    <id> : <type> ( := <init> )? ;
END_VAR

VAR_IN_OUT
    <id> : <type>;                              (* no init for IN_OUT *)
END_VAR
```

```csv
Section,Visibility,Lifetime,Init
VAR,local to POU,per-call (re-init),allowed
VAR_INPUT,read-only caller → callee,per-call,allowed (default)
VAR_OUTPUT,callee → caller (return),per-call,allowed
VAR_IN_OUT,read/write caller → callee,per-call (pass-by-reference),forbidden (C0041 / C0417 require writable var)
```

**Notes on `VAR_IN_OUT`:**
- Pass-by-reference — no copy generated.
- Caller must pass a variable (literal/bit-variable prohibited).
- Strings: caller and formal should match in length, else data may be corrupted.
- `inst.<inout_var>` is **not** accessible from outside the POU (unlike `VAR_INPUT`/`VAR_OUTPUT`).
- Bit (`BIT`) variables cannot be passed directly to `VAR_IN_OUT` — wrap in `BOOL`.
- For functions, `VAR_IN_OUT` **must** be assigned on call (C0039).

**`VAR_IN_OUT CONSTANT`** (compiler ≥ 3.5.2.0):
```st
VAR_IN_OUT CONSTANT
    c_s : STRING;     (* read-only pass-by-reference *)
END_VAR
```
- Can be called with literal or constant.
- No length matching required for strings.
- Incompatible with `const_replaced` option for typed values.

```st
FUNCTION funManipulate : BOOL
VAR_IN_OUT
    sReadWrite : STRING(16);
END_VAR
VAR_IN_OUT CONSTANT
    c_sReadOnly : STRING(16);
END_VAR
sReadWrite := 'From POU';
```

### 3.2 VAR_GLOBAL / VAR_EXTERNAL / VAR_TEMP / VAR_STAT

```st
VAR_GLOBAL
    <id> : <type> ( := <init> )? ;
END_VAR

VAR_EXTERNAL
    <id> : <type>;           (* no init, must exist in VAR_GLOBAL *)
END_VAR

VAR_TEMP
    <id> : <type>;
END_VAR                    (* re-init on every call; not in FUNCTION *)

VAR_STAT
    <id> : <type> ( := <init> )? ;
END_VAR                    (* retains value across calls; like static in C *)
```

- **VAR_GLOBAL**: declared in a GVL (Global Variable List) object; visible project-wide; dot-leader `.name` disambiguates.
- **VAR_EXTERNAL**: import reference to a GVL variable of matching name and type. Optional in CODESYS (kept for IEC compliance).
- **VAR_TEMP**: per-call re-initialization; only inside PROGRAM and FB (C0169).
- **VAR_STAT**: persistent across calls; private to declaring POU (must be qualified by `<inst>.<var>` from outside).

```st
PROGRAM PLC_PRG
VAR_EXTERNAL
    g_iExt : INT;            (* must exist in GVL as g_iExt *)
END_VAR
VAR_GLOBAL
    g_iExt : INT := 0;
END_VAR
```

Errors: C0168 (VAR_CONFIG/VAR_GLOBAL wrong context), C0169 (VAR_TEMP in FUNCTION), C0236/C0237/C0238 (VAR_EXTERNAL mismatches).

### 3.3 VAR_INST (instance-specific initialization)

Available only in **methods**. The variable is stored in the **FB instance**, not on the method stack; therefore it **retains its value across method invocations** on the same instance. Not re-initialized on every call.

```st
METHOD meth_last : INT
VAR_INPUT
    iVar : INT;
END_VAR
VAR_INST
    iLast : INT := 0;
END_VAR
meth_last := iLast;
iLast    := iVar;
```

### 3.4 VAR_CONFIG / VAR_ACCESS

#### 3.4.1 VAR_CONFIG

Assigns concrete I/O addresses to FB-internal variables declared with placeholders (`AT %I*` / `AT %Q*`).

```st
FUNCTION_BLOCK locio
VAR
    xLocIn AT %I* : BOOL := TRUE;
END_VAR
```

```st
PROGRAM PLC_PRG
VAR
    locioVar1 : locio;
END_VAR
```

```st
VAR_CONFIG
    PLC_PRG.locioVar1.xLocIn AT %IX1.0 : BOOL;
END_VAR
```

#### 3.4.2 VAR_ACCESS / VAR_ACCESS CONSTANT

Declares **access paths** to variables for OPC / symbolic access. *IEC 61131-3:2013 — добавлено из стандарта.*

```st
VAR_ACCESS
    AccessibleVar : BOOL;          (* read/write default *)
    ReadOnlyVar   : BOOL READ_ONLY;
END_VAR
```

```st
VAR_GLOBAL
    gData : INT;
END_VAR
VAR_ACCESS
    gDataAccess : DINT READ_WRITE;     (* alias for OPC DA access *)
END_VAR
```

### 3.5 CONSTANT qualifier

```st
<area> CONSTANT
    <id> : <type> := <init> ;     (* init is mandatory, must be const *)
END_VAR
```

`<area>` ∈ {`VAR`, `VAR_INPUT`, `VAR_STAT`, `VAR_GLOBAL`}. Read-only; can appear on the right side of assignments only.

```st
VAR CONSTANT
    c_rTAXFACTOR : REAL := 1.19;
END_VAR
rPrice := rValue * c_rTAXFACTOR;     // OK
c_rTAXFACTOR := 1.2;                 // error
```

Errors: C0018 (init with variable), C0227 (init not constant), C0228 (no init).

### 3.6 RETAIN / PERSISTENT

#### 3.6.1 RETAIN

```st
<area> RETAIN
    <id> : <type> ( := <init> )? ;
END_VAR
```

`<area>` ∈ {`VAR`, `VAR_INPUT`, `VAR_OUTPUT`, `VAR_IN_OUT`, `VAR_STAT`, `VAR_GLOBAL`}.

```st
VAR RETAIN
    iVarRetain : INT;
END_VAR
```

Placement matrix:

```csv
Position,Effect
Local in PROGRAM,only this variable in retain area
In GVL,only the variable in retain area
Local in FB,entire FB instance (with all data) in retain
Local in FUNCTION,no effect (C0174)
```

#### 3.6.2 PERSISTENT

```st
VAR_GLOBAL PERSISTENT RETAIN
    <id> : <type> ( := <init> )? ;
    <instance-path to POU var>
END_VAR
```

Or inside POU:

```st
<area> PERSISTENT RETAIN
    <id> : <type> ( := <init> )? ;
END_VAR
```

- For PERSISTENT in FB, declare a **separate** persistent GVL with instance paths.
- Never use `POINTER TO` in persistent variables — addresses may shift on reload.

```csv
Position,Effect
Persistent GVL (declaration site),retained in protected memory
Local in POU + instance path in PERSISTENT GVL,double allocation (wasteful)
Local in POU only,warning: not persistent
Local in FUNCTION,no effect (C0175)
```

Note: `PERSISTENT RETAIN` ≡ `RETAIN PERSISTENT` ≡ `PERSISTENT` (CODESYS ≥ 3.3.0.1).

### 3.7 `AT %I/%Q/%M` direct-address specifier

```st
<id> AT %<area><size><pos> : <type> ( := <init> )? ;
area := I | Q | M
size := ( X | B | W | D )?      (* X = 1 bit, B = BYTE, W = WORD, D = DWORD *)
pos  := <n> ( . <n> )*           (* position in memory; target-dependent *)
```

```csv
Prefix,Meaning
I,Input memory area
Q,Output memory area
M,Flag memory area
```

```csv
Size,Type,Width
(none),BOOL,1 bit
X,BOOL,1 bit
B,BYTE,8 bit
W,WORD,16 bit
D,DWORD,32 bit
L,LWORD,64 bit (CODESYS extension)
```

```st
VAR
    bStart  AT %IX0.0 : BOOL;
    wInput  AT %IW2   : WORD;
    bOutBit AT %QX7.5 : BOOL;
END_VAR
```

For BOOL with **no size prefix** (`%I0.0`), one byte is allocated. Explicit `X` is preferred for bit access.

### 3.8 Initialization `:=` and constant `=`

```st
<id> : <type> := <expr> ;      (* runtime init for VAR/IN/OUT/STAT/GLOBAL/RETAIN/PERS *)
<id> : <type> =  <const_expr> ; (* constant init for CONSTANT / parameters with default *)
```

```st
i : INT := 5;
arr : ARRAY[0..2] OF INT := [1, 2, 3];
pi : REAL := 3.14;
VAR CONSTANT
    c_k : INT = 100;            (* '=' is valid alternative for CONSTANT *)
END_VAR
```

Caveats:
- `VAR_IN_OUT` cannot be initialized (C0041).
- `VAR_EXTERNAL` cannot be initialized (C0237).
- `CONSTANT` requires a constant expression; variable references are C0018/C0227.
- Initializer for an enum must be an `ANY_INT` constant (C0124).
- Struct initializers must be struct type (C0076), with components specified by name or position.

### 3.9 Attribute block on declarations `{attribute 'name' := 'value'}`

```st
VAR
    {attribute 'symbol' := 'read'}
    {attribute 'hide'}
    iVal : INT;
END_VAR
```

- Multiple attributes on the same line are allowed; order does not matter.
- Position: directly above or beside the declaration line.
- For Actions/Transitions: attribute is the first line of the **implementation** body.
- For POU itself: first line of POU declaration (e.g. `{attribute 'qualified_only'}`).

See §1.6.2 for the full catalogue.

---

## 4. POU (Program Organization Units)

A POU is a named, typed, executable block. ST supports six kinds:

```csv
Kind,Returns,State,Method-like,Can EXTENDS
PROGRAM,no,—,—,no
FUNCTION,yes (type),stateless,—,no
FUNCTION_BLOCK,no,stateful,—,yes (1 base)
METHOD,yes (type),bound to FB,yes (PUBLIC/PRIVATE/…),inherits
INTERFACE,—,declarations only,—,yes (multiple)
PROPERTY,getter/setter return,bound to FB,yes,—
```

All POUs share the shape:

```st
<pou_keyword> [<name>] [EXTENDS <base>] [IMPLEMENTS <itf> [, <itf>]*]
    [ : <return_type> ]
    [ {attribute ...} ]
    [ VAR_INPUT | VAR_OUTPUT | VAR_IN_OUT | VAR | ... ]*
    [ METHOD ... END_METHOD ]*
    [ PROPERTY ... END_PROPERTY ]*
END_<keyword>
```

### 4.1 PROGRAM ... END_PROGRAM

```st
PROGRAM PLC_PRG
VAR
    iVal : INT;
END_VAR
iVal := iVal + 1;
```

- No return type (C0026).
- Single instance per project (the main PLC task).
- Cannot be instantiated from code.

### 4.2 FUNCTION ... END_FUNCTION

```st
FUNCTION MAX2 : INT                (* return type mandatory *)
VAR_INPUT
    a : INT;
    b : INT;
END_VAR
IF a >= b THEN
    MAX2 := a;
ELSE
    MAX2 := b;
END_IF
```

- Has return type; **only** FUNCTION and METHOD can have a return type (C0177, C0182, C0243).
- No `EXTENDS`, no state (treat as pure).
- Cannot call itself (C0101).
- Calling: `i := MAX2(a := 3, b := 4);` or `i := MAX2(3, 4);`.
- Multiple outputs (since V3.5.x): `fun(in1 := 1, iOut1 => loc1, iOut2 => loc2);`.
- `VAR_IN_OUT` must be assigned on call (C0039); argument must be a writable variable of the same type (C0201).
- Positional args must come before named args (C0043).

### 4.3 FUNCTION_BLOCK ... END_FUNCTION_BLOCK

```st
FUNCTION_BLOCK FB_Counter
VAR_INPUT
    bUp : BOOL;
END_VAR
VAR_OUTPUT
    iCount : INT;
END_VAR
VAR
    bPrev : BOOL;
END_VAR
IF bUp AND NOT bPrev THEN
    iCount := iCount + 1;
END_IF
bPrev := bUp;
```

- Stateful; instances are persistent between calls.
- Can EXTENDS **one** base FB (C0090, C0094, C0096, C0097).
- Can IMPLEMENTS one or more INTERFACEs.
- Calling: `inst.METH1();` — method-style or `inst(input := value);` for parameterless body execution.
- No return type.

### 4.4 METHOD ... END_METHOD

```st
METHOD PUBLIC Calc : REAL
VAR_INPUT
    a : REAL;
    b : REAL;
END_VAR
Calc := SQRT(a*a + b*b);
```

- Only FUNCTION and METHOD can have a return type.
- Bound to a FB / INTERFACE; called as `inst.METHOD()` (C0130: parentheses required).
- Visibility: `PUBLIC | PRIVATE | PROTECTED | INTERNAL` (see §8.3).
- Modifiers: `ABSTRACT | FINAL | OVERRIDE` (see §8.5).

```st
METHOD FB_init : BOOL
VAR_INPUT
    bInitRetains : BOOL;
    bInCopyCode  : BOOL;
    nId          : INT;          (* user-defined init args *)
END_VAR
_nId := nId;
```

```st
PROGRAM PLC_PRG
VAR
    fb : FB_Counter(nId := 11);    (* calls FB_init *)
END_VAR
```

### 4.5 INTERFACE ... END_INTERFACE

```st
INTERFACE ICountable
    METHOD Reset : BOOL
    METHOD GetCount : DINT
END_INTERFACE

FUNCTION_BLOCK FB_Counter IMPLEMENTS ICountable
    METHOD Reset : BOOL
        iCount := 0; Reset := TRUE;
    END_METHOD
    METHOD GetCount : DINT
        GetCount := iCount;
    END_METHOD
END_FUNCTION_BLOCK
```

- Only method / property declarations, no variables (C0145).
- EXTENDS multiple interfaces (comma-separated).
- All methods of all interfaces must be implemented (C0086, C0087, C0149, C0199, C0239).
- Method signature must match exactly (C0089, C0094).

### 4.6 PROPERTY ... END_PROPERTY (getter/setter)

```st
FUNCTION_BLOCK FB_Counter
VAR
    _count : DINT;
END_VAR

PROPERTY PUBLIC Count : DINT
    GET          // optional; without it the property is write-only
        Count := _count;
    SET
        _count := Count;
END_PROPERTY
```

- Without a GET accessor the property is **write-only** (C0143).
- The set parameter is implicitly named after the property (`Count` in the body).
- For a property returning a simple type, the value passes through a hidden variable; for complex types the call invokes the accessor directly (see `monitoring` attribute, §1.6.2).

### 4.7 ACTION ... END_ACTION

```st
FUNCTION_BLOCK FB_Device
VAR
    bAlarm : BOOL;
END_VAR
ACTION AlarmBeep:
    bAlarm := TRUE;
END_ACTION
```

- Action: a **named implementation** of a FB; called via `<inst>.<Action>()` or `<inst>.<Action>();`.
- SFC POUs use actions for step qualifiers (N, P, L, D, S, R, SD, DS, SL — see SFC docs).
- Pseudo-embedded actions are bound to a single step.

### 4.8 TRANSITION ... END_TRANSITION

```st
FUNCTION_BLOCK FB_Device
VAR
    iVal : INT;
END_VAR
TRANSITION Trans1:
    iVal > 100;
END_TRANSITION
```

- Transition: a **named condition** returning `BOOL`.
- Used by SFC: a step's outgoing transition can be either a boolean expression or a named `TRANSITION` object.
- Inside the body only a single boolean expression is allowed (multi-statement logic goes in a property or method).

### 4.9 EXTENDS, IMPLEMENTS, ABSTRACT, FINAL, OVERRIDE

#### 4.9.1 EXTENDS

```st
FUNCTION_BLOCK FB_Base ...
FUNCTION_BLOCK FB_Derived EXTENDS FB_Base ...
```

- Single base only (C0090, C0094, C0096, C0097).
- No recursion in base list (C0091).
- Only on FB / INTERFACE / STRUCT (C0144).
- Duplicate variable names between base and derived → error.

#### 4.9.2 IMPLEMENTS

```st
FUNCTION_BLOCK FB_Dev IMPLEMENTS I_Counter, I_Reset
```

- All methods of all listed interfaces must be implemented with matching signature (C0086, C0087, C0089, C0149, C0199, C0239).
- Only on FB (not FUNCTION, not PROGRAM).

#### 4.9.3 ABSTRACT

```st
FUNCTION_BLOCK ABSTRACT FB_Animal
    METHOD ABSTRACT Speak : BOOL
END_FUNCTION_BLOCK
```

- ABSTRACT FB cannot be instantiated directly; use a derived concrete FB.
- ABSTRACT FB instances cannot be copied with `:=` (C0511). Use `REF=` for references.

```st
PROGRAM PLC_PRG
VAR
    a : REFERENCE TO FB_Animal;
    b : REFERENCE TO FB_Animal;
END_VAR
a REF= b;             // OK
a := b;               // bad: ABSTRACT FB cannot be copied (C0511)
```

#### 4.9.4 FINAL

```st
METHOD FINAL Done : BOOL     (* cannot be overridden further *)
```

- Method marked FINAL cannot be overridden in a derived FB.

#### 4.9.5 OVERRIDE

```st
FUNCTION_BLOCK FB_Derived EXTENDS FB_Base
    METHOD OVERRIDE Speak : BOOL     (* replaces base impl *)
        Speak := TRUE;
    END_METHOD
END_FUNCTION_BLOCK
```

- Method marked OVERRIDE replaces the base implementation.
- Signature must match the base exactly (C0089, C0094).

### 4.10 Constructor / destructor

| Method | Mandatory args | Return | Called when |
|---|---|---|---|
| `FB_Init` | `bInitRetains : BOOL; bInCopyCode : BOOL` (and optional user args) | `BOOL` | FB instance is created / initialized |
| `FB_Reinit` | (none required) | `BOOL` | After online change copied new code |
| `FB_Exit` | `bInCopyCode : BOOL` | `BOOL` | Before deletion / PLC stop |

```st
FUNCTION_BLOCK FB_Item
VAR
    _nId  : INT;
    _lrIn : LREAL;
END_VAR

METHOD FB_Init : BOOL
VAR_INPUT
    bInitRetains : BOOL;
    bInCopyCode  : BOOL;
    nId          : INT;
    lrIn         : LREAL;
END_VAR
_nId  := nId;
_lrIn := lrIn;
```

Constructor call:
```st
fb : FB_Item := (nId := 11, lrIn := 33.44);
```
or in array literal:
```st
aItems : ARRAY[0..1, 0..1] OF FB_Item := [
    (nId := 12, lrIn := 11.22),
    (nId := 13, lrIn := 22.33),
    (nId := 14, lrIn := 55.55),
    (nId := 15, lrIn := 11.22)
];
```

FB_Exit:
```st
METHOD FB_Exit : BOOL
VAR_INPUT
    bInCopyCode : BOOL;
END_VAR
__DELETE(_dut);     // free dynamic memory
```

### 4.11 THIS, SUPER^

#### 4.11.1 THIS

`THIS` is an implicit `POINTER TO <self FB>`, available in all methods and inside the FB body. Dereference: `THIS^`.

```st
THIS^.METH_DoIt();      // call own method explicitly
THIS^.iVarB := 222;     // disambiguate from local iVarB
```

If used outside method/FB body → C0045.

#### 4.11.2 SUPER^

`SUPER` is an implicit `POINTER TO <base FB>`, valid in derived FB methods.

```st
FUNCTION_BLOCK FB_Base
    METHOD METH_DoIt : BOOL
        iCnt := -1;

FUNCTION_BLOCK FB_1 EXTENDS FB_Base
    METHOD METH_DoIt : BOOL
        SUPER^.METH_DoIt();   // call base impl first
        iCnt := 1111;
        METH_DoIt := TRUE;
```

Used outside a derived FB → C0122.

---

## 5. Expressions

An **expression** computes a value. Operands are constants, variables, function calls, FB members, enum values. Operators combine operands.

```st
2014                 // constant
ivar                 // variable
fct(a, b)            // function call
(x * y) / z          // nested
real_var2 := (int_var := 5);  // ExST: assignment-as-expression
```

### 5.1 Operands

| Operand | Example |
|---|---|
| Numeric literal | `123`, `2#1010`, `16#FF`, `1.0E-3` |
| Bool literal | `TRUE`, `FALSE` |
| Time literal | `T#12ms`, `LTIME#1h`, `DT#2024-01-15-12:30:00` |
| String literal | `'text'`, `"wtext"` |
| Typed literal | `DINT#123`, `REAL#3.14` |
| Variable | `iCount`, `fbInst.xInput` |
| Bit access | `wA.7` |
| Array element | `arr[2, 3]` |
| Struct member | `s.x`, `s.point[i].y` |
| Enum | `COLOR.RED` |
| Function call | `MAX(a, b)`, `SIN(angle)` |
| Method call | `fbInst.METH()` |
| Pointer deref | `pt^`, `pt^.member` |
| Reference deref | `ref->member` (CODESYS extension) |
| Address | `ADR(x)` |
| Type conversion | `INT_TO_REAL(x)`, `TO_BOOL(x)`, `TRUNC(r)` |
| Selection | `SEL(g, a, b)`, `LIMIT(lo, x, hi)`, `MUX(k, a, b, c)` |
| Size | `SIZEOF(x)` |
| Special | `THIS`, `SUPER`, `__ISVALIDREF(r)`, `__CURRENTTASK.TaskIndex` |

### 5.2 Operator summary (full precedence)

Strongest first; same level left-to-right.

```csv
Level,Operation,Symbol,Notes
1,Parenthesized,(...),highest
2,Function/array/index,`f(...)` `a[i]` `p^` `r->m`,call/select
3,Exponentiation,`EXPT(a, b)`,only via function
4,Unary,`-` `NOT`,right-associative
5,Multiplicative,`*` `/` `MOD`,left-associative
6,Additive,`+` `-`,left-associative
7,Comparison,`<` `>` `<=` `>=`,left-associative
8,Equality,`=` `<>`,left-associative
9,Bool AND,`AND` `AND_THEN`,short-circuit on AND_THEN
10,Bool XOR,`XOR`,left-associative
11,Bool OR,`OR` `OR_ELSE`,short-circuit on OR_ELSE (lowest)
```

#### 5.2.1 Arithmetic

```st
a + b      a - b
a * b      a / b      a MOD b
EXPT(a, b)            // a^b, returns REAL/LREAL
```

`MOD` returns the integer remainder; operands must be `ANY_INT` (C0208). `/` on integers truncates. `EXPT` returns REAL/LREAL; if `base = 0` and `exponent < 0` the result is target-dependent.

`+` and `-` also work on `TIME` / `TOD` / `DT` (TIME arithmetic) — see §5.2.15.

#### 5.2.2 Relational

```st
a < b       a > b
a <= b      a >= b
a =  b      a <> b
```

Names: `GT`, `LT`, `LE`, `GE`, `EQ`, `NE`.

Operands must be of comparable types. Comparing `INT > STRING` → C0066/C0068/C0069.

#### 5.2.3 Logical (boolean)

```st
a AND b     a OR b
a XOR b     NOT a
```

Operands: `BOOL` (or `BIT` in bit-string context).

#### 5.2.4 Bitwise on numeric types

The keywords `AND`, `OR`, `XOR`, `NOT` are **overloaded** — on `BYTE/WORD/DWORD/LWORD` they perform bitwise ops; on `BOOL` they perform boolean ops. With more than two inputs, `XOR` is applied pairwise.

```st
var1 := 2#1001_0011 AND 2#1000_1010;   // = 2#1000_0010
var1 := 2#1001_0011 OR  2#1000_1010;   // = 2#1001_1011
var1 := NOT 2#1001_0011;               // = 2#0110_1100
```

#### 5.2.5 Short-circuit: `AND_THEN`, `OR_ELSE`

```st
IF (ptr <> 0 AND_THEN ptr^ = 99) THEN ...;   // safe dereference
bX := dw.8 OR_ELSE dw.1;                    // skips right side on TRUE
```

- Right side is **not** evaluated when the result is already determined.
- `AND` / `OR` always evaluate both sides (standard IEC behaviour).

#### 5.2.6 Shift / rotate

```st
erg := SHL(in, n)        // shift left
erg := SHR(in, n)        // shift right
erg := ROL(in, n)        // rotate left
erg := ROR(in, n)        // rotate right
```

Operands: `BYTE/WORD/DWORD/LWORD` (or numeric for `n`). Behaviour when `n ≥ width` is target-dependent (zero-fill or `n MOD width`).

#### 5.2.7 Address operators

```st
dw   := ADR(bVar);       // DWORD address of variable
bit  := BITADR(bVar);    // bit offset in segment (DWORD)
val  := pt^;             // dereference POINTER
idx  := INDEXOF(fb);     // deprecated — use ADR
```

`ADR` works on functions / programs / FB / methods (returns pointer to function pointer; **not** callable from CODESYS). `BITADR` returns a DWORD whose high nibble encodes the memory area (flag/input/output).

`ADR` constant segment codes (high nibble of `BITADR` result):
- `16x40000000` — flag `%M`
- `16x80000000` — input `%I`
- `16xC0000000` — output `%Q`

#### 5.2.8 Type conversion

```st
BOOL_TO_<type>            // TRUE → 1, FALSE → 0 (numeric); 'TRUE'/'FALSE' (STRING)
<type>_TO_BOOL            // ≠0 → TRUE, =0 → FALSE
TO_<type>                 // any → target (lossy)
<INT>_TO_<INT>            // narrow/widen integer
REAL_TO_<type>            // round to nearest integer
LREAL_TO_<type>
TIME_TO_<type>            // stores as ms in DWORD
DATE_TO_<type>            // stores as days/seconds
DT_TO_<type>
TOD_TO_<type>
STRING_TO_<type>          // parses literal; ignores trailing chars
TRUNC(r)                  // REAL → DINT (truncate toward zero)
TRUNC_INT(r)              // REAL → INT (V2.3 compat)
```

`STRING_TO_*` parses standard-compliant literal then truncates. Out-of-range result is undefined.

**IEC 61131-3:2013 type-conversion table** (excerpt):

```csv
Source,Target,Function name pattern
BOOL,INT,BOOL_TO_INT
BOOL,STRING,BOOL_TO_STRING
BOOL,TIME,BOOL_TO_TIME
BOOL,TOD,BOOL_TO_TOD
BOOL,DATE,BOOL_TO_DATE
BOOL,DT,BOOL_TO_DT
INT,REAL,INT_TO_REAL
INT,STRING,INT_TO_STRING
STRING,INT,STRING_TO_INT
STRING,REAL,STRING_TO_REAL
STRING,BOOL,STRING_TO_BOOL
REAL,INT,REAL_TO_INT (round-half-up, target-dependent)
REAL,DINT,TRUNC
```

#### 5.2.9 Selection

```st
OUT := SEL(g, in0, in1)              // g=FALSE → in0, g=TRUE → in1
OUT := MAX(a, b)                     // larger
OUT := MIN(a, b)                     // smaller
OUT := LIMIT(lo, in, hi)             // clip to [lo..hi] (LIMIT := MIN(MAX(in, lo), hi))
OUT := MUX(k, in0, in1, ..., inN)    // k-th input (k=0..N); k>N → inN
```

`MUX` requires at least 3 operands (C0023). `SEL` short-circuits the unselected branch in ST.

#### 5.2.10 Numerical functions

```csv
Operator,Description,In → Out,Example
ABS,absolute value,num → num,`i := ABS(-2);` → 2
SQRT,square root,num → REAL/LREAL,`q := SQRT(16);` → 4
LN,natural log,num → REAL/LREAL,`q := LN(45);` → 3.80666
LOG,base-10 log,num → REAL/LREAL,`q := LOG(314.5);` → 2.49762
EXP,exponential,num → REAL/LREAL,`q := EXP(2);` → 7.389056099
EXPT,power,num^num → REAL/LREAL,`Var1 := EXPT(7, 2);` → 49
SIN,sinus,angle in rad → REAL/LREAL,`q := SIN(0.5);` → 0.479426
COS,cosinus,angle in rad → REAL/LREAL,`q := COS(0.5);` → 0.877583
TAN,tangens,angle in rad → REAL/LREAL,`q := TAN(0.5);` → 0.546302
ASIN,arc-sinus,num → REAL/LREAL,`q := ASIN(0.5);` → 0.523599
ACOS,arc-cosinus,num → REAL/LREAL,`q := ACOS(0.5);` → 1.0472
ATAN,arc-tangens,num → REAL/LREAL,`q := ATAN(0.5);` → 0.463648
```

#### 5.2.11 String functions

Implemented as standard library calls (e.g. `Standard` / `StringUtils` 2.x / 3.x / 4.x):

```csv
Function,Description,Signature
LEN,string length,`LEN(s : STRING) : INT`
CONCAT,concatenation,`CONCAT(s1, s2 : STRING) : STRING`
LEFT,left substring,`LEFT(s : STRING; n : INT) : STRING`
RIGHT,right substring,`RIGHT(s : STRING; n : INT) : STRING`
MID,middle substring,`MID(s : STRING; n : INT; p : INT) : STRING`
FIND,substring search,`FIND(s1, s2 : STRING) : INT`
REPLACE,replace substring,`REPLACE(s1, s2, s3 : STRING) : STRING`
DELETE,delete substring,`DELETE(s : STRING; n : INT; p : INT) : STRING`
INSERT,insert substring,`INSERT(s1, s2 : STRING; p : INT) : STRING`
TO_UPPER / TO_LOWER,case conversion,`TO_UPPER(s : STRING) : STRING`
```

#### 5.2.12 Dynamic memory / system

```st
<id> := __NEW(<type> (, <size>)? );         // allocate
__DELETE(<ptr>);                            // release
ok := __ISVALIDREF(<ref>);                  // ref valid?
ok := __QUERYINTERFACE(<itf_src>, <itf_dst>);
ok := __QUERYPOINTER(<itf_src>, <ptr>);
__TRY
    <stmts>
__CATCH(<exc>)
    <stmts>
__FINALLY
    <stmts>
__ENDTRY
info := __VARINFO(<var>);                   // __SYSTEM.VAR_INFO
info := __CURRENTTASK;                      // task index / pointer
```

`<type>` in `__NEW` can be a standard scalar (with `<size>`), an array, a DUT, or a FB marked with `{attribute 'enable_dynamic_creation'}`. Returned pointer is 0 on allocation failure.

`__SYSTEM.VAR_INFO` fields:

```csv
Field,Type,Description
ByteAddress,DWORD,Address of variable
ByteOffset,DWORD,Byte offset within area
Area,DINT,Memory area number (-1 = local/instance)
BitNr,INT,Bit number within byte (-1 for non-bit)
BitSize,INT,Size in bits
BitAddress,UDINT,Bit address (%I/%Q/%M)
TypeClass,TYPE_CLASS,Class (TYPE_INT, TYPE_ARRAY, …)
TypeName,STRING(79),Type name
NumElements,UDINT,Array element count
BaseTypeClass,TYPE_CLASS,Element base type
ElemBitSize,UDINT,Element size in bits
MemoryArea,MEMORY_AREA,Area info
Symbol,STRING(39),Variable name
Comment,STRING(79),Declaration comment
```

#### 5.2.13 Multicore / atomic

```st
ok := __COMPARE_AND_SWAP(ADR(w), old, new);  // DWORD/LWORD atomic CAS
old := __XADD(ADR(di), delta);              // DINT atomic add-return-old
old := TEST_AND_SET(dwSynch);               // DWORD atomic test-and-set
```

`__XWORD` is `DWORD` on 32-bit, `LWORD` on 64-bit. Operations are atomic — uninterruptible even on multicore.

#### 5.2.14 Namespace access

```st
.<global_var>                              // dot-leader global
gvlName.varName                            // GVL disambiguation
libName.POUName                            // library disambiguation
EnumName.ComponentName                     // enum constant
fbInst.METHOD()                            // method on instance
fbInst.field                               // member access
```

`__SYSTEM` namespace provides `VAR_INFO`, `ExceptionCode`, `IQueryInterface`, etc.

#### 5.2.15 `SIZEOF`, `INI`, `LOWER_BOUND`, `UPPER_BOUND`

```st
n := SIZEOF(arr1);                          // 10 → USINT/UINT/UDINT/ULINT
b := INI(fbInst, TRUE);                     // V2.3 compat; re-init retain vars
lo := LOWER_BOUND(arrin, 0);                // only for ARRAY[*] (VAR_IN_OUT)
hi := UPPER_BOUND(arrin, 0);
```

`SIZEOF` adapts return type: 0..255 → USINT, ≤65535 → UINT, ≤4294967295 → UDINT, larger → ULINT.

#### 5.2.16 Assignment operators

```st
a   :=  expr;            // standard assignment
a   =>  b;               // bind FB/method/function output
a   S=  b;               // set: a := TRUE iff b = TRUE
a   R=  b;               // reset: a := FALSE iff b = TRUE
a   REF= b;              // bind reference to address of b
```

### 5.3 Function call

```st
<func>( [ <arg> (, <arg>)* ] )
<func>( <param> := <expr> (, <param> := <expr>)* )
```

- Positional args before named args.
- Optional input args may be omitted.
- `VAR_INPUT` of FB / FUNCTION can be given a default `:=` value.

```st
i := MAX2(3, 4);
i := MAX2(b := 4, a := 3);              // named
i := LIMIT(0, sensor, 100);
```

### 5.4 FB call / method call

```st
<inst>();                              // parameterless body run
<inst>(<param> := <expr>, ...);        // input parameters
<inst>(<param> := <expr>, <out> => <var>);
<inst>.METHOD();                       // method call (C0130: parens required)
<inst>.PROPERTY := <expr>;             // property setter
<var> := <inst>.PROPERTY;              // property getter
```

```st
TMR: TON;
TMR(IN := %IX0.0, PT := T#300ms);
bDone := TMR.Q;
```

**Calling FB inside a function** — only via `VAR_IN_OUT` (C0119) or method passing (`THIS^`).

### 5.5 Nested expressions / parentheses

```st
result := (a + b) * (c - d) / MAX(e, f);
ok     := (x >= 0) AND (x <= 100);
bEq    := ((arr[0] = 0) OR_ELSE (arr[1] = 0)) AND (n > 0);
```

---

## 6. Statements (control flow)

### 6.1 Assignment

```st
<a> := <expr> ;
<a> => <var> ;         // output binding
<a> S= <b> ;           // set
<a> R= <b> ;           // reset
<a> REF= <b> ;         // reference binding
```

Multiple assignments on one line (ExST):
```st
a := b := c := 5;      // all three become 5
```

### 6.2 IF ... THEN ... ELSIF ... ELSE ... END_IF

```st
IF <cond1> THEN
    <stmts>
( ELSIF <cond2> THEN
    <stmts> )*
( ELSE
    <stmts> )?
END_IF ;
```

At most one branch runs. Empty branches: `IF b THEN ; END_IF` (C0190 OK).

Errors: C0006 (no THEN), C0007 (no expr), C0008 (no END_IF), C0013 (empty THEN).

```st
IF iTemp < 17 THEN
    xHeatingOn := TRUE;
ELSIF iTemp > 25 THEN
    xOpenWindow := TRUE;
ELSE
    xHeatingOn := FALSE;
END_IF;
```

### 6.3 CASE ... OF ... END_CASE

```st
CASE <sel> OF
    <val_1> : <stmts>
    <val_2>, <val_3>, <val_4> : <stmts>
    <lo_5> .. <hi_5> : <stmts>
    ...
    ELSE <stmts>?
END_CASE ;
```

#### 6.3.1 Range syntax `a..b`

```st
CASE i OF
    0:    x := 9;
    1:    i := i+1;
    3..5: i := i+2;
    ELSE  i := i+10;
END_CASE;
```

#### 6.3.2 List `a, b, c`

```st
1, 5, 9 : x := 1;     // any of {1,5,9} → set x=1
```

#### 6.3.3 ELSE default

```st
ELSE
    bVar1 := NOT bVar1;
END_CASE;
```

Rules:
- Labels are literals / symbolic constants (not variables).
- Ranges must not overlap (C0011, C0216–C0219).
- Each label used at most once.
- CASE selector type must be `ANY_INT` (typically).

### 6.4 FOR ... TO ... BY ... DO ... END_FOR

```st
FOR <ctr> := <start> TO <end> ( BY <step> )? DO
    <stmts>
END_FOR ;
```

- `<step>` defaults to 1; can be negative.
- `<ctr>` must be a local variable (cannot be a struct field in the standard).
- Condition is checked **before** each iteration.
- **Watch out**: `<end>` must not equal the max of the counter's type (infinite loop risk).

```st
FOR i := 1 TO 5 BY 1 DO
    iVar1 := iVar1 * 2;
END_FOR;

FOR i := 10 TO 0 BY -1 DO       // negative step
    arr[i] := i;
END_FOR;
```

#### 6.4.1 Negative step

Allowed via `BY -N`. Loop stops when counter < end (with negative step).

#### 6.4.2 EXIT from FOR

`EXIT;` leaves the innermost `FOR`/`WHILE`/`REPEAT` immediately.

Errors: C0010 (no start), C0015/C0016 (other FOR errors).

### 6.5 WHILE ... DO ... END_WHILE

```st
WHILE <cond> DO
    <stmts>
END_WHILE ;
```

- Condition tested **before** each iteration.
- Body may execute zero times.

```st
WHILE iCounter <> 0 DO
    Var1 := Var1 * 2;
    iCounter := iCounter - 1;
END_WHILE;
```

### 6.6 REPEAT ... UNTIL ... END_REPEAT

```st
REPEAT
    <stmts>
UNTIL <cond>
END_REPEAT ;
```

- Condition tested **after** each iteration → body runs at least once.
- Loop exits when `<cond>` becomes `TRUE`.

```st
REPEAT
    Var1 := Var1 * 2;
    iCounter := iCounter - 1;
UNTIL iCounter = 0
END_REPEAT;
```

### 6.7 RETURN

```st
RETURN;       // leaves the current POU
```

For FUNCTION/METHOD, sets the return value via the function name / method name before the RETURN.

```st
FUNCTION max2 : INT
VAR_INPUT a, b : INT; END_VAR
IF a >= b THEN max2 := a; RETURN; ELSE max2 := b; RETURN; END_IF
```

### 6.8 EXIT

```st
EXIT;         // leave innermost FOR / WHILE / REPEAT
```

`EXIT` outside a loop → C0114.

### 6.9 CONTINUE (CODESYS extension)

```st
CONTINUE;     // jump to the next iteration of the innermost loop
```

```st
FOR i := 1 TO 5 BY 1 DO
    IF xBad[i] THEN
        CONTINUE;
    END_IF;
    s := s + data[i];
END_FOR;
```

### 6.10 JMP and labels (unconditional jump — IEC 61131-3 §6.6.5)

```st
<label>: <stmts>
JMP <label>;
```

`<label>` is a unique identifier placed at the start of a line.

```st
i := 0;
_loop:
    i := i + 1;
    IF i < 10 THEN
        JMP _loop;
    END_IF;
```

Errors: C0116 (invalid label), C0117 (duplicate), C0118 (unused), C0132 (undefined), C0114 if used outside permitted context.

Note: `JMP` and labels are part of IEC 61131-3. `JMPC`/`JMPCN` are IL-specific conditional jumps and not applicable in ST.

### 6.11 Conditional jumps (IL only)

`JMPC` and `JMPCN` are IL operators and not legal in ST. Use `IF` in ST instead.

### 6.12 Empty statement

```st
;     // legal
```

```st
IF bTest THEN ; END_IF;        // explicit empty then-branch
```

C0190 — empty statement is OK.

---

## 7. ST-specific constructs

This section catalogues constructs that are either specific to ST or to CODESYS Extended ST (ExST). Each subsection has a syntax rule, an `st` snippet, and a one-line semantic note.

### 7.1 ExST — assignment as expression

In ExST, an assignment `:=` returns a value and can be nested.

```st
int_var1 := int_var2 := int_var3 + 9;   // int_var1 and int_var2 = int_var3 + 9
real_var1 := real_var2 := int_var;      // both get value of int_var
IF b := (i = 1) THEN                    // assignment used as condition
    i := i + 1;
END_IF
```

Semantics: the rightmost `:=` is evaluated first; the resulting value is then assigned to each L-value left-to-right.

In a multi-assignment **with `S=` / `R=`**:

```st
xSetVariable S= xResetVariable R= funCompute(xIn := xVar);
```

`xResetVariable` gets `R=` of `funCompute`'s return value; `xSetVariable` gets `S=` of the **same** return value (not of `xResetVariable`).

### 7.2 Multiple assignment in one statement

```st
a := b := c := 0;
xS := xS2 := xS3 := 'init';
```

Each L-value receives the same value; types must be compatible with the rightmost expression.

### 7.3 Direct bit access `.Xn`

```st
wA.2 := xB;                    // bit 2 of WORD wA := BOOL xB
iX.c_usiENABLE := TRUE;        // bit indexed by global USINT constant
```

- Index range: 0..n−1 (n = bit-width of base type).
- Index may be a literal or a **symbolic integer constant** (C0050). Variable index is a compile error.
- Bit access on a function-call result is forbidden (C0061).
- Bit access on a non-bit-string is forbidden (C0062 for non-struct, C0044 etc.).

Bit-width by type:

```csv
Type,Bit range
BYTE,..7
WORD,..15
DWORD,..31
LWORD,..63
SINT,..7
USINT,..7
INT,..15
UINT,..15
DINT,..31
UDINT,..31
LINT,..63
ULINT,..63
```

```st
PROGRAM PLC_PRG
VAR
    wA : WORD := 16#FF;
END_VAR
wA.2 := 0;       // wA = 16#FFFB
```

### 7.4 Slice access on bit-strings

Slicing is supported on bit-strings via the dot-index notation, including slice ranges in CODESYS V3.5+. *IEC 61131-3:2013 — добавлено из стандарта.*

```st
wA.0..7   := 0;        // zero low byte
wA.8..15  := dwHigh;   // copy high byte
```

Slice on POINTER works as pointer arithmetic + deref:
```st
pint[i]                // = (pint + i * SIZEOF(base))^
```

Slice on STRING / WSTRING:
```st
s := 'Hello';
c := s[2];              // = 'l' as SINT
```

### 7.5 Struct member access `.`

```st
s.x := 1;              // direct field
s.point[i].y := 2;     // nested struct + array
fbInst.fieldA := TRUE; // FB instance member
```

Member access is also called **component access** or **structured variable access**.

```csv
LHS,Form,Meaning
`fbInst.input`,`.VAR_INPUT`,FB input pin
`fbInst.output`,`.VAR_OUTPUT`,FB output pin
`fbInst.field`,`.VAR` / `.VAR_STAT`,FB internal
`s.field`,`.field`,struct field
`arr[i].field`,`[].field`,array element field
```

### 7.6 Array indexing `[i, j, k]` and partial slice `[lo..hi]`

#### 7.6.1 Single index

```st
a[2]                // 1-D
a[i, j]             // 2-D
a[i, j, k]          // 3-D
```

#### 7.6.2 Slice `[lo..hi]`

CODESYS supports the IEC 61131-3:2013 slice syntax on arrays:

```st
a[0..9]    := 0;            // zero first 10 elements
b := a[5..10];              // copy slice (only in array context)
a[2..4]    := src[7..9];    // copy 3 elements
```

The slice must fit in the array bounds; mismatch → C0049.

#### 7.6.3 Array of arrays

```st
a2d : ARRAY[1..2] OF ARRAY[1..3] OF INT;
a2d[1][2] := 1200;          // alternative
a2d[1, 2]  := 1200;         // equivalent
```

### 7.7 Pointer dereference `p^` and `p^.member`

```st
VAR
    p : POINTER TO DUT;
    d : DUT;
END_VAR
p := ADR(d);
p^.x := 5;            // same as d.x := 5
y := p^.x;            // same as y := d.x
```

- `p^` is the dereference.
- `p^.member` accesses the member of the dereferenced value.
- For FUNCTION/FUNCTION_BLOCK/PROGRAM, `p^` is a function pointer (not callable from CODESYS).
- Pointer arithmetic: `p + n` advances by `n * SIZEOF(base)`.
- `p - q` is always DWORD (32-bit), even on 64-bit.

### 7.8 Reference dereference `ref->member` (CODESYS extension)

`REFERENCE TO` does not need `^` for read/write, but the C-style `->` is supported as shorthand for `ref^.member`.

```st
VAR
    r : REFERENCE TO MyStruct;
    s : MyStruct;
END_VAR
r REF= s;
r^.x := 1;        // explicit deref
r->x := 1;        // shorthand (CODESYS extension)
```

*IEC 61131-3:2013 — добавлено из стандарта*: the C-style `->` arrow is a CODESYS convenience; pure IEC 61131-3:2013 only specifies `ref^` deref.

### 7.9 Recursive function / FB (allowed, but watch stack)

IEC 61131-3 allows recursive functions and FBs. The runtime uses a stack per task; deep recursion may trip the watchdog or exceed `max-stack-size`.

```st
{attribute 'estimated-stack-usage' := '99'}
METHOD PUBLIC Factorial : UDINT
VAR_INPUT
    uiN : UINT;
END_VAR
Factorial := 1;
IF uiN > 1 THEN
    Factorial := uiN * THIS^.Factorial(uiN := uiN - 1);
    RETURN;
ELSE
    RETURN;
END_IF
```

The `{attribute 'estimated-stack-usage' := '<bytes>'}` pragma suppresses the "recursive method" warning.

### 7.10 Recursion rules: data recursion vs call recursion

| Kind | Forbidden? | Example |
|---|---|---|
| **Data recursion** (FB contains instance of itself) | Forbidden at compile time (C0224) | `FB1 { VAR fb2 : FB2; } FB2 { VAR fb1 : FB1; }` |
| **Call recursion** (method calls itself via `THIS^` or local instance) | Allowed; warn + stack risk | `m := m * THIS^.m(n-1);` |
| **Function recursion** | Forbidden (C0101) | `FUNCTION F; F();` — bad |

```st
// Data recursion — bad
FUNCTION_BLOCK FB1
VAR
    fb2 : FB2;
END_VAR
FUNCTION_BLOCK FB2
VAR
    fb1 : FB1;        // C0224
END_VAR
```

---

## 8. Method / class semantics

This section deepens the OO features introduced in §4.4, §4.5, §4.9.

### 8.1 `THIS` (self-reference)

`THIS` is an implicit `POINTER TO <self FB>` available in all methods and in the FB body itself. Dereference: `THIS^`.

```st
FUNCTION_BLOCK fbA
VAR_INPUT
    iVarA: INT;
END_VAR
iVarA := 1;

FUNCTION_BLOCK fbB EXTENDS fbA
VAR_INPUT
    iVarB : INT := 0;
END_VAR
iVarA := 11;
iVarB := 2;

METHOD DoIt : BOOL
VAR
    iVarB : INT;       // shadows instance var
END_VAR
iVarB     := 22;        // local
THIS^.iVarB := 222;      // instance
```

Without `THIS^`, the local `iVarB` shadows the instance `iVarB`. Errors: C0045 outside method/FB body.

```st
funA(pFB := THIS^);   // pass self to function expecting fbA
```

### 8.2 `SUPER^` (call parent)

`SUPER` is an implicit `POINTER TO <base FB>`; valid in derived FB methods. Use to call base implementation:

```st
FUNCTION_BLOCK FB_Base
VAR_OUTPUT
    iCnt : INT;
END_VAR
METHOD METH_DoIt : BOOL
    iCnt := -1;

FUNCTION_BLOCK FB_1 EXTENDS FB_Base
VAR_OUTPUT
    iBase : INT;
END_VAR
METHOD METH_DoIt : BOOL       // override
    SUPER^.METH_DoIt();        // call base first
    iCnt := 1111;
    METH_DoIt := TRUE;
iBase := SUPER^.iCnt;         // access base field
```

Errors: C0122 outside a derived FB.

### 8.3 Method visibility

```st
METHOD PUBLIC MyMethod : INT     // visible everywhere
METHOD PRIVATE MyMethod : INT    // visible only inside this FB
METHOD PROTECTED MyMethod : INT  // visible in this FB and derived FBs
METHOD INTERNAL MyMethod : INT   // visible inside the same library / namespace
```

Default visibility: PUBLIC (CODESYS), but the standard default may be `INTERNAL` for libraries.

### 8.4 Method overloading

Methods of the same name with different parameter signatures **are** allowed in CODESYS V3.5+ (signature = name + parameter types). The compiler picks the right one by the actual arg types.

```st
METHOD PUBLIC Set : BOOL
VAR_INPUT r : REAL; END_VAR
    _r := r;

METHOD PUBLIC Set : BOOL          // overload
VAR_INPUT i : INT; END_VAR
    _i := i;
```

*IEC 61131-3:2013 — добавлено из стандарта* explicitly permits overloading for methods, but not for FB or FUNCTION identifiers.

### 8.5 ABSTRACT / FINAL / OVERRIDE

```st
FUNCTION_BLOCK ABSTRACT FB_Shape
    METHOD ABSTRACT Area : REAL       // no body
END_FUNCTION_BLOCK

FUNCTION_BLOCK FB_Rect EXTENDS FB_Shape
    VAR_INPUT w, h : REAL; END_VAR
    METHOD OVERRIDE Area : REAL
        Area := w * h;
    END_METHOD
END_FUNCTION_BLOCK

FUNCTION_BLOCK FINAL FB_Leaf            // cannot be extended
    METHOD FINAL Done : BOOL            // cannot be overridden
END_FUNCTION_BLOCK
```

Rules:
- `ABSTRACT` FB: cannot be instantiated, but `REF TO AbstractPOU` is allowed.
- `FINAL` FB: cannot be inherited.
- `FINAL` method: cannot be `OVERRIDE`n in derived.
- `OVERRIDE` method: signature must match base exactly (C0089, C0094).
- `ABSTRACT` method: must be overridden in a concrete derived FB.
- `ABSTRACT` FB instances cannot be copied with `:=` (C0511) — use `REF=`.

### 8.6 Property syntax (getter / setter)

```st
FUNCTION_BLOCK FB_Counter
VAR
    _count : DINT;
END_VAR

PROPERTY PUBLIC Count : DINT
    GET
        Count := _count;
    SET
        _count := Count;        // implicit parameter is named after the property
END_PROPERTY
```

- A property **without** `GET` is write-only (C0143).
- A property with `SET` only: writing triggers the setter.
- The implicit parameter name in `SET` is the property name (`Count` here).

```st
fb.Count := 10;            // calls SET
x := fb.Count;             // calls GET
```

### 8.7 Interface inheritance via `IMPLEMENTS`

```st
INTERFACE ICountable EXTENDS IResettable     // multiple EXTENDS allowed
    METHOD Reset : BOOL
    METHOD GetCount : DINT
END_INTERFACE

INTERFACE IResettable
    METHOD Reset : BOOL
END_INTERFACE

FUNCTION_BLOCK FB_Counter IMPLEMENTS ICountable, IAudible
    METHOD Reset : BOOL
        iCount := 0; Reset := TRUE;
    END_METHOD
    METHOD GetCount : DINT
        GetCount := iCount;
    END_METHOD
    METHOD Beep : BOOL           // for IAudible
        ...
    END_METHOD
END_FUNCTION_BLOCK
```

Rules:
- A FB can `IMPLEMENTS` one or more interfaces (comma-separated).
- All methods of all interfaces must be implemented (C0086/C0087/C0149/C0199/C0239).
- Signatures must match (C0089/C0094).
- `IMPLEMENTS` is only valid on FB (not on FUNCTION or PROGRAM).
- INTERFACE may `EXTENDS` multiple other INTERFACEs.
- INTERFACE bodies may not contain variable declarations (C0145).

Casting between interface references:

```st
itfBase : ItfBase := inst1;       // assign FB to interface ref
itfDerived1 : ItfDerived1 := 0;   // null init
ok := __QUERYINTERFACE(itfBase, itfDerived1);    // TRUE / FALSE
ok := __QUERYPOINTER(itfBase, pInst);           // to raw pointer
```

---

## 9. Direct addresses (ST)

IEC 61131-3:2013 retains a special syntax for direct I/O addresses. They are visible inside ST as long as the project has a configured I/O image.

### 9.1 Boolean input `%IX0.0`

```st
bVal := %IX0.0;        // bit 0 of input byte 0
```

### 9.2 Boolean output `%QX0.0`

```st
%QX0.0 := TRUE;        // set output bit
%Q7.5  := xSensor;     // older form without size prefix
```

### 9.3 Memory bit `%MX0.0`

```st
flag := %MX0.7;
```

### 9.4 Integer input word `%IW0`

```st
wVal := %IW2;          // 16-bit input word at offset 2
```

### 9.5 Analog output `%QW0`

```st
%QW4 := INT#1234;      // 16-bit analog output
```

### 9.6 Physical input/output via `AT`

```st
VAR
    wInput   AT %IW0   : WORD;
    bOutBit  AT %QX7.5 : BOOL;
    xSensor  AT %IX1.0 : BOOL;
    xFlag    AT %MX0.1 : BOOL;
END_VAR

wInput  := %IW2;       // direct read into mapped variable
bOutBit := TRUE;        // write to mapped bit
```

For BOOL with no size prefix, **one byte** is allocated internally; using `X` (`%IX7.5`) is the precise way to bind a single bit. The whole byte from `QX0.0` to `QX0.7` is reserved by `xActuator AT %QW0 : BOOL` until reallocated.

Direct addresses can be multidimensional per target:

```st
%IW2.5.7.1            // target-dependent interpretation
```

Error IDs: C0030 (not a direct address), C0221 (incomplete address `%IX0` without bit).

---

## 10. Reserved / legacy / extension

### 10.1 Deprecated keywords

| Keyword | Replacement | Compile error | Notes |
|---|---|---|---|
| `FUNCTIONBLOCK` | `FUNCTION_BLOCK` | C0098 | Old spelling |
| `INDEXOF` | `ADR` | C0191 | Old operator |
| `INI` | `FB_Init` | — | V2.3 compat |
| `PRG` | `PROGRAM` | — | Alias |
| `bit-data type` (`BIT` in `VAR`/`VAR_INPUT`/`VAR_OUTPUT`) | only inside STRUCT/FB | C0203 | Compiler enforcement |
| `ARRAY OF BIT` | — | C0206 | Not allowed |
| `POINTER TO BIT` | — | C0064 | Not allowed |
| Function recursion | — | C0101 | Disallowed |
| `inst[0].METH()` | `arr := inst();` then `arr[0].METH()` | C0185 | Component access on call result |

### 10.2 CODESYS-specific extensions

These are CODESYS V3 additions beyond IEC 61131-3:2013 (compiler ≥ 3.5.x). Documented but not portable to other IDEs.

```csv
Feature,Notes
`__NEW` / `__DELETE` / `__ISVALIDREF`,Dynamic memory operators
`__QUERYINTERFACE` / `__QUERYPOINTER`,Interface casting
`__TRY` / `__CATCH` / `__FINALLY` / `__ENDTRY`,Exception handling
`__VARINFO` / `__CURRENTTASK`,Runtime introspection
`__COMPARE_AND_SWAP` / `__XADD` / `TEST_AND_SET`,Atomic ops
`{attribute 'pack_mode' := '2'}`,Memory layout hints
`{attribute 'symbol' := 'read'}`,Symbol-config export
`{attribute 'instance-path'}` / `init_namespace`,Reflection
`REFERENCE TO` (and `REF TO`),Managed references (CODESYS)
`AND_THEN` / `OR_ELSE`,Short-circuit bool
`CONTINUE`,Skip-to-next-iteration
`S=` / `R=` / `REF=`,Set/Reset/Reference assignment
`CAL` (in ST),Legacy FB call
`->` (arrow),C-style ref deref
`__VECTOR`,SIMD vector type
`__UXINT` / `__XWORD`,Platform-independent atomic types
`UNION`,C-style overlapping fields
`{IF defined(...)} ... {END_IF}`,Preprocessor conditionals
`{region 'name'}` / `{endregion}`,Code folding
`estimated-stack-usage` attribute,Recursive-method stack hint
```

### 10.3 Vendor-neutral IEC 61131-3:2013 additions

These are part of the **standard** but added in the 2013 edition (third edition). Earlier IEC 61131-3:2003 did not have them.

```csv
Feature,Notes
`REFERENCE TO` / `REF TO`,Managed references
Interfaces (`INTERFACE ... END_INTERFACE`),Full OOP interface concept
`IMPLEMENTS`,Interface implementation on FB
`EXTENDS` (FB),Single inheritance for FB
`METHOD ... END_METHOD`,Methods bound to FB/interface
`PROPERTY ... END_PROPERTY`,Getter/setter syntax
`THIS`,Self-reference
`SUPER`,Base-class reference
`ABSTRACT` / `FINAL` / `OVERRIDE` POUs,OOP modifiers
`PUBLIC` / `PRIVATE` / `PROTECTED` / `INTERNAL`,Visibility
`VAR_INST`,Method-level instance storage
`VAR_ACCESS` / `VAR_ACCESS CONSTANT` + `READ_ONLY` / `READ_WRITE`,OPC-style access paths
NAMESPACEs (`NAMESPACE ... END_NAMESPACE`),*Vendor-neutral IEC 61131-3:2013 namespaces are limited; CODESYS V3 provides dot-separated namespace paths*
`LREAL` 64-bit,Standard now requires LREAL (was V3.5)
`LTIME` 64-bit,High-resolution time
`UNION`,Standard (was a vendor extension)
`REF` keyword,Alias for REFERENCE TO
`->` (arrow),*CODESYS extension — not strictly part of 2013*
Multiple-input `AND` / `OR` / `XOR` (n-ary),Standard
`S=`, `R=`, `REF=`,Standard extensions
`LOWER_BOUND` / `UPPER_BOUND` for `ARRAY[*]`,Standard for VLAs
```

---

## 11. Error codes (C0001..C0511)

The table below summarises the IEC 61131-3 (CODESYS) ST compiler error IDs that the source references cover. Each ID has a one-line description and a typical bad / good example.

### 11.1 C0001–C0026 (identifiers, base syntax, expressions)

```csv
ID,Message,Example / note
C0001,Constant `<v>` too large for type `<t>`,`test1 := 12345678912345566991923939292939911;` (overflows ANY_INT)
C0002,`<op1>` or `<op2>` expected instead of `<tag>`,`Fun(1;` (missing `,` or `)`)
C0003,`<v>` is not a valid bit number for `<var>`,`test1 := test2.17;` (bit beyond WORD width)
C0004,`<var>` is not a component of `<struct>`,`test2 := test1.z;` when DUT has only `x, y`
C0006,`THEN` required,`IF bTest x := 9; END_IF`
C0007,Expression required after `IF`,`IF THEN x := 9; END_IF`
C0008,`END_IF` required,`IF bTest THEN x := 9;`
C0010,Loop counter initial value required,`FOR i TO 10 DO ; END_FOR`
C0011,`CASE` label required,`CASE i OF 1: x:=9;`
C0013,`THEN` branch needs a statement,`IF bTest THEN x := 9;` (empty)
"C0015, C0016",`FOR` loop errors,see §6.4
C0018,`CONSTANT` initialized with a variable,`VAR CONSTANT k : INT := i; END_VAR`
C0020,Extra argument,`i := Test(1,2);`
C0022,Too many operands to `ADR`,`pi := ADR(i, 1);`
C0023,`MUX` requires exactly 3 operands,`i := MUX(30, 40);`
C0026,Method name must be a valid identifier,bad: `METHOD 123 VAR_INPUT END_VAR`<br>good: `METHOD METH123`
```

### 11.2 C0027–C0089 (types, POU, methods)

```csv
ID,Message,Example / note
C0027,`STRING` requires a size,`str : STRING();`
C0030,`AT` requires a direct address,`i AT ABC : INT;`
C0031,Unknown type,`i : INTEGER;`
C0032,Implicit type conversion loses info,`i := b;` (UINT → INT loses sign)
C0035,PROGRAM cannot have a return type,`PROGRAM PLC_PRG : BOOL VAR END_VAR`
C0037,`VAR_INPUT` for function input,see §4.2
C0038,`VAR_OUTPUT` for function output,see §4.2
C0039,`VAR_IN_OUT` must be assigned on call,`inst(inout := i);`
C0040,Function parameters,see §4.2
C0041,`VAR_IN_OUT` requires a writable variable,see §3.1
C0043,Parameter order: positional before named,
C0044,Function parameter validation,see §4.2
C0045,`THIS` outside method/action/transition/FB body,`THIS^.test1 := 19;`
C0046,Identifier must be declared,`i := 1;` with no `VAR i:INT`
C0047,Indexing a non-array,`i[1];`
C0048,Array index count mismatch,`arr1[1] := 5;` on 2-D array
C0049,Index out of range,`arr1[3] := 1;` on 1..2
C0050,Bit index must be literal/constant,`i.x := FALSE;`
C0061,Bit access on function-call result,`Test().2;`
C0062,Component access on non-struct,`i.x := 1024;`
C0064,`POINTER TO BIT` not allowed,`pt : POINTER TO BIT;`
C0066,Incomparable types,`b := i > str;`
C0068,Incomparable types,see C0066
C0069,Incomparable types,see C0066
C0070,Operator / expression error,`x = 2;` (no L-value)
C0072,Operator / expression error,`b := INI(b, TRUE);`
C0074,Init expression not for ARRAY,`arr1 : INT := [1,2,3];`
C0075,More init values than array size,`arr1 : ARRAY[1..5] OF INT := [1,2,3,4,5,6];`
C0076,Init expression not for STRUCT,`st1 : INT := (p1 := 1);`
C0077,Unknown type,
C0080,POU structure / context error,
C0081,Pragma without `IF`,`{END_IF}` alone
C0082,`IF` not a directive expression,`{IF abc}`
C0084,Pragma syntax,`{IF defined(0)}`
C0086,`IMPLEMENTS` not all methods provided,see §4.5
C0087,`IMPLEMENTS`,see §4.5
C0089,Overriding method signature mismatch,see §4.4
```

### 11.3 C0090–C0208 (extensions, OOP, operators)

```csv
ID,Message,Example / note
C0090,`EXTENDS` allowed only on FB/INTERFACE/STRUCT,`FUNCTION_BLOCK FB EXTENDS POU VAR END_VAR`
C0091,Recursion in base FB list,`FUNCTION_BLOCK FB EXTENDS FB VAR END_VAR`
C0094,`EXTENDS` signature / count,`FUNCTION_BLOCK FB EXTENDS FB2, FB3 VAR END_VAR`
C0096,`EXTENDS` — only one base FB,
C0097,`EXTENDS`,see C0096
C0098,`FUNCTIONBLOCK` deprecated — use `FUNCTION_BLOCK`,
C0101,Function recursion,`POU() POU() ...`
C0102,Retain memory: insufficient,
C0104,Global data error,
C0114,`EXIT` outside loop,`EXIT;`
C0116,`JMP` — invalid label,`JMP 0;`
C0117,Duplicate label,`label:` twice
C0118,Label not used,`LABEL:` alone
C0119,`FB_Init` signature requires `bInitRetains` and `bInCopyCode`,
C0120,`FB_Init` signature,see C0119
C0122,`SUPER^` outside derived FB,`SUPER^.METH(...);`
C0124,Enum initializer not `ANY_INT`,`enum_member := 1.5`
C0125,Two enum components with value 0,
C0126,REFERENCE type required,`I_r : INT;`
C0130,METHOD requires parentheses,`inst.METH1;`
C0131,Dereference of non-pointer,`i^ := 1;`
C0132,Label not defined,`JMP A;` without `A:`
C0136,Ambiguous name in multiple GVLs,`j : INT := GVL1.g_i;`
C0140,`POINTER TO` validation,
C0141,`POINTER TO` validation,
C0142,Local variable name must be unique,`VAR i:INT; i:INT; END_VAR`
C0143,PROPERTY without GET accessor,
C0144,`EXTENDS` only on FB/INTERFACE/STRUCT,
C0145,INTERFACE cannot have variable declarations,`INTERFACE ITF VAR_INPUT i:INT; END_VAR`
C0149,`IMPLEMENTS`,see §4.5
"C0157, C0158, C0160",Other POU validation,
C0161,Array bound not constant,`arr1 : ARRAY[1..i] OF INT;`
C0162,Repeat count in init not constant,`arr1 : ARRAY[1..4] OF INT := [1, i(7)];`
C0168,`VAR_CONFIG` / `VAR_GLOBAL` wrong context,
C0169,`VAR_TEMP` only in PROGRAM/FB,`FUNCTION FUN VAR_TEMP END_VAR`
C0174,`RETAIN` not in FUNCTION,`FUNCTION POU_1 VAR RETAIN END_VAR`
C0175,`PERSISTENT` not in FUNCTION,
C0177,Return type only in FUNCTION/METHOD,
C0182,METHOD return type validation,
C0185,Function/FB call result access,`i := POU_1()[0].METH1();`
C0189,End of POU,
C0190,Empty statement,`IF bTest THEN ; END_IF` (allowed)
C0191,`INDEXOF` deprecated — use `ADR`,
C0195,Sign loss on conversion,`i := b;` (UINT → INT)
C0196,Sign loss on conversion,`b := i;` (INT → UINT)
C0197,Precision loss on conversion,`b := d;` (DINT → REAL)
C0198,STRING longer than declared,`str : STRING(4) := '12345';`
C0199,`IMPLEMENTS`,see §4.5
C0201,`VAR_IN_OUT` arg type mismatch,`DoSomething_1(xInOut := xBit0);` (BIT vs BOOL)
C0203,`BIT` outside STRUCT/FB,`VAR b: BIT; END_VAR`
C0204,Allowed sections for BIT,VAR/VAR_INPUT/VAR_OUTPUT — good
C0205,`ADR` operand is not a constant / variable,`pt := ADR(1);`
C0206,`BIT` not valid array base type,`ARRAY[1..2] OF BIT`
C0208,Operator not allowed on type,`r1 := r1 MOD 2;` (MOD on REAL)
```

### 11.4 C0216–C0511 (CASE, RETAIN, ABSTRACT, etc.)

```csv
ID,Message,Example / note
C0212,Section allowed only in certain POU,see §3.2
C0216,`CASE` label ranges overlap,`1..4:` and `3..5:`
C0217,`CASE` label ranges,see C0216
C0218,`CASE` label ranges,see C0216
C0219,`CASE` label ranges,see C0216
C0221,`AT` address incomplete,`xVar := %IX0;`
C0222,POINTER requires exactly one index,`pi[0,1] := 0;`
C0224,Data recursion in FB,`FB1 -> FB2 -> FB1`
C0227,`CONSTANT` init must be constant,
C0228,`CONSTANT` requires initial value,`k : INT;`
C0234,`__QueryInterface` — 1st operand,not an interface/FB
C0235,`__QueryInterface` — 2nd operand,not an interface
C0236,`VAR_EXTERNAL` — variable must exist in `VAR_GLOBAL`,
C0237,`VAR_EXTERNAL` — no init allowed,`VAR_EXTERNAL ig: INT := 2;`
C0238,`VAR_EXTERNAL` — type must match,
C0239,`__QueryInterface` / `IMPLEMENTS`,
C0240,`__QueryPointer` — 1st operand,not an interface/FB
C0241,`__QueryPointer` — 2nd operand,not a pointer
C0242,`__NEW` / `__DELETE`,multiple assignment with `__NEW`
C0243,Signature name must match object name,
C0328,FB assignment not allowed (with `no_assign`),`refAbstract1 := refAbstract2;` (ABSTRACT FB)
C0380,`UPPER_BOUND` / `LOWER_BOUND` only for `ARRAY[*]`,`UPPER_BOUND(arrtest, 0);`
C0417,`VAR_IN_OUT` requires a writable variable,see §3.1
C0420,`RETAIN` — out of memory,
C0509,`__NEW` / `__DELETE`,runtime check
C0511,ABSTRACT FB cannot be copied,`refAbstract1 := refAbstract2;` (use `REF=`)
```

---

## Final summary tables

### Master keyword index (alphabetical)

```
ABSTRACT ABS ACTION ADD AND AND_THEN ARRAY AT
BIT BOOL BY BYTE
CASE CLASS CONSTANT CONTINUE CONCAT
DATE DATE_AND_TIME DELETE DINT DO DT DWORD
ELSE ELSIF END_ACTION END_CASE END_CLASS END_FOR END_FUNCTION
END_FUNCTION_BLOCK END_IF END_IMPLEMENTS END_INTERFACE END_METHOD
END_NAMESPACE END_PROPERTY END_STRUCT END_TRANSITION END_TYPE
END_UNION END_VAR END_WHILE EN ENO EQ EXIT
EXP EXPT EXTENDS
FALSE FINAL FIND FOR FUNCTION FUNCTION_BLOCK
GE GET GT
IF IMPLEMENTS INDEXOF INITIAL_VALUE INT INTEGER INTERNAL
INTERFACE IS_VALID
LE LEN LIMIT LINT LN LOG LONG LOOP LREAL LT
LTIME LWORD
MAX METHOD MID MIN MOD MUL MUX
NAMESPACE NE NEW NOT NULL
OF OR OR_ELSE ORD OVERRIDE
POINTER PRG PRIVATE PROGRAM PROPERTY PROTECTED PUBLIC
READ_ONLY READ_WRITE REAL REF REFERENCE REPLACE REPEAT
RETAIN RETURN RIGHT ROL ROR
S S= S0 SD SL DS D SET SHL SHR SINT
STRING STRUCT SUPER
THEN THIS TIME TIME_OF_DAY TIMES TO TOD TO_ TRUE TRY TS
TYPE
UINT ULINT UNION UNTIL USINT
VALID VALUE VAR VARACCESS CONFIG EXTERNAL GLOBAL
IN_OUT INPUT INST OUTPUT TEMP STAT VENDOR-SPEC
VOID
WCHAR WHILE WORD WSTRING
XOR
```

### Quick operator reference

```csv
Operator,Precedence,Notes
`()`,1,grouping
`f()` `a[]` `p^` `r->m`,2,call / select
`EXPT`,3,power
`-` `NOT`,4,unary
`*` `/` `MOD`,5,multiplicative
`+` `-`,6,additive
`<` `>` `<=` `>=`,7,relational
`=` `<>`,8,equality
`AND` `AND_THEN`,9,bool AND (short-circuit on AND_THEN)
`XOR`,10,bool XOR
`OR` `OR_ELSE`,11,bool OR (short-circuit on OR_ELSE)
```

### Quick declaration keyword reference

```csv
Section,Scope,Lifetime
VAR,local,per-call
VAR_INPUT,local,per-call (read-only)
VAR_OUTPUT,local,per-call (returned)
VAR_IN_OUT,local,per-call (pass-by-ref)
VAR_GLOBAL,project,persistent
VAR_EXTERNAL,local→global ref,persistent
VAR_TEMP,local,per-call (re-init)
VAR_STAT,local,persistent across calls
VAR_INST,method→instance,persistent across calls
VAR_CONFIG,project,I/O mapping
VAR CONSTANT,local/global,compile-time
RETAIN,local/global,battery-backed
PERSISTENT,local/global,flash-backed
```

### End of reference

*Документ покрывает все пункты checklist (1.1-1.7, 2.1-2.9, 3.1-3.9, 4.1-4.11, 5.1-5.5, 6.1-6.12, 7.1-7.10, 8.1-8.7, 9.1-9.6, 10.1-10.3, 11.1-11.4).*
