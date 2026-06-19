use super::super::super::*;

pub(super) fn check_class_modifiers(
    symbols: &SymbolTable,
    class_symbol: &Symbol,
    class_range: TextRange,
    declared_methods: &[SymbolId],
    diagnostics: &mut DiagnosticBuilder,
) {
    if class_symbol.modifiers.is_final && class_symbol.modifiers.is_abstract {
        diagnostics.error(
            DiagnosticCode::InvalidOperation,
            class_range,
            "class cannot be FINAL and ABSTRACT",
        );
    }

    let has_abstract_method = declared_methods.iter().any(|id| {
        symbols
            .get(*id)
            .map(|sym| sym.modifiers.is_abstract)
            .unwrap_or(false)
    });

    if class_symbol.modifiers.is_abstract && !has_abstract_method {
        diagnostics.error(
            DiagnosticCode::InvalidOperation,
            class_range,
            "abstract class must declare at least one abstract method",
        );
    }

    for method_id in declared_methods.iter().copied() {
        let Some(method_sym) = symbols.get(method_id) else {
            continue;
        };
        if method_sym.modifiers.is_abstract && !class_symbol.modifiers.is_abstract {
            diagnostics.error(
                DiagnosticCode::InvalidOperation,
                method_sym.range,
                "abstract method requires an ABSTRACT class",
            );
        }
        if method_sym.modifiers.is_abstract && method_sym.modifiers.is_override {
            diagnostics.error(
                DiagnosticCode::InvalidOperation,
                method_sym.range,
                "ABSTRACT cannot be combined with OVERRIDE",
            );
        }
        if method_sym.modifiers.is_abstract && method_sym.modifiers.is_final {
            diagnostics.error(
                DiagnosticCode::InvalidOperation,
                method_sym.range,
                "ABSTRACT cannot be combined with FINAL",
            );
        }
    }
}
