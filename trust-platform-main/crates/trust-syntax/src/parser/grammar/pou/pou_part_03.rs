use crate::lexer::TokenKind;
use crate::syntax::SyntaxKind;

use crate::parser::Parser;

impl Parser<'_, '_> {
    pub(crate) fn parse_program_config_list(&mut self) {
        self.start_node(SyntaxKind::ProgramConfigList);
        self.bump(); // (

        while !self.at(TokenKind::RParen) && !self.at_end() {
            self.start_node(SyntaxKind::ProgramConfigElem);

            if self.at(TokenKind::Ident) || self.at(TokenKind::DirectAddress) {
                self.parse_access_path();
                if self.at(TokenKind::KwWith) {
                    self.bump();
                    if self.at(TokenKind::Ident) {
                        self.parse_name();
                    } else {
                        self.error("expected task name after WITH");
                    }
                } else if self.at(TokenKind::Assign) || self.at(TokenKind::Arrow) {
                    self.bump();
                    self.parse_expression();
                }
            } else if self.current().is_trivia() {
                self.bump();
            } else {
                self.error("expected program configuration element");
                self.bump();
            }

            self.finish_node();

            if self.at(TokenKind::Comma) {
                self.bump();
            } else {
                break;
            }
        }

        if self.at(TokenKind::RParen) {
            self.bump();
        } else {
            self.error("expected ')'");
        }

        self.finish_node();
    }

    pub(crate) fn parse_var_access_block(&mut self) {
        self.start_node(SyntaxKind::VarAccessBlock);
        self.bump(); // VAR_ACCESS

        while !self.at(TokenKind::KwEndVar) && !self.at_end() {
            if self.at(TokenKind::Ident) {
                self.parse_access_decl();
                if self.at(TokenKind::Semicolon) {
                    self.bump();
                } else {
                    self.error("expected ';' after VAR_ACCESS entry");
                }
            } else if self.current().is_trivia() {
                self.bump();
            } else {
                self.error("expected access declaration");
                self.bump();
            }
        }

        if self.at(TokenKind::KwEndVar) {
            self.bump();
        } else {
            self.error("expected END_VAR");
        }

        self.finish_node();
    }

    pub(crate) fn parse_access_decl(&mut self) {
        self.start_node(SyntaxKind::AccessDecl);

        if self.at(TokenKind::Ident) {
            self.parse_name();
        } else {
            self.error("expected access name");
        }

        if self.at(TokenKind::Colon) {
            self.bump();
            self.parse_access_path();
        } else {
            self.error("expected ':' after access name");
        }

        if self.at(TokenKind::Colon) {
            self.bump();
            if self.current().is_type_keyword() {
                self.parse_type_ref();
            } else if self.at(TokenKind::Ident) {
                self.start_node(SyntaxKind::TypeRef);
                if self.peek_kind_n(1) == TokenKind::Dot {
                    self.parse_qualified_name();
                } else {
                    self.parse_name();
                }
                self.finish_node();
            } else {
                self.error("expected type in access declaration");
            }
        } else {
            self.error("expected ':' before access type");
        }

        if self.at(TokenKind::KwReadWrite) || self.at(TokenKind::KwReadOnly) {
            self.bump();
        } else if self.at(TokenKind::Ident) {
            let text = self.source.current_text().to_ascii_uppercase();
            if text == "READ_WRITE" || text == "READ_ONLY" {
                self.bump();
            }
        }

        self.finish_node();
    }

    pub(crate) fn parse_access_path(&mut self) {
        self.start_node(SyntaxKind::AccessPath);

        if self.at(TokenKind::DirectAddress) {
            self.bump();
        } else if self.at(TokenKind::Ident) {
            self.parse_name();
        } else {
            self.error("expected access path");
            self.finish_node();
            return;
        }

        loop {
            if self.at(TokenKind::LBracket) {
                self.bump();
                self.parse_expression();
                while self.at(TokenKind::Comma) {
                    self.bump();
                    self.parse_expression();
                }
                if self.at(TokenKind::RBracket) {
                    self.bump();
                } else {
                    self.error("expected ]");
                }
                continue;
            }

            if self.at(TokenKind::Dot) {
                self.bump();
                if self.at(TokenKind::DirectAddress) || self.at(TokenKind::IntLiteral) {
                    self.bump();
                } else if self.at(TokenKind::Ident) {
                    self.parse_name();
                } else {
                    self.error("expected name, integer, or direct address after '.'");
                }
                continue;
            }

            break;
        }

        self.finish_node();
    }

    pub(crate) fn parse_var_config_block(&mut self) {
        self.start_node(SyntaxKind::VarConfigBlock);
        self.bump(); // VAR_CONFIG

        while !self.at(TokenKind::KwEndVar) && !self.at_end() {
            if self.at(TokenKind::Ident) || self.at(TokenKind::DirectAddress) {
                self.parse_config_init();
                if self.at(TokenKind::Semicolon) {
                    self.bump();
                } else {
                    self.error("expected ';' after VAR_CONFIG entry");
                }
            } else if self.current().is_trivia() {
                self.bump();
            } else {
                self.error("expected VAR_CONFIG entry");
                self.bump();
            }
        }

        if self.at(TokenKind::KwEndVar) {
            self.bump();
        } else {
            self.error("expected END_VAR");
        }

        self.finish_node();
    }
}
