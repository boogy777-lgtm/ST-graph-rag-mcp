use crate::lexer::TokenKind;
use crate::syntax::SyntaxKind;

use crate::parser::Parser;

impl Parser<'_, '_> {
    pub(crate) fn parse_configuration(&mut self) {
        self.start_node(SyntaxKind::Configuration);
        self.bump(); // CONFIGURATION

        if self.at(TokenKind::Ident) {
            self.parse_name();
        } else {
            self.error("expected configuration name");
        }

        while !self.at(TokenKind::KwEndConfiguration) && !self.at_end() {
            if self.at(TokenKind::KwVarAccess) {
                self.parse_var_access_block();
            } else if self.at(TokenKind::KwVarConfig) {
                self.parse_var_config_block();
            } else if self.current().is_var_keyword() {
                self.parse_var_block();
            } else if self.at(TokenKind::KwResource) {
                self.parse_resource();
            } else if self.at(TokenKind::KwTask) {
                self.parse_task_config();
            } else if self.at(TokenKind::KwProgram) {
                self.parse_program_config();
            } else if self.current().is_trivia() {
                self.bump();
            } else {
                self.error("expected RESOURCE, TASK, PROGRAM, or VAR block");
                self.bump();
            }
        }

        if self.at(TokenKind::KwEndConfiguration) {
            self.bump();
        } else {
            self.error("expected END_CONFIGURATION");
        }

        self.finish_node();
    }

    /// Parse a RESOURCE declaration.
    pub(crate) fn parse_resource(&mut self) {
        self.start_node(SyntaxKind::Resource);
        self.bump(); // RESOURCE

        if self.at(TokenKind::Ident) {
            self.parse_name();
        } else {
            self.error("expected resource name");
        }

        if self.at(TokenKind::KwOn) {
            self.bump();
            if self.at(TokenKind::Ident) {
                self.parse_qualified_name();
            } else {
                self.error("expected resource type name after ON");
            }
        }

        while !self.at(TokenKind::KwEndResource) && !self.at_end() {
            if self.at(TokenKind::KwVarAccess) {
                self.parse_var_access_block();
            } else if self.current().is_var_keyword() {
                self.parse_var_block();
            } else if self.at(TokenKind::KwTask) {
                self.parse_task_config();
            } else if self.at(TokenKind::KwProgram) {
                self.parse_program_config();
            } else if self.current().is_trivia() {
                self.bump();
            } else {
                self.error("expected TASK, PROGRAM, or VAR block in RESOURCE");
                self.bump();
            }
        }

        if self.at(TokenKind::KwEndResource) {
            self.bump();
        } else {
            self.error("expected END_RESOURCE");
        }

        self.finish_node();
    }

    /// Parse a TASK configuration.
    pub(crate) fn parse_task_config(&mut self) {
        self.start_node(SyntaxKind::TaskConfig);
        self.bump(); // TASK

        if self.at(TokenKind::Ident) {
            self.parse_name();
        } else {
            self.error("expected task name");
        }

        if self.at(TokenKind::LParen) {
            self.start_node(SyntaxKind::TaskInit);
            self.bump();
            while !self.at(TokenKind::RParen) && !self.at_end() {
                if self.at(TokenKind::Ident) {
                    self.parse_name();
                    if self.at(TokenKind::Assign) {
                        self.bump();
                        self.parse_expression();
                    }
                } else if self.at(TokenKind::Comma) {
                    self.bump();
                    continue;
                } else if self.current().is_trivia() {
                    self.bump();
                } else {
                    self.error("expected task init element");
                    self.bump();
                }
            }
            if self.at(TokenKind::RParen) {
                self.bump();
            } else {
                self.error("expected ')'");
            }
            self.finish_node();
        }

        if self.at(TokenKind::Semicolon) {
            self.bump();
        }

        self.finish_node();
    }

    /// Parse a PROGRAM configuration.
    pub(crate) fn parse_program_config(&mut self) {
        self.start_node(SyntaxKind::ProgramConfig);
        self.bump(); // PROGRAM

        if self.at(TokenKind::KwRetain) || self.at(TokenKind::KwNonRetain) {
            self.bump();
        }

        if self.at(TokenKind::Ident) {
            self.parse_name();
        } else {
            self.error("expected program name");
        }

        if self.at(TokenKind::KwWith) {
            self.bump();
            if self.at(TokenKind::Ident) {
                self.parse_name();
            } else {
                self.error("expected task name after WITH");
            }
        }

        if self.at(TokenKind::Colon) {
            self.bump();
            if self.at(TokenKind::Ident) {
                self.parse_qualified_name();
            } else if self.current().is_type_keyword() {
                self.parse_type_ref();
            } else {
                self.error("expected program type");
            }
        } else {
            self.error("expected ':' after program name");
        }

        if self.at(TokenKind::LParen) {
            self.parse_program_config_list();
        }

        if self.at(TokenKind::Semicolon) {
            self.bump();
        }

        self.finish_node();
    }
}
