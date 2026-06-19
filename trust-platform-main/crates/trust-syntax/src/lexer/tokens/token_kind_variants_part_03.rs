    // =========================================================================
    // KEYWORDS - OOP
    // =========================================================================
    /// `EXTENDS`
    #[token("EXTENDS", ignore(case))]
    KwExtends,

    /// `IMPLEMENTS`
    #[token("IMPLEMENTS", ignore(case))]
    KwImplements,

    /// `THIS`
    #[token("THIS", ignore(case))]
    KwThis,

    /// `SUPER`
    #[token("SUPER", ignore(case))]
    KwSuper,

    /// `NEW`
    #[token("NEW", ignore(case))]
    KwNew,

    /// `__NEW`
    #[token("__NEW", ignore(case))]
    KwNewDunder,

    /// `__DELETE`
    #[token("__DELETE", ignore(case))]
    KwDeleteDunder,

    // =========================================================================
    // KEYWORDS - Control Flow
    // =========================================================================
    /// `IF`
    #[token("IF", ignore(case))]
    KwIf,

    /// `THEN`
    #[token("THEN", ignore(case))]
    KwThen,

    /// `ELSIF`
    #[token("ELSIF", ignore(case))]
    KwElsif,

    /// `ELSE`
    #[token("ELSE", ignore(case))]
    KwElse,

    /// `END_IF`
    #[token("END_IF", ignore(case))]
    KwEndIf,

    /// `CASE`
    #[token("CASE", ignore(case))]
    KwCase,

    /// `END_CASE`
    #[token("END_CASE", ignore(case))]
    KwEndCase,

    /// `FOR`
    #[token("FOR", ignore(case))]
    KwFor,

    /// `END_FOR`
    #[token("END_FOR", ignore(case))]
    KwEndFor,

    /// `BY`
    #[token("BY", ignore(case))]
    KwBy,

    /// `DO`
    #[token("DO", ignore(case))]
    KwDo,

    /// `WHILE`
    #[token("WHILE", ignore(case))]
    KwWhile,

    /// `END_WHILE`
    #[token("END_WHILE", ignore(case))]
    KwEndWhile,

    /// `REPEAT`
    #[token("REPEAT", ignore(case))]
    KwRepeat,

    /// `UNTIL`
    #[token("UNTIL", ignore(case))]
    KwUntil,

    /// `END_REPEAT`
    #[token("END_REPEAT", ignore(case))]
    KwEndRepeat,

    /// `RETURN`
    #[token("RETURN", ignore(case))]
    KwReturn,

    /// `EXIT`
    #[token("EXIT", ignore(case))]
    KwExit,

    /// `CONTINUE`
    #[token("CONTINUE", ignore(case))]
    KwContinue,

    /// `JMP`
    #[token("JMP", ignore(case))]
    KwJmp,

