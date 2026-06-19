//! Parser events.
//!
//! The parser produces a flat stream of events that are later converted
//! into a syntax tree. This design allows for better error recovery and
//! potential future incremental parsing.

use crate::syntax::SyntaxKind;

/// An event produced by the parser.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    /// Start a new node.
    Start {
        /// The kind of node being started.
        kind: SyntaxKind,
        /// Forward parent - used for left recursion handling.
        forward_parent: Option<u32>,
    },
    /// Add a token to the current node.
    Token {
        /// The kind of token.
        kind: SyntaxKind,
        /// Number of tokens to consume (usually 1).
        n_tokens: u8,
    },
    /// Finish the current node.
    Finish,
    /// Placeholder event (will be replaced or removed).
    Placeholder,
}

impl Event {
    /// Creates a start event with no forward parent.
    #[must_use]
    pub fn start(kind: SyntaxKind) -> Self {
        Self::Start {
            kind,
            forward_parent: None,
        }
    }

    /// Creates a token event.
    #[must_use]
    pub fn token(kind: SyntaxKind) -> Self {
        Self::Token { kind, n_tokens: 1 }
    }
}
