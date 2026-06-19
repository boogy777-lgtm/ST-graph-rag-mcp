use trust_syntax::lexer::{lex_with_text, TokenKind};

fn non_trivia_kinds(source: &str) -> Vec<TokenKind> {
    lex_with_text(source)
        .into_iter()
        .filter(|(token, _)| !token.kind.is_trivia())
        .map(|(token, _)| token.kind)
        .collect()
}

#[test]
fn iec_table5() {
    let source = "0 1 -12 2#1111_1111 8#377 16#FF 3.14 -1.34E-12 1.0e+3 INT#-123 BOOL#TRUE";
    let kinds = non_trivia_kinds(source);

    assert!(!kinds.contains(&TokenKind::Error));
    assert!(kinds.contains(&TokenKind::IntLiteral));
    assert!(kinds.contains(&TokenKind::RealLiteral));
    assert!(kinds.contains(&TokenKind::TypedLiteralPrefix));
    assert!(kinds.contains(&TokenKind::KwTrue));
    assert!(kinds.contains(&TokenKind::Minus));

    assert!(kinds.windows(3).any(|window| window
        == [
            TokenKind::TypedLiteralPrefix,
            TokenKind::Minus,
            TokenKind::IntLiteral
        ]));
    assert!(kinds
        .windows(2)
        .any(|window| window == [TokenKind::TypedLiteralPrefix, TokenKind::KwTrue]));
}

#[test]
fn iec_tables6_7() {
    let cases = [
        ("'hello'", TokenKind::StringLiteral),
        ("'it$'s'", TokenKind::StringLiteral),
        ("'$N'", TokenKind::StringLiteral),
        ("'$0A'", TokenKind::StringLiteral),
        (r#""wide""#, TokenKind::WideStringLiteral),
        (r#""$00C4""#, TokenKind::WideStringLiteral),
        (r#""he$"llo""#, TokenKind::WideStringLiteral),
    ];

    for (source, expected) in cases {
        let kinds = non_trivia_kinds(source);
        assert_eq!(kinds, vec![expected]);
    }
}

#[test]
fn iec_tables8_9() {
    let cases = [
        ("T#1h30m", TokenKind::TimeLiteral),
        ("TIME#5s", TokenKind::TimeLiteral),
        ("LT#14.7s", TokenKind::TimeLiteral),
        ("LTIME#5m_30s_500ms_100.1us", TokenKind::TimeLiteral),
        ("D#2024-01-15", TokenKind::DateLiteral),
        ("DATE#2024-01-15", TokenKind::DateLiteral),
        ("LDATE#2012-02-29", TokenKind::DateLiteral),
        ("TOD#14:30:00", TokenKind::TimeOfDayLiteral),
        ("TIME_OF_DAY#14:30:00", TokenKind::TimeOfDayLiteral),
        ("LTOD#15:36:55.360_227_400", TokenKind::TimeOfDayLiteral),
        (
            "LTIME_OF_DAY#15:36:55.360_227_400",
            TokenKind::TimeOfDayLiteral,
        ),
        ("DT#2024-01-15-14:30:00", TokenKind::DateAndTimeLiteral),
        (
            "DATE_AND_TIME#2024-01-15-14:30:00",
            TokenKind::DateAndTimeLiteral,
        ),
        (
            "LDT#1984-06-25-15:36:55.360_227_400",
            TokenKind::DateAndTimeLiteral,
        ),
        (
            "LDATE_AND_TIME#1984-06-25-15:36:55.360_227_400",
            TokenKind::DateAndTimeLiteral,
        ),
    ];

    for (source, expected) in cases {
        let kinds = non_trivia_kinds(source);
        assert_eq!(kinds, vec![expected]);
    }
}
