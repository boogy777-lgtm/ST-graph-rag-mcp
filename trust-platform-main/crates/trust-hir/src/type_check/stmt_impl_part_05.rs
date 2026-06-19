impl<'a, 'b> StmtChecker<'a, 'b> {

    pub(crate) fn check_statement_list_with_labels(&mut self, node: &SyntaxNode) {
        self.checker.label_scopes.push(LabelScope {
            labels: FxHashSet::default(),
            pending_jumps: Vec::new(),
        });
        self.check_statement(node);

        if let Some(scope) = self.checker.label_scopes.pop() {
            for (label, original, range) in scope.pending_jumps {
                if !scope.labels.contains(&label) {
                    self.checker.diagnostics.error(
                        DiagnosticCode::CannotResolve,
                        range,
                        format!("unknown label '{}'", original),
                    );
                }
            }
        }
    }

}
