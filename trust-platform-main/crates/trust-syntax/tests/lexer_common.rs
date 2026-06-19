use trust_syntax::lexer::{lex_with_text, TokenKind};

fn non_trivia_kinds(source: &str) -> Vec<TokenKind> {
    lex_with_text(source)
        .into_iter()
        .filter(|(token, _)| !token.kind.is_trivia())
        .map(|(token, _)| token.kind)
        .collect()
}

#[test]
fn iec_6_1() {
    let source = "ProGrAm my_var1 // line\n(* outer (* inner *) outer *)\n/* alt */\nEND_PROGRAM";
    let tokens = lex_with_text(source);
    let kinds: Vec<_> = tokens.iter().map(|(token, _)| token.kind).collect();

    assert!(kinds.contains(&TokenKind::Whitespace));
    assert!(kinds.contains(&TokenKind::LineComment));
    assert_eq!(
        kinds
            .iter()
            .filter(|kind| **kind == TokenKind::BlockComment)
            .count(),
        2
    );

    let non_trivia = non_trivia_kinds(source);
    assert_eq!(
        non_trivia,
        vec![
            TokenKind::KwProgram,
            TokenKind::Ident,
            TokenKind::KwEndProgram
        ]
    );

    // DEV-013: identifiers are ASCII-only.
    let unicode_tokens = lex_with_text("å");
    assert!(unicode_tokens
        .iter()
        .any(|(token, _)| token.kind == TokenKind::Error));
}
