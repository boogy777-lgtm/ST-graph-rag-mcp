impl<'a, 'b> StmtChecker<'a, 'b> {
    // ========== Statement Checking ==========

    /// Checks a statement for type errors.
    pub fn check_statement(&mut self, node: &SyntaxNode) {
        match node.kind() {
            SyntaxKind::AssignStmt => self.check_assignment(node),
            SyntaxKind::IfStmt => self.check_if_stmt(node),
            SyntaxKind::ForStmt => self.check_for_stmt(node),
            SyntaxKind::WhileStmt => self.check_while_stmt(node),
            SyntaxKind::RepeatStmt => self.check_repeat_stmt(node),
            SyntaxKind::CaseStmt => self.check_case_stmt(node),
            SyntaxKind::ReturnStmt => self.check_return_stmt(node),
            SyntaxKind::ExprStmt => self.check_expr_stmt(node),
            SyntaxKind::ExitStmt => self.check_exit_stmt(node),
            SyntaxKind::ContinueStmt => self.check_continue_stmt(node),
            SyntaxKind::JmpStmt => self.check_jmp_stmt(node),
            SyntaxKind::LabelStmt => self.check_label_stmt(node),
            SyntaxKind::StmtList => {
                for child in node.children() {
                    self.check_statement(&child);
                }
            }
            SyntaxKind::SetResetStmt => self.check_set_reset_stmt(node),
            SyntaxKind::TryStmt => self.check_try_stmt(node),
            SyntaxKind::CalStmt => self.check_cal_stmt(node),
            _ => {}
        }
    }


    fn check_expression(&mut self, node: &SyntaxNode) -> TypeId {
        self.checker.expr().check_expression(node)
    }


    fn check_assignment(&mut self, node: &SyntaxNode) {
        let children: Vec<_> = node.children().collect();
        if children.len() < 2 {
            return;
        }

        let target = &children[0];
        let value = &children[1];
        let is_ref_assign = assignment_is_ref(node);

        // Check target is a valid l-value
        if !self.checker.is_valid_lvalue(target) {
            self.checker.diagnostics.error(
                DiagnosticCode::InvalidAssignmentTarget,
                target.text_range(),
                "invalid assignment target",
            );
            return;
        }

        let resolved_target = self.checker.assignment_target_symbol(target);
        if let Some(resolved) = &resolved_target {
            if !resolved.accessible {
                return;
            }
        }

        // Check target is not a constant
        if self
            .checker
            .is_constant_target_with_resolved(target, resolved_target.as_ref())
        {
            self.checker.diagnostics.error(
                DiagnosticCode::ConstantModification,
                target.text_range(),
                "cannot assign to constant",
            );
            return;
        }

        if !self
            .checker
            .check_assignable_target_symbol(target, resolved_target.as_ref())
        {
            return;
        }

        if let Some(resolved) = &resolved_target {
            self.check_loop_restriction(resolved.id, target.text_range());
        }

        if self.checker.is_return_target(target) {
            self.checker.saw_return_value = true;
            self.checker.return_value_definitely_assigned = true;
        }

        if is_ref_assign {
            self.check_ref_assignment(target, value);
            return;
        }

        // Check type compatibility
        let target_type = self
            .checker
            .type_of_assignment_target(target, resolved_target.as_ref());
        let value_type = self.check_expression(value);

        let is_context_int = self.checker.is_contextual_int_literal(target_type, value);
        let is_context_real = self.checker.is_contextual_real_literal(target_type, value);
        if self.checker.is_assignable(target_type, value_type) || is_context_int || is_context_real
        {
            let checked_type = if is_context_int || is_context_real {
                target_type
            } else {
                value_type
            };
            self.check_subrange_assignment(target_type, value, checked_type);
            self.checker
                .check_string_literal_assignment(target_type, value, checked_type);
            if !is_context_int && !is_context_real {
                self.checker
                    .warn_implicit_conversion(target_type, value_type, node.text_range());
            }
        } else {
            let target_name = self.checker.type_name(target_type);
            let value_name = self.checker.type_name(value_type);
            self.checker.diagnostics.error(
                DiagnosticCode::IncompatibleAssignment,
                node.text_range(),
                format!("cannot assign '{}' to '{}'", value_name, target_name),
            );
        }
    }


    fn check_if_stmt(&mut self, node: &SyntaxNode) {
        let incoming = self.checker.return_value_definitely_assigned;
        let mut branch_states = vec![self.check_statement_children_with_state(node, incoming)];

        // Check condition is boolean
        if let Some(expr) = first_expression_child(node) {
            let cond_type = self.check_expression(&expr);
            self.checker
                .expr()
                .check_boolean(cond_type, expr.text_range());
        }

        // Check nested statements
        for child in node.children() {
            match child.kind() {
                SyntaxKind::ElsifBranch | SyntaxKind::ElseBranch => {
                    if child.kind() == SyntaxKind::ElsifBranch {
                        if let Some(expr) = first_expression_child(&child) {
                            let cond_type = self.check_expression(&expr);
                            self.checker
                                .expr()
                                .check_boolean(cond_type, expr.text_range());
                        }
                    }
                    branch_states.push(self.check_statement_children_with_state(&child, incoming));
                }
                _ if is_statement_kind(child.kind()) => {}
                _ => {}
            }
        }

        let has_else = node
            .children()
            .any(|child| child.kind() == SyntaxKind::ElseBranch);
        if !has_else {
            branch_states.push(incoming);
        }
        self.checker.return_value_definitely_assigned =
            branch_states.into_iter().all(std::convert::identity);
    }

    /// Checks a Set/Reset statement (`x S= expr;` / `x R= expr;`).
    ///
    /// Per IEC 61131-3, SET and RESET operate only on BOOL operands.
    /// Both the target and the value must be BOOL.
    fn check_set_reset_stmt(&mut self, node: &SyntaxNode) {
        let children: Vec<_> = node.children().collect();
        if children.len() < 2 {
            return;
        }

        let target = &children[0];
        let value = &children[1];

        // Check target is a valid l-value
        if !self.checker.is_valid_lvalue(target) {
            self.checker.diagnostics.error(
                DiagnosticCode::InvalidAssignmentTarget,
                target.text_range(),
                "invalid assignment target for SET/RESET",
            );
            return;
        }

        // Check target is not a constant
        if self.checker.is_constant_target(target) {
            self.checker.diagnostics.error(
                DiagnosticCode::ConstantModification,
                target.text_range(),
                "cannot SET/RESET a constant",
            );
            return;
        }

        // Validate types: both target and RHS must be BOOL
        let target_type = self.check_expression(target);
        let value_type = self.check_expression(value);

        let resolved_target = self.checker.resolve_alias_type(target_type);
        if resolved_target != TypeId::BOOL && resolved_target != TypeId::UNKNOWN {
            self.checker.diagnostics.error(
                DiagnosticCode::TypeMismatch,
                target.text_range(),
                format!(
                    "SET/RESET target must be BOOL, found '{}'",
                    self.checker.type_name(target_type)
                ),
            );
        }

        let resolved_value = self.checker.resolve_alias_type(value_type);
        if resolved_value != TypeId::BOOL && resolved_value != TypeId::UNKNOWN {
            self.checker.diagnostics.error(
                DiagnosticCode::TypeMismatch,
                value.text_range(),
                format!(
                    "SET/RESET value must be BOOL, found '{}'",
                    self.checker.type_name(value_type)
                ),
            );
        }
    }

    /// Checks a legacy CAL statement.
    ///
    /// `CAL inst(args);` is a deprecated alternative to `inst(args);`.
    /// The callee name and arguments are type-checked as a regular function call
    /// expression, and a deprecation warning is emitted.
    fn check_cal_stmt(&mut self, node: &SyntaxNode) {
        self.checker.diagnostics.warning(
            DiagnosticCode::Deprecated,
            node.text_range(),
            "CAL is deprecated; use a direct function call instead",
        );

        let children: Vec<_> = node.children().collect();
        if children.is_empty() {
            return;
        }

        let callee = &children[0];

        if callee.kind() == SyntaxKind::NameRef {
            if let Some(name) = self.checker.resolve_ref().get_name_from_ref(callee) {
                match self
                    .checker
                    .resolve()
                    .resolve_name_in_context_outcome(&name, callee.text_range())
                {
                    NameResolveOutcome::Resolved(resolved) => {
                        if resolved.accessible {
                            if let Some(call_target) = self
                                .checker
                                .resolve_ref()
                                .resolve_call_target(resolved.id)
                            {
                                self.checker
                                    .calls()
                                    .check_call_arguments(
                                        call_target.param_owner,
                                        &call_target.kind,
                                        node,
                                    );
                            } else {
                                self.checker.diagnostics.error(
                                    DiagnosticCode::UndefinedFunction,
                                    callee.text_range(),
                                    format!("'{}' is not callable", name),
                                );
                            }
                        }
                    }
                    NameResolveOutcome::Ambiguous => {}
                    NameResolveOutcome::NotFound => {
                        self.checker.diagnostics.error(
                            DiagnosticCode::UndefinedFunction,
                            callee.text_range(),
                            format!("undefined CALL target '{}'", name),
                        );
                    }
                }
                return;
            }
        }

        let callee_type = self.check_expression(callee);
        if callee_type != TypeId::UNKNOWN {
            if let Some(call_target) = self
                .checker
                .resolve_ref()
                .resolve_call_target_from_type(callee_type)
            {
                self.checker
                    .calls()
                    .check_call_arguments(call_target.param_owner, &call_target.kind, node);
            }
        }
    }

}
