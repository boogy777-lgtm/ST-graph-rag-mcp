mod common;

use common::*;
use std::sync::Arc;

fn symbol_exists(symbols: &trust_hir::symbols::SymbolTable, name: &str) -> bool {
    symbols
        .iter()
        .any(|sym| sym.name.as_str().eq_ignore_ascii_case(name))
}

#[test]
fn test_salsa_invalidation_on_edit() {
    let mut db = Database::new();
    let file = FileId(0);

    // 1. Index a file with variable declarations
    db.set_source_text(
        file,
        "PROGRAM Main\nVAR\n    alpha : INT;\n    beta : BOOL;\nEND_VAR\nEND_PROGRAM\n"
            .to_string(),
    );

    // 2. Query — triggers salsa computation, caches result
    let symbols_before = db.file_symbols(file);
    assert!(
        symbol_exists(&symbols_before, "alpha"),
        "variable 'alpha' should exist before edit"
    );
    assert!(
        symbol_exists(&symbols_before, "beta"),
        "variable 'beta' should exist before edit"
    );
    assert!(
        !symbol_exists(&symbols_before, "gamma"),
        "variable 'gamma' should not exist before edit"
    );

    // 3. Change the file — add a new variable
    db.set_source_text(
        file,
        "PROGRAM Main\nVAR\n    alpha : INT;\n    beta : BOOL;\n    gamma : DINT;\nEND_VAR\nEND_PROGRAM\n"
            .to_string(),
    );

    // 4. Re-query
    let symbols_after = db.file_symbols(file);

    // 5. Assert: new variable appears, old variables still present
    assert!(
        symbol_exists(&symbols_after, "alpha"),
        "old variable 'alpha' should persist after edit"
    );
    assert!(
        symbol_exists(&symbols_after, "beta"),
        "old variable 'beta' should persist after edit"
    );
    assert!(
        symbol_exists(&symbols_after, "gamma"),
        "new variable 'gamma' should appear after edit"
    );

    // Salsa must not return a stale cached version
    assert!(
        !Arc::ptr_eq(&symbols_before, &symbols_after),
        "salsa cache must invalidate — stale result should not be reused"
    );
}

#[test]
fn test_salsa_unchanged_file_reuses_cache() {
    let mut db = Database::new();
    let file_a = FileId(0);
    let file_b = FileId(1);

    db.set_source_text(
        file_a,
        "PROGRAM Main\nVAR\n    value : INT;\nEND_VAR\nEND_PROGRAM\n".to_string(),
    );
    db.set_source_text(
        file_b,
        "PROGRAM Aux\nVAR\n    flag : BOOL;\nEND_VAR\nEND_PROGRAM\n".to_string(),
    );

    let syms_a_before = db.file_symbols(file_a);

    // Edit unrelated file
    db.set_source_text(
        file_b,
        "PROGRAM Aux\nVAR\n    flag : BOOL;\n    extra : INT;\nEND_VAR\nEND_PROGRAM\n".to_string(),
    );

    let syms_a_after = db.file_symbols(file_a);

    // Unchanged file should reuse cache
    assert!(
        Arc::ptr_eq(&syms_a_before, &syms_a_after),
        "unchanged file symbols should be reused across unrelated edits"
    );

    // But the edited file should invalidate
    let syms_b_after = db.file_symbols(file_b);
    assert!(
        symbol_exists(&syms_b_after, "extra"),
        "edited file should show new variable"
    );
}

