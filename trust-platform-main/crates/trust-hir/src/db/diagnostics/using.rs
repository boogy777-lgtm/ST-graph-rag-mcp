use super::super::queries::*;
use super::super::*;

pub(in crate::db) fn check_using_directives(
    symbols: &SymbolTable,
    diagnostics: &mut DiagnosticBuilder,
) {
    for scope in symbols.scopes() {
        for using in &scope.using_directives {
            let Some(symbol_id) = symbols.resolve_qualified(&using.path) else {
                diagnostics.error(
                    DiagnosticCode::CannotResolve,
                    using.range,
                    format!(
                        "cannot resolve namespace '{}'",
                        qualified_name_string(&using.path)
                    ),
                );
                continue;
            };
            let Some(symbol) = symbols.get(symbol_id) else {
                continue;
            };
            if !matches!(symbol.kind, SymbolKind::Namespace) {
                diagnostics.error(
                    DiagnosticCode::InvalidOperation,
                    using.range,
                    format!(
                        "USING target '{}' is not a namespace",
                        qualified_name_string(&using.path)
                    ),
                );
            }
        }
    }
}
