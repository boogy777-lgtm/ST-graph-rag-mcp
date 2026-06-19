    // =========================================================================
    // KEYWORDS - References and Addresses
    // =========================================================================
    /// `ADR`
    #[token("ADR", ignore(case))]
    KwAdr,

    /// `SIZEOF`
    #[token("SIZEOF", ignore(case))]
    KwSizeOf,

    // =========================================================================
    // KEYWORDS - Property Accessors
    // =========================================================================
    /// `GET`
    #[token("GET", ignore(case))]
    KwGet,

    /// `END_GET`  
    #[token("END_GET", ignore(case))]
    KwEndGet,

    /// `SET`
    #[token("SET", ignore(case))]
    KwSet,

    /// `END_SET`
    #[token("END_SET", ignore(case))]
    KwEndSet,

    // =========================================================================
    // LITERALS
    // =========================================================================
    /// Integer literal: 123, 16#FF, 2#1010, 8#77
    /// Supports underscores: 1_000_000
    #[regex(r"[0-9]([0-9]|_[0-9])*")]
    #[regex(r"16#[0-9A-Fa-f]([0-9A-Fa-f]|_[0-9A-Fa-f])*")]
    #[regex(r"2#[01]([01]|_[01])*")]
    #[regex(r"8#[0-7]([0-7]|_[0-7])*")]
    IntLiteral,

    /// Real literal: 3.14, 1.0E10, 2.5e-3
    #[regex(r"[0-9]([0-9]|_[0-9])*\.[0-9]([0-9]|_[0-9])*([eE][+-]?[0-9]([0-9]|_[0-9])*)?")]
    RealLiteral,

    /// Time literal: T#1h30m, TIME#-5s, LT#14.7s, LTIME#5m_30s_500ms_100.1us
    #[regex(
        r"(?:T|TIME|LT|LTIME)#[+-]?(?:[0-9]+(?:\.[0-9]+)?(?:ms|us|ns|d|h|m|s))(?:_?(?:[0-9]+(?:\.[0-9]+)?(?:ms|us|ns|d|h|m|s)))*",
        ignore(case)
    )]
    TimeLiteral,

    /// Date literal: D#2024-01-15, DATE#2024-01-15, LDATE#2012-02-29, LD#1984-06-25
    #[regex(r"(?:DATE|D|LDATE|LD)#[0-9]{4}-[0-9]{2}-[0-9]{2}", ignore(case))]
    DateLiteral,

    /// Time of day literal: TOD#14:30:00, LTOD#15:36:55.360_227_400
    #[regex(r"TOD#[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9][0-9_]*)?", ignore(case))]
    #[regex(
        r"TIME_OF_DAY#[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9][0-9_]*)?",
        ignore(case)
    )]
    #[regex(r"LTOD#[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9][0-9_]*)?", ignore(case))]
    #[regex(
        r"LTIME_OF_DAY#[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9][0-9_]*)?",
        ignore(case)
    )]
    TimeOfDayLiteral,

    /// Date and time literal: DT#2024-01-15-14:30:00, LDT#1984-06-25-15:36:55.360_227_400
    #[regex(
        r"DT#[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9][0-9_]*)?",
        ignore(case)
    )]
    #[regex(
        r"DATE_AND_TIME#[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9][0-9_]*)?",
        ignore(case)
    )]
    #[regex(
        r"LDT#[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9][0-9_]*)?",
        ignore(case)
    )]
    #[regex(
        r"LDATE_AND_TIME#[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9][0-9_]*)?",
        ignore(case)
    )]
    DateAndTimeLiteral,

    /// Single-quoted string: 'hello$Nworld'
    #[regex(
        r"'([^$'\r\n]|\$\$|\$[LlNnPpRrTt]|\$'|\$[0-9A-Fa-f]{2})*'",
        priority = 2
    )]
    StringLiteral,

    /// Wide string: "hello$Nworld"
    #[regex(
        r#""([^$"\r\n]|\$\$|\$[LlNnPpRrTt]|\$"|\$[0-9A-Fa-f]{4})*""#,
        priority = 2
    )]
    WideStringLiteral,

    /// Typed literal prefix: INT#, REAL#, BOOL#, etc.
    /// This captures the type prefix, followed by #
    #[regex(r"[A-Za-z_][A-Za-z0-9_]*#")]
    TypedLiteralPrefix,

    // =========================================================================
    // DIRECT ADDRESSES (Hardware I/O)
    // =========================================================================
    /// Direct address: %IX0.0, %QW10, %MD100
    /// Format: `%[I|Q|M][X|B|W|D|L]<address>`
    #[regex(r"%[IQM]\*")]
    #[regex(r"%[IQM][XBWDL]?[0-9]+(\.[0-9]+)*")]
    #[regex(r"%[XBWDL][0-9]+")]
    DirectAddress,

    // =========================================================================
    // IDENTIFIERS
    // =========================================================================
    /// Identifier: starts with letter or underscore, contains letters, digits, underscores
    #[regex(r"[A-Za-z_][A-Za-z0-9_]*")]
    Ident,

    // =========================================================================
    // SPECIAL TOKENS
    // =========================================================================
    /// Lexer error - unrecognized character
    #[regex(r"'[^'\r\n]*'", priority = 1)]
    #[regex(r#""[^"\r\n]*""#, priority = 1)]
    #[default]
    Error,

    /// End of file marker (not produced by lexer, added by parser)
    Eof,
