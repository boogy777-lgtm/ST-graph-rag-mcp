    // =========================================================================
    // KEYWORDS - Boolean Literals
    // =========================================================================
    /// `TRUE`
    #[token("TRUE", ignore(case))]
    KwTrue,

    /// `FALSE`
    #[token("FALSE", ignore(case))]
    KwFalse,

    /// `NULL`
    #[token("NULL", ignore(case))]
    KwNull,

    // =========================================================================
    // KEYWORDS - Configuration
    // =========================================================================
    /// `CONFIGURATION`
    #[token("CONFIGURATION", ignore(case))]
    KwConfiguration,

    /// `END_CONFIGURATION`
    #[token("END_CONFIGURATION", ignore(case))]
    KwEndConfiguration,

    /// `RESOURCE`
    #[token("RESOURCE", ignore(case))]
    KwResource,

    /// `END_RESOURCE`
    #[token("END_RESOURCE", ignore(case))]
    KwEndResource,

    /// `ON`
    #[token("ON", ignore(case))]
    KwOn,

    /// `READ_WRITE`
    #[token("READ_WRITE", ignore(case))]
    KwReadWrite,

    /// `READ_ONLY`
    #[token("READ_ONLY", ignore(case))]
    KwReadOnly,

    // =========================================================================
    // KEYWORDS - Task Configuration
    // =========================================================================
    /// `TASK`
    #[token("TASK", ignore(case))]
    KwTask,

    /// `WITH`
    #[token("WITH", ignore(case))]
    KwWith,

    /// `AT`
    #[token("AT", ignore(case))]
    KwAt,

    // =========================================================================
    // KEYWORDS - Special
    // =========================================================================
    /// `EN`
    #[token("EN", ignore(case))]
    KwEn,

    /// `ENO`
    #[token("ENO", ignore(case))]
    KwEno,

    /// `R_EDGE`
    #[token("R_EDGE", ignore(case))]
    KwREdge,

    /// `F_EDGE`
    #[token("F_EDGE", ignore(case))]
    KwFEdge,

