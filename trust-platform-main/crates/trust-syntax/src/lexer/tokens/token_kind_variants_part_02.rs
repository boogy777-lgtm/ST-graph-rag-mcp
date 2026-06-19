    // =========================================================================
    // KEYWORDS - Variable Declarations
    // =========================================================================
    /// `VAR`
    #[token("VAR", ignore(case))]
    KwVar,

    /// `END_VAR`
    #[token("END_VAR", ignore(case))]
    KwEndVar,

    /// `VAR_INPUT`
    #[token("VAR_INPUT", ignore(case))]
    KwVarInput,

    /// `VAR_OUTPUT`
    #[token("VAR_OUTPUT", ignore(case))]
    KwVarOutput,

    /// `VAR_IN_OUT`
    #[token("VAR_IN_OUT", ignore(case))]
    KwVarInOut,

    /// `VAR_TEMP`
    #[token("VAR_TEMP", ignore(case))]
    KwVarTemp,

    /// `VAR_GLOBAL`
    #[token("VAR_GLOBAL", ignore(case))]
    KwVarGlobal,

    /// `VAR_EXTERNAL`
    #[token("VAR_EXTERNAL", ignore(case))]
    KwVarExternal,

    /// `VAR_ACCESS`
    #[token("VAR_ACCESS", ignore(case))]
    KwVarAccess,

    /// `VAR_CONFIG`
    #[token("VAR_CONFIG", ignore(case))]
    KwVarConfig,

    /// `VAR_STAT`
    #[token("VAR_STAT", ignore(case))]
    KwVarStat,

    // =========================================================================
    // KEYWORDS - Variable Modifiers
    // =========================================================================
    /// `CONSTANT`
    #[token("CONSTANT", ignore(case))]
    KwConstant,

    /// `RETAIN`
    #[token("RETAIN", ignore(case))]
    KwRetain,

    /// `NON_RETAIN`
    #[token("NON_RETAIN", ignore(case))]
    KwNonRetain,

    /// `PERSISTENT`
    #[token("PERSISTENT", ignore(case))]
    KwPersistent,

    /// `PUBLIC`
    #[token("PUBLIC", ignore(case))]
    KwPublic,

    /// `PRIVATE`
    #[token("PRIVATE", ignore(case))]
    KwPrivate,

    /// `PROTECTED`
    #[token("PROTECTED", ignore(case))]
    KwProtected,

    /// `INTERNAL`
    #[token("INTERNAL", ignore(case))]
    KwInternal,

    /// `FINAL`
    #[token("FINAL", ignore(case))]
    KwFinal,

    /// `ABSTRACT`
    #[token("ABSTRACT", ignore(case))]
    KwAbstract,

    /// `OVERRIDE`
    #[token("OVERRIDE", ignore(case))]
    KwOverride,

    // =========================================================================
    // KEYWORDS - Type Definitions
    // =========================================================================
    /// `TYPE`
    #[token("TYPE", ignore(case))]
    KwType,

    /// `END_TYPE`
    #[token("END_TYPE", ignore(case))]
    KwEndType,

    /// `STRUCT`
    #[token("STRUCT", ignore(case))]
    KwStruct,

    /// `END_STRUCT`
    #[token("END_STRUCT", ignore(case))]
    KwEndStruct,

    /// `UNION`
    #[token("UNION", ignore(case))]
    KwUnion,

    /// `END_UNION`
    #[token("END_UNION", ignore(case))]
    KwEndUnion,

    /// `ARRAY`
    #[token("ARRAY", ignore(case))]
    KwArray,

    /// `OF`
    #[token("OF", ignore(case))]
    KwOf,

    /// `STRING`
    #[token("STRING", ignore(case))]
    KwString,

    /// `WSTRING`
    #[token("WSTRING", ignore(case))]
    KwWString,

    /// `POINTER`
    #[token("POINTER", ignore(case))]
    KwPointer,

    /// `REF`
    #[token("REF", ignore(case))]
    KwRef,

    /// `REF_TO`
    #[token("REF_TO", ignore(case))]
    KwRefTo,

    /// `TO`
    #[token("TO", ignore(case))]
    KwTo,

