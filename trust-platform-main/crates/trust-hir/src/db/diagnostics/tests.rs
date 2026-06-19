use super::super::*;

#[test]
fn test_database_basic() {
    let mut db = Database::new();
    let file = FileId(0);

    db.set_source_text(file, "PROGRAM Test END_PROGRAM".to_string());

    let source = db.source_text(file);
    assert!(source.contains("PROGRAM"));
}

#[test]
fn test_expr_id_type_of() {
    let mut db = Database::new();
    let file = FileId(0);
    let source = "PROGRAM Test VAR x : DINT; END_VAR x := 1 + 2; END_PROGRAM";
    db.set_source_text(file, source.to_string());

    let plus_offset = source.find('+').unwrap() as u32;
    let expr_id = db.expr_id_at_offset(file, plus_offset).unwrap();
    let expr_type = db.type_of(file, expr_id);
    assert_eq!(expr_type, TypeId::SINT);
}

#[test]
fn test_expr_id_type_of_based_literal() {
    let mut db = Database::new();
    let file = FileId(0);
    let source = "PROGRAM Test VAR x : UINT; END_VAR x := 16#FF; END_PROGRAM";
    db.set_source_text(file, source.to_string());

    let hash_offset = source.find('#').unwrap() as u32;
    let expr_id = db.expr_id_at_offset(file, hash_offset).unwrap();
    let expr_type = db.type_of(file, expr_id);
    assert_eq!(expr_type, TypeId::USINT);
}

#[test]
fn test_type_of_cache_invalidates_on_change() {
    let mut db = Database::new();
    let file = FileId(0);
    let source = "PROGRAM Test VAR x : DINT; END_VAR x := 1 + 2; END_PROGRAM";
    db.set_source_text(file, source.to_string());

    let plus_offset = source.find('+').unwrap() as u32;
    let expr_id = db.expr_id_at_offset(file, plus_offset).unwrap();
    let expr_type = db.type_of(file, expr_id);
    assert_eq!(expr_type, TypeId::SINT);

    let updated = "PROGRAM Test VAR x : DINT; END_VAR x := REAL#1.0 + REAL#2.0; END_PROGRAM";
    db.set_source_text(file, updated.to_string());
    let plus_offset = updated.find('+').unwrap() as u32;
    let expr_id = db.expr_id_at_offset(file, plus_offset).unwrap();
    let expr_type = db.type_of(file, expr_id);
    assert_eq!(expr_type, TypeId::REAL);
}

#[test]
fn test_check_set_reset_valid() {
    let mut db = Database::new();
    let file = FileId(0);
    let source = "PROGRAM Test VAR x : BOOL; END_VAR x S= TRUE; END_PROGRAM";
    db.set_source_text(file, source.to_string());

    let diags = db.diagnostics(file);
    let errors: Vec<_> = diags.iter().filter(|d| d.is_error()).collect();
    assert!(errors.is_empty(), "expected no errors, got {errors:?}");
}

#[test]
fn test_check_set_reset_invalid_non_bool_rhs() {
    let mut db = Database::new();
    let file = FileId(0);
    let source = "PROGRAM Test VAR x : BOOL; END_VAR x S= 42; END_PROGRAM";
    db.set_source_text(file, source.to_string());

    let diags = db.diagnostics(file);
    let errors: Vec<_> = diags.iter().filter(|d| d.is_error()).collect();
    assert!(!errors.is_empty(), "expected errors for non-BOOL RHS, got none");
}

#[test]
fn test_check_arrow_expr_resolves_target_member() {
    let mut db = Database::new();
    let file = FileId(0);
    let source = "TYPE Carrier : STRUCT a : DINT; b : REAL; END_STRUCT END_TYPE PROGRAM Test VAR p : REF_TO Carrier; END_VAR p->a; END_PROGRAM";
    db.set_source_text(file, source.to_string());

    let arrow_offset = source.find("->").unwrap() as u32;
    let expr_id = db.expr_id_at_offset(file, arrow_offset).unwrap();
    let expr_type = db.type_of(file, expr_id);
    assert_eq!(expr_type, TypeId::DINT, "arrow expr should resolve to DINT field type");
}

#[test]
fn test_check_slice_expr_resolves_array_element_type() {
    let mut db = Database::new();
    let file = FileId(0);
    let source = "PROGRAM Test VAR arr : ARRAY[0..9] OF DINT; x : DINT; END_VAR x := arr[1..5]; END_PROGRAM";
    db.set_source_text(file, source.to_string());

    // Find the '[' to locate the slice expression
    let open_bracket = source.rfind('[').unwrap() as u32;
    let expr_id = db.expr_id_at_offset(file, open_bracket).unwrap();
    let expr_type = db.type_of(file, expr_id);
    assert_eq!(expr_type, TypeId::DINT, "slice expr should return array element type DINT");
}
