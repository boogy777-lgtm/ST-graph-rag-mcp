use super::super::super::queries::*;
use super::super::super::*;

pub(super) fn check_member_shadowing(
    symbols: &SymbolTable,
    declared_vars: &[SymbolId],
    declared_methods: &[SymbolId],
    inherited_vars: &FxHashMap<SmolStr, SymbolId>,
    diagnostics: &mut DiagnosticBuilder,
) {
    for var_id in declared_vars.iter().copied() {
        let Some(var_sym) = symbols.get(var_id) else {
            continue;
        };
        let key = normalize_member_name(var_sym.name.as_str());
        if let Some(base_var_id) = inherited_vars.get(&key) {
            let base_var = symbols.get(*base_var_id);
            let base_name = base_var
                .as_ref()
                .map(|sym| sym.name.as_str())
                .unwrap_or("base member");
            diagnostics.error(
                DiagnosticCode::InvalidOperation,
                var_sym.range,
                format!(
                    "member '{}' conflicts with inherited variable '{}'",
                    var_sym.name, base_name
                ),
            );
        }
    }

    for method_id in declared_methods.iter().copied() {
        let Some(method_sym) = symbols.get(method_id) else {
            continue;
        };
        let key = normalize_member_name(method_sym.name.as_str());
        if inherited_vars.contains_key(&key) {
            diagnostics.error(
                DiagnosticCode::InvalidOperation,
                method_sym.range,
                format!(
                    "method '{}' conflicts with inherited variable",
                    method_sym.name
                ),
            );
        }
    }
}
