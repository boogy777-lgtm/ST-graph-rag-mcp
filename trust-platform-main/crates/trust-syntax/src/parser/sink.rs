//! Sink for converting parser events into a syntax tree.
//!
//! The sink takes the flat event stream and builds a proper `rowan` green tree.

use crate::lexer::Token;
use crate::parser::event::Event;
use crate::parser::ParseError;
use crate::syntax::SyntaxKind;

/// Builds a syntax tree from parser events.
pub struct Sink<'t, 'src> {
    tokens: &'t [Token],
    source: &'src str,
    events: Vec<Event>,
    cursor: usize,
    builder: rowan::GreenNodeBuilder<'static>,
    errors: Vec<ParseError>,
}

impl<'t, 'src> Sink<'t, 'src> {
    /// Creates a new sink.
    pub fn new(tokens: &'t [Token], source: &'src str, events: Vec<Event>) -> Self {
        Self {
            tokens,
            source,
            events,
            cursor: 0,
            builder: rowan::GreenNodeBuilder::new(),
            errors: Vec::new(),
        }
    }

    /// Consumes the sink and returns the green tree and errors.
    pub fn finish(mut self) -> (rowan::GreenNode, Vec<ParseError>) {
        // Process events
        for i in 0..self.events.len() {
            match std::mem::replace(&mut self.events[i], Event::Placeholder) {
                Event::Start {
                    kind,
                    forward_parent,
                } => {
                    // Handle forward parent chain
                    let mut kinds = vec![kind];
                    let mut idx = i;
                    let mut fp = forward_parent;

                    while let Some(fp_idx) = fp {
                        idx += fp_idx as usize;
                        if let Event::Start {
                            kind,
                            forward_parent,
                        } = std::mem::replace(&mut self.events[idx], Event::Placeholder)
                        {
                            kinds.push(kind);
                            fp = forward_parent;
                        } else {
                            break;
                        }
                    }

                    for kind in kinds.into_iter().rev() {
                        self.builder.start_node(rowan::SyntaxKind(kind as u16));
                    }
                }
                Event::Token { kind, n_tokens } => {
                    self.eat_trivia();
                    for _ in 0..n_tokens {
                        self.token(kind);
                    }
                }
                Event::Finish => {
                    self.eat_trivia();
                    self.builder.finish_node();
                }
                Event::Placeholder => {}
            }
        }

        (self.builder.finish(), self.errors)
    }

    /// Adds trivia (whitespace, comments) to the tree.
    fn eat_trivia(&mut self) {
        while let Some(token) = self.tokens.get(self.cursor) {
            if !token.kind.is_trivia() {
                break;
            }
            self.token(SyntaxKind::from(token.kind));
        }
    }

    /// Adds a token to the tree.
    fn token(&mut self, kind: SyntaxKind) {
        if let Some(token) = self.tokens.get(self.cursor) {
            let text =
                &self.source[usize::from(token.range.start())..usize::from(token.range.end())];
            self.builder.token(rowan::SyntaxKind(kind as u16), text);
            self.cursor += 1;
        }
    }

    /// Adds an error.
    // Unused in current parser flow; kept for future diagnostics.
    #[allow(dead_code)]
    pub fn error(&mut self, error: ParseError) {
        self.errors.push(error);
    }
}
