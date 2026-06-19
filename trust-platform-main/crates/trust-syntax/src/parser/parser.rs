//! Main parser implementation.

use crate::lexer::{lex, Token, TokenKind};
use crate::parser::event::Event;
use crate::parser::sink::Sink;
use crate::parser::source::Source;
use crate::parser::{Parse, ParseError};
use crate::syntax::SyntaxKind;
use drop_bomb::DropBomb;

/// Parses source text into a syntax tree.
#[must_use]
pub fn parse(source: &str) -> Parse {
    let tokens = lex(source);
    let parser = Parser::new(&tokens, source);
    let (events, errors) = parser.parse();

    let sink = Sink::new(&tokens, source, events);
    let (green_node, mut sink_errors) = sink.finish();

    let mut all_errors = errors;
    all_errors.append(&mut sink_errors);

    Parse {
        green_node,
        errors: all_errors,
    }
}

/// The parser state.
pub(crate) struct Parser<'t, 'src> {
    pub(crate) source: Source<'t, 'src>,
    pub(crate) events: Vec<Event>,
    errors: Vec<ParseError>,
    pub(crate) expr_depth: usize,
    pub(crate) try_depth: u32,
}

pub(crate) struct Marker {
    pos: usize,
    bomb: DropBomb,
}

impl Marker {
    pub(crate) fn complete(
        mut self,
        parser: &mut Parser<'_, '_>,
        kind: SyntaxKind,
    ) -> CompletedMarker {
        self.bomb.defuse();
        match parser.events.get_mut(self.pos) {
            Some(Event::Placeholder) => {
                parser.events[self.pos] = Event::Start {
                    kind,
                    forward_parent: None,
                };
            }
            Some(Event::Start {
                kind: existing_kind,
                ..
            }) => {
                *existing_kind = kind;
            }
            _ => {}
        }
        parser.events.push(Event::Finish);
        CompletedMarker { pos: self.pos }
    }
}

#[derive(Clone, Copy)]
pub(crate) struct CompletedMarker {
    pub(crate) pos: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BoundedTopLevelScan {
    Found(TokenKind),
    Closed(TokenKind),
    Boundary(TokenKind),
    Limit,
}

impl CompletedMarker {
    pub(crate) fn precede(self, parser: &mut Parser<'_, '_>) -> Marker {
        let new_pos = parser.events.len();
        parser.events.push(Event::Placeholder);
        set_forward_parent(&mut parser.events, self.pos, new_pos);
        Marker {
            pos: new_pos,
            bomb: DropBomb::new("uncompleted marker"),
        }
    }
}

fn set_forward_parent(events: &mut [Event], from: usize, to: usize) {
    let mut current = from;
    loop {
        match &mut events[current] {
            Event::Start {
                forward_parent: Some(fp),
                ..
            } => {
                current += *fp as usize;
            }
            Event::Start { forward_parent, .. } => {
                *forward_parent = Some((to - current) as u32);
                break;
            }
            _ => break,
        }
    }
}

impl<'t, 'src> Parser<'t, 'src> {
    fn new(tokens: &'t [Token], source: &'src str) -> Self {
        Self {
            source: Source::new(tokens, source),
            events: Vec::new(),
            errors: Vec::new(),
            expr_depth: 0,
            try_depth: 0,
        }
    }

    fn parse(mut self) -> (Vec<Event>, Vec<ParseError>) {
        // Start the root node
        self.start_node(SyntaxKind::SourceFile);

        // Parse top-level items
        while !self.at_end() {
            if self.at(TokenKind::KwUsing) {
                self.parse_using_directive();
            } else if self.at(TokenKind::KwVarGlobal) {
                self.parse_var_block();
            } else if self.at(TokenKind::KwProgram) || self.at(TokenKind::KwTestProgram) {
                self.parse_program();
            } else if self.at(TokenKind::KwFunction) {
                self.parse_function();
            } else if self.at(TokenKind::KwFunctionBlock) || self.at(TokenKind::KwTestFunctionBlock)
            {
                self.parse_function_block();
            } else if self.at(TokenKind::KwClass) {
                self.parse_class();
            } else if self.at(TokenKind::KwConfiguration) {
                self.parse_configuration();
            } else if self.at(TokenKind::KwInterface) {
                self.parse_interface();
            } else if self.at(TokenKind::KwType) {
                self.parse_type_decl();
            } else if self.at(TokenKind::KwNamespace) {
                self.parse_namespace();
            } else if self.at(TokenKind::Pragma) {
                self.parse_pragma();
            } else if self.current().is_trivia() {
                self.bump();
            } else {
                // Error recovery: skip unknown token
                self.error(
                    "expected VAR_GLOBAL, PROGRAM, TEST_PROGRAM, FUNCTION, FUNCTION_BLOCK, TEST_FUNCTION_BLOCK, CLASS, CONFIGURATION, INTERFACE, TYPE, or NAMESPACE",
                );
                self.bump();
            }
        }

        self.finish_node();

        (self.events, self.errors)
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    pub(crate) fn current(&self) -> TokenKind {
        self.source.current()
    }

    pub(crate) fn at(&self, kind: TokenKind) -> bool {
        self.source.peek_kind() == kind
    }

    pub(crate) fn at_end(&self) -> bool {
        self.source.at_end()
    }

    pub(crate) fn peek_kind_n(&self, n: usize) -> TokenKind {
        self.source.peek_kind_n(n)
    }

    pub(crate) fn scan_top_level_ahead(
        &self,
        start_offset: usize,
        targets: &[TokenKind],
        close_tokens: &[TokenKind],
        boundaries: &[TokenKind],
        max_lookahead: usize,
    ) -> BoundedTopLevelScan {
        let mut paren_depth = 0usize;
        let mut bracket_depth = 0usize;

        for offset in start_offset..=max_lookahead {
            let kind = self.peek_kind_n(offset);
            if kind == TokenKind::Eof {
                return BoundedTopLevelScan::Boundary(kind);
            }
            if boundaries.contains(&kind) {
                return BoundedTopLevelScan::Boundary(kind);
            }
            if paren_depth == 0 && bracket_depth == 0 {
                if targets.contains(&kind) {
                    return BoundedTopLevelScan::Found(kind);
                }
                if close_tokens.contains(&kind) {
                    return BoundedTopLevelScan::Closed(kind);
                }
            }
            match kind {
                TokenKind::LParen => paren_depth += 1,
                TokenKind::LBracket => bracket_depth += 1,
                TokenKind::RParen => paren_depth = paren_depth.saturating_sub(1),
                TokenKind::RBracket => bracket_depth = bracket_depth.saturating_sub(1),
                _ => {}
            }
        }

        BoundedTopLevelScan::Limit
    }

    pub(crate) fn recover_top_level_until(
        &mut self,
        close_tokens: &[TokenKind],
        boundaries: &[TokenKind],
        max_tokens: usize,
        consume_close: bool,
    ) -> BoundedTopLevelScan {
        let mut paren_depth = 0usize;
        let mut bracket_depth = 0usize;

        for _ in 0..max_tokens {
            let kind = self.current();
            if kind == TokenKind::Eof {
                return BoundedTopLevelScan::Boundary(kind);
            }
            if boundaries.contains(&kind) {
                return BoundedTopLevelScan::Boundary(kind);
            }
            if paren_depth == 0 && bracket_depth == 0 && close_tokens.contains(&kind) {
                if consume_close {
                    self.bump();
                }
                return BoundedTopLevelScan::Closed(kind);
            }
            match kind {
                TokenKind::LParen => paren_depth += 1,
                TokenKind::LBracket => bracket_depth += 1,
                TokenKind::RParen => paren_depth = paren_depth.saturating_sub(1),
                TokenKind::RBracket => bracket_depth = bracket_depth.saturating_sub(1),
                _ => {}
            }
            self.bump();
        }

        BoundedTopLevelScan::Limit
    }

    pub(crate) fn bump(&mut self) {
        let kind = self.source.current();
        self.events.push(Event::token(SyntaxKind::from(kind)));
        self.source.bump();
    }

    pub(crate) fn start(&mut self) -> Marker {
        let pos = self.events.len();
        self.events.push(Event::Placeholder);
        Marker {
            pos,
            bomb: DropBomb::new("uncompleted marker"),
        }
    }

    pub(crate) fn start_node(&mut self, kind: SyntaxKind) {
        self.events.push(Event::start(kind));
    }

    pub(crate) fn finish_node(&mut self) {
        self.events.push(Event::Finish);
    }

    pub(crate) fn error(&mut self, message: &str) {
        let range = self
            .source
            .current_token()
            .map(|t| t.range)
            .unwrap_or_else(|| text_size::TextRange::empty(text_size::TextSize::from(0)));

        self.errors.push(ParseError {
            message: message.to_string(),
            range,
        });
    }

    /// Skip tokens until we find a synchronization point for error recovery.
    /// This helps the parser continue after encountering an error.
    #[allow(dead_code)]
    pub(crate) fn recover_to_sync_point(&mut self) {
        while !self.at_end() {
            // Check if current token is a sync point
            if self.is_sync_point() {
                break;
            }
            self.bump();
        }
    }

    /// Returns true if the current token is a synchronization point.
    ///
    /// Sync points are token kinds that represent safe recovery boundaries:
    /// statement terminators, end-of-structure keywords, and start of new
    /// top-level constructs. These let the parser discard tokens until it
    /// finds a known anchor and resume building the syntax tree.
    ///
    /// Explicitly **excluded** from sync points:
    /// - Operators (`KwAndThen`, `KwOrElse`, `SetAssign`, `ResetAssign`) —
    ///   these appear mid-expression and recovering at them would lose context.
    /// - Mid-statement tokens (e.g. `KwElse`, `KwElsif`, `KwUntil`,
    ///   `KwDo`, `KwOf`) — these are handled separately by structure-aware
    ///   recovery inside specific grammar rules.
    ///   ▸▸▸ SYNC POINTS — keep in sync with Source::has_op_ahead STATEMENT_BOUNDARIES ◂◂◂
    pub(crate) fn is_sync_point(&self) -> bool {
        matches!(
            self.current(),
            // Statement terminators
            TokenKind::Semicolon
            // End of control flow
            | TokenKind::KwEndIf
            | TokenKind::KwEndFor
            | TokenKind::KwEndWhile
            | TokenKind::KwEndRepeat
            | TokenKind::KwEndCase
            // End of try/catch/finally
            | TokenKind::KwEndTryDunder
            | TokenKind::KwFinallyDunder
            | TokenKind::KwCatchDunder
            | TokenKind::KwTryDunder
            | TokenKind::KwCal
            // End of blocks
            | TokenKind::KwEndVar
            | TokenKind::KwEndType
            | TokenKind::KwEndStruct
            | TokenKind::KwEndUnion
            // End of POUs
            | TokenKind::KwEndProgram
            | TokenKind::KwEndTestProgram
            | TokenKind::KwEndFunction
            | TokenKind::KwEndFunctionBlock
            | TokenKind::KwEndTestFunctionBlock
            | TokenKind::KwEndClass
            | TokenKind::KwEndMethod
            | TokenKind::KwEndProperty
            | TokenKind::KwEndInterface
            | TokenKind::KwEndNamespace
            | TokenKind::KwEndConfiguration
            | TokenKind::KwEndResource
            | TokenKind::KwEndAction
            | TokenKind::KwEndGet
            | TokenKind::KwEndSet
            // Start of new constructs (recover at next item)
            | TokenKind::KwProgram
            | TokenKind::KwTestProgram
            | TokenKind::KwFunction
            | TokenKind::KwFunctionBlock
            | TokenKind::KwTestFunctionBlock
            | TokenKind::KwClass
            | TokenKind::KwMethod
            | TokenKind::KwProperty
            | TokenKind::KwInterface
            | TokenKind::KwNamespace
            | TokenKind::KwConfiguration
            | TokenKind::KwResource
            | TokenKind::KwTask
            | TokenKind::KwType
            | TokenKind::KwAction
            | TokenKind::KwVarAccess
            | TokenKind::KwVarConfig
            // Variable blocks
            | TokenKind::KwVar
            | TokenKind::KwVarInput
            | TokenKind::KwVarOutput
            | TokenKind::KwVarInOut
            | TokenKind::KwVarTemp
            | TokenKind::KwVarGlobal
            | TokenKind::KwVarExternal
            | TokenKind::KwVarInst
        )
    }

    /// Returns true when a statement list should stop for recovery.
    pub(crate) fn at_stmt_list_end(&self) -> bool {
        self.is_sync_point() && !self.current().can_start_statement()
    }

    /// Recover at statement level - skip to next statement or block end.
    pub(crate) fn recover_statement(&mut self) {
        while !self.at_end() {
            if self.at(TokenKind::Semicolon) {
                self.bump();
                break;
            }
            if self.is_sync_point() || self.current().can_start_statement() {
                break;
            }
            self.bump();
        }
    }

    /// Consume a statement terminator, or insert it when unambiguous.
    pub(crate) fn expect_semicolon(&mut self) {
        if self.at(TokenKind::Semicolon) {
            self.bump();
            return;
        }

        if self.at_semicolon_insertion_point() {
            self.error("expected ';'");
            return;
        }

        self.error("expected ';'");
        self.recover_statement();
    }

    fn at_semicolon_insertion_point(&self) -> bool {
        if self.at_end() {
            return true;
        }

        if self.is_sync_point() || self.current().can_start_statement() {
            return true;
        }

        if matches!(
            self.current(),
            TokenKind::KwElse | TokenKind::KwElsif | TokenKind::KwUntil
        ) {
            return true;
        }

        self.current().can_start_expr() && self.source.has_case_label_ahead()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty() {
        let parse = parse("");
        assert!(parse.ok());
    }

    #[test]
    fn test_parse_simple_program() {
        let source = "PROGRAM Test END_PROGRAM";
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_function_block() {
        let source = r#"
FUNCTION_BLOCK FB_Motor
VAR_INPUT
    enable : BOOL;
END_VAR
END_FUNCTION_BLOCK
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_call_statement() {
        let source = r#"
PROGRAM Test
MyFunc(1, 2);
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_typed_literal_and_deref() {
        let source = r#"
PROGRAM Test
ptr^ := INT#16#FF;
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_case_enum_labels() {
        let source = r#"
PROGRAM Test
    VAR state : INT; END_VAR
    CASE state OF
        MyEnum.Starting:
            state := 1;
        MyEnum.Running:
            state := 2;
    END_CASE
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_missing_semicolon_insertion() {
        let source = r#"
PROGRAM Test
    x := 1
    y := 2;
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(!parse.ok(), "expected errors for missing semicolon");
        assert!(
            parse
                .errors()
                .iter()
                .any(|error| error.message == "expected ';'"),
            "errors: {:?}",
            parse.errors()
        );
    }

    #[test]
    fn test_bounded_top_level_scan_ignores_commas_inside_brackets() {
        let source = "([1, 2]);";
        let tokens = lex(source);
        let parser = Parser::new(&tokens, source);

        assert_eq!(
            parser.scan_top_level_ahead(
                1,
                &[TokenKind::Comma],
                &[TokenKind::RParen],
                &[TokenKind::Semicolon],
                16,
            ),
            BoundedTopLevelScan::Closed(TokenKind::RParen)
        );
    }

    #[test]
    fn test_bounded_top_level_scan_stops_at_boundary_inside_unclosed_bracket() {
        let source = "([1, 2;";
        let tokens = lex(source);
        let parser = Parser::new(&tokens, source);

        assert_eq!(
            parser.scan_top_level_ahead(
                1,
                &[TokenKind::Comma],
                &[TokenKind::RParen],
                &[TokenKind::Semicolon],
                16,
            ),
            BoundedTopLevelScan::Boundary(TokenKind::Semicolon)
        );
    }

    #[test]
    fn test_bounded_recovery_does_not_close_on_rparen_inside_unclosed_bracket() {
        let source = "([1, 2);";
        let tokens = lex(source);
        let mut parser = Parser::new(&tokens, source);
        parser.bump(); // outer '('

        assert_eq!(
            parser
                .recover_top_level_until(&[TokenKind::RParen], &[TokenKind::Semicolon], 16, true,),
            BoundedTopLevelScan::Boundary(TokenKind::Semicolon)
        );
        assert_eq!(parser.current(), TokenKind::Semicolon);
    }

    #[test]
    fn test_bounded_recovery_closes_after_nested_paren_is_balanced() {
        let source = "((1), 2);";
        let tokens = lex(source);
        let mut parser = Parser::new(&tokens, source);
        parser.bump(); // outer '('

        assert_eq!(
            parser
                .recover_top_level_until(&[TokenKind::RParen], &[TokenKind::Semicolon], 16, true,),
            BoundedTopLevelScan::Closed(TokenKind::RParen)
        );
        assert_eq!(parser.current(), TokenKind::Semicolon);
    }

    #[test]
    fn test_bounded_recovery_closes_after_nested_bracket_is_balanced() {
        let source = "([1], 2);";
        let tokens = lex(source);
        let mut parser = Parser::new(&tokens, source);
        parser.bump(); // outer '('

        assert_eq!(
            parser
                .recover_top_level_until(&[TokenKind::RParen], &[TokenKind::Semicolon], 16, true,),
            BoundedTopLevelScan::Closed(TokenKind::RParen)
        );
        assert_eq!(parser.current(), TokenKind::Semicolon);
    }

    #[test]
    fn test_missing_end_case_recovery() {
        let source = r#"
PROGRAM Test
    CASE x OF
        0: y := 1;
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(!parse.ok(), "expected errors for missing END_CASE");
        assert!(
            parse
                .errors()
                .iter()
                .any(|error| error.message == "expected END_CASE"),
            "errors: {:?}",
            parse.errors()
        );
        assert!(
            !parse
                .errors()
                .iter()
                .any(|error| error.message == "expected END_PROGRAM"),
            "errors: {:?}",
            parse.errors()
        );
    }

    #[test]
    fn test_parse_arrow_deref() {
        let parse = parse("PROGRAM Test ref->field := 1; END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_slice_expr() {
        let parse = parse("PROGRAM Test x := arr[1..5]; END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_new_expr() {
        let parse = parse("PROGRAM Test VAR p: POINTER TO INT; END_VAR p := __NEW(INT, 10); END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_delete_expr() {
        let parse = parse("PROGRAM Test __DELETE(p); END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_chain_assign() {
        let parse = parse("PROGRAM Test a := b := c := 5; END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_and_then() {
        let parse = parse("PROGRAM Test IF a AND_THEN b THEN x := 1; END_IF; END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_try_catch() {
        let parse = parse("PROGRAM Test __TRY x := 1; __CATCH(e) y := 2; __ENDTRY END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_try_finally() {
        let parse = parse("PROGRAM Test __TRY x := 1; __FINALLY y := 0; __ENDTRY END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_set_assign() {
        let parse = parse("PROGRAM Test x S= TRUE; END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_reset_assign() {
        let parse = parse("PROGRAM Test x R= FALSE; END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_cal_stmt() {
        let parse = parse("PROGRAM Test CAL inst(p := 5); END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_or_else() {
        let parse = parse("PROGRAM Test IF a OR_ELSE b THEN x := 1; END_IF; END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_ref_assign() {
        let parse = parse("PROGRAM Test a ?= b; END_PROGRAM");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_var_in_out_const() {
        let parse = parse(
            "FUNCTION_BLOCK FB\nVAR_IN_OUT CONSTANT s : STRING; END_VAR\nEND_FUNCTION_BLOCK",
        );
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_var_inst() {
        let parse = parse(
            "FUNCTION_BLOCK FB\nVAR_INST iLast : INT := 0; END_VAR\nEND_FUNCTION_BLOCK",
        );
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_var_inst_empty() {
        let parse = parse("FUNCTION_BLOCK FB\nVAR_INST END_VAR\nEND_FUNCTION_BLOCK");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_var_access_read_only() {
        let parse = parse(
            "CONFIGURATION Cfg\nVAR_ACCESS x : plc.fb1.val1 : BOOL READ_ONLY; END_VAR\nEND_CONFIGURATION",
        );
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_var_config_path() {
        let parse = parse(
            "CONFIGURATION Cfg\nVAR_CONFIG plc.fb.x AT %IX1.0 : BOOL; END_VAR\nEND_CONFIGURATION",
        );
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_var_in_out_fallback() {
        let parse = parse(
            "FUNCTION_BLOCK FB\nVAR_IN_OUT x : INT; END_VAR\nEND_FUNCTION_BLOCK",
        );
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_attribute_pragma() {
        let parse = parse("{attribute 'qualified_only'}");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_conditional_pragma() {
        let source = r#"
PROGRAM Test
{IF defined(x)}
    x := 1;
{END_IF}
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_region_pragma() {
        let source = r#"
PROGRAM Test
{region 'init'}
    x := 0;
{endregion}
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_define_pragma() {
        let parse = parse("{define MY_BUILD 'release'}");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_message_pragma() {
        let source = r#"
PROGRAM Test
{warning 'deprecated call'}
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_pragma_no_longer_trivia() {
        // TokenKind::Pragma must return false from is_trivia() after Phase 4
        assert!(!TokenKind::Pragma.is_trivia());
    }

    #[test]
    fn test_parse_attribute_pragma_with_value() {
        let parse = parse(r#"{attribute 'symbol' := 'readwrite'}"#);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_conditional_pragma_elsif() {
        let source = r#"
PROGRAM Test
{IF defined(x)}
    a := 1;
{ELSIF defined(y)}
    a := 2;
{END_IF}
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_conditional_pragma_else() {
        let source = r#"
PROGRAM Test
{IF defined(x)}
    a := 1;
{ELSE}
    a := 0;
{END_IF}
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_conditional_pragma_nested() {
        let source = r#"
PROGRAM Test
{IF defined(x)}
    {IF defined(y)}
        a := 1;
    {END_IF}
{END_IF}
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_region_endregion() {
        let source = r#"
PROGRAM Test
{region 'init'}
    a := 1;
{endregion}
END_PROGRAM
"#;
        let parse = parse(source);
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_parse_message_info() {
        let parse = parse("{info 'compiled successfully'}");
        assert!(parse.ok(), "errors: {:?}", parse.errors());
    }

    #[test]
    fn test_unclosed_pragma_error_recovery() {
        let parse = parse("{no closing brace");
        assert!(!parse.ok());
    }

    #[test]
    fn test_recovery_after_broken_try() {
        let parse = parse("PROGRAM Test __TRY x := ; __CATCH(e) y := 1; __ENDTRY END_PROGRAM");
        assert!(!parse.ok());
    }

    #[test]
    fn test_recovery_missing_end_try() {
        let parse = parse("PROGRAM Test __TRY x := 1; END_PROGRAM");
        assert!(!parse.ok());
    }

    // ── Recovery edge-case coverage ─────────────────────────────────────────
    //
    // Covered:
    //   • Broken statement inside __TRY → catcher recovers to next __CATCH/__FINALLY.
    //   • Missing __ENDTRY → POU end-keyword acts as sync point.
    //   • Broken CAL / broken S= / broken R= → statement-level recovery via
    //     `recover_statement()` + `is_sync_point()`.
    //   • Nested __TRY with error in inner block → `try_depth` guard prevents
    //     runaway recursion; outer block catches and continues.
    //   • Semicolon insertion after missing `;` (single-statement lookahead).
    //   • Bounded paren/bracket depth prevents unterminated `(` / `[` from
    //     consuming the entire remaining token stream.
    //
    // Deferred (not covered):
    //   • Multi-level nested __TRY with errors at different depths — partially
    //     covered by `try_depth` cap; deeper pathological nesting (error in
    //     level 2 when level 1 also contains error) is deferred until the
    //     full error-recovery fuzzer validates the interaction.
    //   • CAL with broken named-argument list inside parens — currently
    //     handled by generic `recover_statement`.
    //   • S= / R= after a complex expression that itself contains errors —
    //     expression recovery is best-effort; `has_set_or_reset_ahead()`
    //     lookahead may bail early on parse errors inside the expression.
    // ────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_recovery_nested_try() {
        let parse = parse(
            "PROGRAM Test __TRY __TRY x := ; __ENDTRY __CATCH(e) y := 1; __ENDTRY END_PROGRAM",
        );
        assert!(!parse.ok());
    }

    #[test]
    fn test_recovery_broken_cal() {
        let parse = parse("PROGRAM Test CAL x END_PROGRAM");
        assert!(!parse.ok());
    }

    #[test]
    fn test_recovery_broken_set_reset() {
        let parse = parse("PROGRAM Test x S= ; END_PROGRAM");
        assert!(!parse.ok());
    }
}
