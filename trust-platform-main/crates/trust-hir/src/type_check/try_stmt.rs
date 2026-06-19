// Catch variable validation for `__TRY`/`__CATCH`/`__FINALLY` blocks.
//
// Per IEC 61131-3 extension semantics, catch variables provide access to
// exception information within a `__CATCH` block. The variable is registered
// in the NameResolution database with block-local scope so it is visible
// only within that catch block body.
//
// ## Validation rules
// - Catch blocks must precede any `__FINALLY` block.
// - Catch variable names must not duplicate within the same `__TRY` block.
// - Catch variable type is `__EXCEPTION` (the built-in exception type).

use rustc_hash::FxHashSet;
use smol_str::SmolStr;

use crate::symbols::{ScopeKind, Symbol, SymbolKind, VarQualifier};

impl<'a, 'b> StmtChecker<'a, 'b> {
    /// Type-checks a `__TRY`/`__CATCH`/`__FINALLY`/`__ENDTRY` statement.
    ///
    /// Validates:
    /// 1. All `__CATCH` blocks appear before any `__FINALLY` block.
    /// 2. Each catch variable is typed `__EXCEPTION` (or `ANY` if not found)
    ///    and registered in a block-local scope.
    /// 3. No duplicate catch variable names within the same `__TRY`.
    pub fn check_try_stmt(&mut self, node: &SyntaxNode) {
        let mut saw_finally = false;
        let mut catch_names: FxHashSet<SmolStr> = FxHashSet::default();

        for child in node.children() {
            match child.kind() {
                SyntaxKind::CatchBlock => {
                    if saw_finally {
                        self.checker.diagnostics.error(
                            DiagnosticCode::InvalidOperation,
                            child.text_range(),
                            "__CATCH block must precede __FINALLY",
                        );
                    }
                    self.check_catch_block(&child, &mut catch_names);
                }
                SyntaxKind::FinallyBlock => {
                    saw_finally = true;
                    self.check_statement(&child);
                }
                _ if child.kind().is_statement_node() => {
                    self.check_statement(&child);
                }
                _ => {}
            }
        }
    }

    /// Type-checks a single `__CATCH` block.
    fn check_catch_block(&mut self, node: &SyntaxNode, seen_names: &mut FxHashSet<SmolStr>) {
        self.checker.symbols.push_scope(ScopeKind::Block, None);

        // Look for a catch variable name: __CATCH (name)
        let name_node = node
            .children()
            .find(|child| child.kind() == SyntaxKind::Name);
        let catch_name = name_node
            .as_ref()
            .and_then(|name_node| self.checker.resolve_ref().get_name_from_ref(name_node));

        if let Some(name) = &catch_name {
            let key = SmolStr::new(name.to_ascii_uppercase());
            if !seen_names.insert(key) {
                self.checker.diagnostics.error(
                    DiagnosticCode::DuplicateDeclaration,
                    node.text_range(),
                    format!("duplicate catch variable '{}' in __TRY block", name),
                );
            } else {
                let range = name_node.map_or(text_size::TextRange::default(), |n| n.text_range());
                self.register_catch_variable(name, range);
            }
        }

        // Type-check the statement body within the catch block
        for child in node.children() {
            if child.kind().is_statement_node() {
                self.check_statement(&child);
            }
        }

        self.checker.symbols.pop_scope();
    }

    /// Registers a catch variable in the symbol table with block-local scope.
    ///
    /// The variable is inserted directly into the current scope (the POU
    /// body scope) so that name resolution within the catch block can find it.
    /// The type is `__EXCEPTION` if that type is registered, otherwise
    /// falls back to the generic `ANY` type.
    fn register_catch_variable(&mut self, name: &str, range: text_size::TextRange) {
        let exception_type = self
            .checker
            .symbols
            .lookup_registered_type_name("__EXCEPTION")
            .unwrap_or(TypeId::ANY);

        let symbol = Symbol::new(
            SymbolId(0), // will be replaced by add_symbol
            name,
            SymbolKind::Variable {
                qualifier: VarQualifier::Local,
            },
            exception_type,
            range,
        );

        self.checker.symbols.add_symbol(symbol);
    }
}
