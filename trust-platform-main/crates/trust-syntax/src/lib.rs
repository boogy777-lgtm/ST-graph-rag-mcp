//! `trust-syntax` - Lexer, parser, and concrete syntax tree for IEC 61131-3 Structured Text.
//!
//! This crate provides the low-level syntactic analysis for ST source code:
//!
//! - **Lexer**: Tokenizes source text into a stream of tokens
//! - **Parser**: Builds a concrete syntax tree (CST) from tokens
//! - **Syntax Tree**: Lossless representation of the source code
//!
//! # Design Principles
//!
//! This crate follows the design of `rust-analyzer` and uses the `rowan` library
//! for building lossless syntax trees. Key design decisions:
//!
//! - **Lossless**: All source text is preserved, including whitespace and comments
//! - **Error-tolerant**: Parsing continues after errors, producing a partial tree
//! - **Incremental**: Designed to support incremental re-parsing (future)
//!
//! # Example
//!
//! ```
//! use trust_syntax::lexer::{lex, TokenKind};
//!
//! let source = "x := 42;";
//! let tokens = lex(source);
//!
//! // Filter out whitespace to see the meaningful tokens
//! let meaningful: Vec<_> = tokens.iter()
//!     .filter(|t| !t.kind.is_trivia())
//!     .collect();
//!
//! assert_eq!(meaningful[0].kind, TokenKind::Ident);
//! assert_eq!(meaningful[1].kind, TokenKind::Assign);
//! assert_eq!(meaningful[2].kind, TokenKind::IntLiteral);
//! ```

#![forbid(unsafe_code)]
#![warn(missing_docs)]
#![allow(clippy::module_name_repetitions)]

pub mod lexer;
pub mod parser;
pub mod syntax;
mod token_kinds;

pub use lexer::{lex, Lexer, Token, TokenKind};
pub use syntax::{StLanguage, SyntaxKind, SyntaxNode, SyntaxToken};
