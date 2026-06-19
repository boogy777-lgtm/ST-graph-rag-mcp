use super::*;
use logos::Logos;

fn lex(input: &str) -> Vec<(TokenKind, &str)> {
    TokenKind::lexer(input)
        .spanned()
        .map(|(tok, span)| (tok.unwrap_or(TokenKind::Error), &input[span]))
        .collect()
}

fn lex_one(input: &str) -> TokenKind {
    TokenKind::lexer(input)
        .spanned()
        .map(|(tok, _)| tok.unwrap_or(TokenKind::Error))
        .find(|k| !k.is_trivia())
        .unwrap_or(TokenKind::Error)
}

#[test]
fn test_new_keywords_lex() {
    let cases = [
        ("AND_THEN", TokenKind::KwAndThen),
        ("OR_ELSE", TokenKind::KwOrElse),
        ("__TRY", TokenKind::KwTryDunder),
        ("__CATCH", TokenKind::KwCatchDunder),
        ("__FINALLY", TokenKind::KwFinallyDunder),
        ("__ENDTRY", TokenKind::KwEndTryDunder),
        ("__QUERYINTERFACE", TokenKind::KwQueryInterfaceDunder),
        ("__QUERYPOINTER", TokenKind::KwQueryPointerDunder),
        ("__ISVALIDREF", TokenKind::KwIsValidRefDunder),
        ("__VARINFO", TokenKind::KwVarInfoDunder),
        ("__CURRENTTASK", TokenKind::KwCurrentTaskDunder),
        ("__COMPARE_AND_SWAP", TokenKind::KwCompareAndSwapDunder),
        ("__XADD", TokenKind::KwXAddDunder),
        ("TEST_AND_SET", TokenKind::KwTestAndSet),
        ("__VECTOR", TokenKind::KwVectorDunder),
        ("__UXINT", TokenKind::KwUXInt),
        ("__XWORD", TokenKind::KwXWord),
        ("CAL", TokenKind::KwCal),
        ("VAR_INST", TokenKind::KwVarInst),
    ];
    for (src, expected) in cases {
        let token = lex_one(src);
        assert_eq!(token, expected, "failed for '{src}'");
    }
}

#[test]
fn test_operators_lex() {
    assert_eq!(lex_one("S="), TokenKind::SetAssign);
    assert_eq!(lex_one("R="), TokenKind::ResetAssign);
    assert_eq!(lex_one("->"), TokenKind::ArrowDeref);
}

#[path = "tests_part_01.rs"]
mod tests_part_01;
#[path = "tests_part_02.rs"]
mod tests_part_02;
