use smol_str::SmolStr;

use crate::types::{Type, TypeId};

pub(super) fn normalize_const_name(name: &str) -> SmolStr {
    SmolStr::new(name.to_ascii_uppercase())
}

pub(super) fn split_qualified_name(name: &str) -> Vec<SmolStr> {
    name.split('.').map(SmolStr::new).collect()
}

pub(super) fn const_key(scope: &Option<SmolStr>, name: &str) -> (Option<SmolStr>, SmolStr) {
    let scope_key = scope
        .as_ref()
        .map(|scope_name| normalize_const_name(scope_name.as_str()));
    (scope_key, normalize_const_name(name))
}

pub(super) fn is_placeholder_alias(ty: &Type) -> bool {
    matches!(
        ty,
        Type::Alias {
            target: TypeId::UNKNOWN,
            ..
        }
    )
}
