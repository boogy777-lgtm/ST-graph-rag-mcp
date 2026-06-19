//! Token definitions for IEC 61131-3 Structured Text.
//!
//! This module defines all lexical tokens that can appear in ST source code.
//! The token kinds are designed to work with both the `logos` lexer generator
//! and the `rowan` lossless syntax tree library.

mod token_kind;
mod token_kind_impl_classification;
mod token_kind_impl_parsing;
mod token_kind_rowan;

pub use token_kind::TokenKind;

fn lex_block_comment_pascal(lex: &mut logos::Lexer<TokenKind>) -> bool {
    lex_nested_comment(lex, b"(*", b"*)")
}

fn lex_block_comment_c(lex: &mut logos::Lexer<TokenKind>) -> bool {
    lex_nested_comment(lex, b"/*", b"*/")
}

fn lex_pragma(lex: &mut logos::Lexer<TokenKind>) -> bool {
    // SAFETY: '{' and '}' are single-byte ASCII in UTF-8
    let mut depth = 1u32;
    let bytes = lex.remainder().as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    lex.bump(i + 1); // +1 for the closing '}'
                    return true;
                }
            }
            _ => {}
        }
        i += 1;
    }
    lex.bump(bytes.len());
    false // unterminated pragma
}

fn lex_nested_comment(lex: &mut logos::Lexer<TokenKind>, open: &[u8], close: &[u8]) -> bool {
    let mut depth = 1usize;
    let bytes = lex.remainder().as_bytes();
    let mut i = 0usize;

    while i + 1 < bytes.len() {
        if bytes[i] == open[0] && bytes[i + 1] == open[1] {
            depth += 1;
            i += 2;
            continue;
        }
        if bytes[i] == close[0] && bytes[i + 1] == close[1] {
            depth -= 1;
            i += 2;
            if depth == 0 {
                lex.bump(i);
                return true;
            }
            continue;
        }
        i += 1;
    }

    lex.bump(bytes.len());
    false
}

#[cfg(test)]
mod tests;
