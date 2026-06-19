    // =========================================================================
    // KEYWORDS - SFC Elements
    // =========================================================================
    /// `STEP`
    #[token("STEP", ignore(case))]
    KwStep,

    /// `END_STEP`
    #[token("END_STEP", ignore(case))]
    KwEndStep,

    /// `INITIAL_STEP`
    #[token("INITIAL_STEP", ignore(case))]
    KwInitialStep,

    /// `TRANSITION`
    #[token("TRANSITION", ignore(case))]
    KwTransition,

    /// `END_TRANSITION`
    #[token("END_TRANSITION", ignore(case))]
    KwEndTransition,

    /// `FROM`
    #[token("FROM", ignore(case))]
    KwFrom,

    // =========================================================================
    // KEYWORDS - Logical Operators
    // =========================================================================
    /// `AND`
    #[token("AND", ignore(case))]
    KwAnd,

    /// `OR`
    #[token("OR", ignore(case))]
    KwOr,

    /// `XOR`
    #[token("XOR", ignore(case))]
    KwXor,

    /// `NOT`
    #[token("NOT", ignore(case))]
    KwNot,

    /// `MOD`
    #[token("MOD", ignore(case))]
    KwMod,

    // =========================================================================
    // KEYWORDS - Elementary Data Types (IEC 61131-3)
    // =========================================================================
    // Boolean
    /// `BOOL`
    #[token("BOOL", ignore(case))]
    KwBool,

    // Integer types - signed
    /// `SINT` - Short Integer (8-bit signed)
    #[token("SINT", ignore(case))]
    KwSInt,

    /// `INT` - Integer (16-bit signed)
    #[token("INT", ignore(case))]
    KwInt,

    /// `DINT` - Double Integer (32-bit signed)
    #[token("DINT", ignore(case))]
    KwDInt,

    /// `LINT` - Long Integer (64-bit signed)
    #[token("LINT", ignore(case))]
    KwLInt,

    // Integer types - unsigned
    /// `USINT` - Unsigned Short Integer (8-bit)
    #[token("USINT", ignore(case))]
    KwUSInt,

    /// `UINT` - Unsigned Integer (16-bit)
    #[token("UINT", ignore(case))]
    KwUInt,

    /// `UDINT` - Unsigned Double Integer (32-bit)
    #[token("UDINT", ignore(case))]
    KwUDInt,

    /// `ULINT` - Unsigned Long Integer (64-bit)
    #[token("ULINT", ignore(case))]
    KwULInt,

    // Floating point types
    /// `REAL` - 32-bit floating point
    #[token("REAL", ignore(case))]
    KwReal,

    /// `LREAL` - 64-bit floating point
    #[token("LREAL", ignore(case))]
    KwLReal,

    // Bit string types
    /// `BYTE` - 8-bit bit string
    #[token("BYTE", ignore(case))]
    KwByte,

    /// `WORD` - 16-bit bit string
    #[token("WORD", ignore(case))]
    KwWord,

    /// `DWORD` - 32-bit bit string
    #[token("DWORD", ignore(case))]
    KwDWord,

    /// `LWORD` - 64-bit bit string
    #[token("LWORD", ignore(case))]
    KwLWord,

    // Time types
    /// `TIME`
    #[token("TIME", ignore(case))]
    KwTime,

    /// `LTIME`
    #[token("LTIME", ignore(case))]
    KwLTime,

    /// `DATE`
    #[token("DATE", ignore(case))]
    KwDate,

    /// `LDATE`
    #[token("LDATE", ignore(case))]
    KwLDate,

    /// `TIME_OF_DAY` / `TOD`
    #[token("TIME_OF_DAY", ignore(case))]
    #[token("TOD", ignore(case))]
    KwTimeOfDay,

    /// `LTIME_OF_DAY` / `LTOD`
    #[token("LTIME_OF_DAY", ignore(case))]
    #[token("LTOD", ignore(case))]
    KwLTimeOfDay,

    /// `DATE_AND_TIME` / `DT`
    #[token("DATE_AND_TIME", ignore(case))]
    #[token("DT", ignore(case))]
    KwDateAndTime,

    /// `LDATE_AND_TIME` / `LDT`
    #[token("LDATE_AND_TIME", ignore(case))]
    #[token("LDT", ignore(case))]
    KwLDateAndTime,

    /// `CHAR`
    #[token("CHAR", ignore(case))]
    KwChar,

    /// `WCHAR`
    #[token("WCHAR", ignore(case))]
    KwWChar,

    // Other special types
    /// `ANY`
    #[token("ANY", ignore(case))]
    KwAny,

    /// `ANY_DERIVED`
    #[token("ANY_DERIVED", ignore(case))]
    KwAnyDerived,

    /// `ANY_ELEMENTARY`
    #[token("ANY_ELEMENTARY", ignore(case))]
    KwAnyElementary,

    /// `ANY_MAGNITUDE`
    #[token("ANY_MAGNITUDE", ignore(case))]
    KwAnyMagnitude,

    /// `ANY_INT`
    #[token("ANY_INT", ignore(case))]
    KwAnyInt,

    /// `ANY_UNSIGNED`
    #[token("ANY_UNSIGNED", ignore(case))]
    KwAnyUnsigned,

    /// `ANY_SIGNED`
    #[token("ANY_SIGNED", ignore(case))]
    KwAnySigned,

    /// `ANY_REAL`
    #[token("ANY_REAL", ignore(case))]
    KwAnyReal,

    /// `ANY_NUM`
    #[token("ANY_NUM", ignore(case))]
    KwAnyNum,

    /// `ANY_DURATION`
    #[token("ANY_DURATION", ignore(case))]
    KwAnyDuration,

    /// `ANY_BIT`
    #[token("ANY_BIT", ignore(case))]
    KwAnyBit,

    /// `ANY_CHARS`
    #[token("ANY_CHARS", ignore(case))]
    KwAnyChars,

    /// `ANY_STRING`
    #[token("ANY_STRING", ignore(case))]
    KwAnyString,

    /// `ANY_CHAR`
    #[token("ANY_CHAR", ignore(case))]
    KwAnyChar,

    /// `ANY_DATE`
    #[token("ANY_DATE", ignore(case))]
    KwAnyDate,

