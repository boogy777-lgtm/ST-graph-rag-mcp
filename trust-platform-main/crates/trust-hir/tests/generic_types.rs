use trust_hir::types::TypeRegistry;
use trust_hir::TypeId;

#[test]
fn any_groups() {
    let registry = TypeRegistry::new();

    assert!(registry.is_assignable(TypeId::ANY_INT, TypeId::INT));
    assert!(registry.is_assignable(TypeId::ANY_INT, TypeId::LINT));
    assert!(!registry.is_assignable(TypeId::ANY_INT, TypeId::REAL));

    assert!(registry.is_assignable(TypeId::ANY_BIT, TypeId::BOOL));
    assert!(registry.is_assignable(TypeId::ANY_BIT, TypeId::BYTE));
    assert!(!registry.is_assignable(TypeId::ANY_BIT, TypeId::STRING));

    assert!(registry.is_assignable(TypeId::ANY_STRING, TypeId::STRING));
    assert!(registry.is_assignable(TypeId::ANY_STRING, TypeId::WSTRING));
    assert!(!registry.is_assignable(TypeId::ANY_STRING, TypeId::INT));
}
