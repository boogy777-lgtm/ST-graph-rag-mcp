use super::*;

#[test]
fn test_semantic_tokens_variable() {
    let source = r#"
PROGRAM Test
    VAR myVar : INT; END_VAR
    myVar := 42;
END_PROGRAM
"#;
    let (db, file) = setup(source);
    let tokens = semantic_tokens(&db, file);

    // Find the token for 'myVar' in declaration
    let var_offset = source.find("myVar :").unwrap() as u32;
    let var_token = tokens
        .iter()
        .find(|t| u32::from(t.range.start()) == var_offset);

    assert!(
        var_token.is_some(),
        "Should have token for 'myVar' declaration"
    );
    if let Some(token) = var_token {
        assert_eq!(
            token.token_type,
            SemanticTokenType::Variable,
            "Variable should be classified as Variable"
        );
    }
}

#[test]
fn test_semantic_tokens_constant() {
    let source = r#"
PROGRAM Test
    VAR CONSTANT PI : REAL := 3.14159; END_VAR
END_PROGRAM
"#;
    let (db, file) = setup(source);
    let tokens = semantic_tokens(&db, file);

    // Find the token for 'PI'
    let pi_offset = source.find("PI :").unwrap() as u32;
    let pi_token = tokens
        .iter()
        .find(|t| u32::from(t.range.start()) == pi_offset);

    assert!(pi_token.is_some(), "Should have token for 'PI' declaration");
    if let Some(token) = pi_token {
        // Constants are classified as Variable with readonly modifier
        assert_eq!(
            token.token_type,
            SemanticTokenType::Variable,
            "Constant should be classified as Variable"
        );
        assert!(
            token.modifiers.readonly,
            "Constant should have readonly modifier"
        );
    }
}

#[test]
fn test_semantic_tokens_keywords() {
    let source = "PROGRAM Test END_PROGRAM";
    let (db, file) = setup(source);
    let tokens = semantic_tokens(&db, file);

    // Find the PROGRAM keyword token
    let program_token = tokens.iter().find(|t| u32::from(t.range.start()) == 0);

    assert!(
        program_token.is_some(),
        "Should have token for PROGRAM keyword"
    );
    if let Some(token) = program_token {
        assert_eq!(
            token.token_type,
            SemanticTokenType::Keyword,
            "PROGRAM should be classified as Keyword"
        );
    }
}

#[test]
fn test_semantic_tokens_parameter() {
    let source = r#"
FUNCTION Add : INT
    VAR_INPUT a : INT; END_VAR
    Add := a;
END_FUNCTION
"#;
    let (db, file) = setup(source);
    let tokens = semantic_tokens(&db, file);

    let param_offset = source.find("a : INT").unwrap() as u32;
    let param_token = tokens
        .iter()
        .find(|t| u32::from(t.range.start()) == param_offset);

    assert!(
        param_token.is_some(),
        "Should have token for parameter declaration"
    );
    if let Some(token) = param_token {
        assert_eq!(
            token.token_type,
            SemanticTokenType::Parameter,
            "Parameter should be classified as Parameter"
        );
        assert!(
            token.modifiers.declaration,
            "Parameter declaration should have declaration modifier"
        );
    }
}

#[test]
fn test_semantic_tokens_enum_member() {
    let source = r#"
TYPE Mode : (Auto, Manual); END_TYPE

PROGRAM Test
    VAR mode : Mode; END_VAR
    mode := Auto;
END_PROGRAM
"#;
    let (db, file) = setup(source);
    let tokens = semantic_tokens(&db, file);

    let enum_offset = source.rfind("Auto").unwrap() as u32;
    let enum_token = tokens
        .iter()
        .find(|t| u32::from(t.range.start()) == enum_offset);

    assert!(
        enum_token.is_some(),
        "Should have token for enum member usage"
    );
    if let Some(token) = enum_token {
        assert_eq!(
            token.token_type,
            SemanticTokenType::EnumMember,
            "Enum member should be classified as EnumMember"
        );
    }
}

#[test]
fn test_semantic_tokens_method_member() {
    let source = r#"
FUNCTION_BLOCK Counter
    METHOD Fetch : DINT
        RETURN;
    END_METHOD
END_FUNCTION_BLOCK

PROGRAM Test
    VAR fb : Counter; END_VAR
    fb.Fetch();
END_PROGRAM
"#;
    let (db, file) = setup(source);
    let tokens = semantic_tokens(&db, file);

    let method_offset = source.rfind("Fetch").unwrap() as u32;
    let method_token = tokens
        .iter()
        .find(|t| u32::from(t.range.start()) == method_offset);

    assert!(
        method_token.is_some(),
        "Should have token for method member usage"
    );
    if let Some(token) = method_token {
        assert_eq!(
            token.token_type,
            SemanticTokenType::Method,
            "Method member should be classified as Method"
        );
    }
}

#[test]
fn test_semantic_tokens_struct_field_member() {
    let source = r#"
TYPE Point : STRUCT
    x : DINT;
END_STRUCT
END_TYPE

PROGRAM Test
    VAR p : Point; END_VAR
    p.x := 1;
END_PROGRAM
"#;
    let (db, file) = setup(source);
    let tokens = semantic_tokens(&db, file);

    let field_offset = source.rfind("x := 1").unwrap() as u32;
    let field_token = tokens
        .iter()
        .find(|t| u32::from(t.range.start()) == field_offset);

    assert!(
        field_token.is_some(),
        "Should have token for struct field usage"
    );
    if let Some(token) = field_token {
        assert_eq!(
            token.token_type,
            SemanticTokenType::Property,
            "Struct field should be classified as Property"
        );
    }
}

#[test]
fn test_semantic_tokens_type_reference() {
    let source = r#"
TYPE Thing : STRUCT
    value : DINT;
END_STRUCT
END_TYPE

PROGRAM Test
    VAR item : Thing; END_VAR
END_PROGRAM
"#;
    let (db, file) = setup(source);
    let tokens = semantic_tokens(&db, file);

    let type_offset = source.rfind("Thing;").unwrap() as u32;
    let type_token = tokens
        .iter()
        .find(|t| u32::from(t.range.start()) == type_offset);

    assert!(type_token.is_some(), "Should have token for type reference");
    if let Some(token) = type_token {
        assert_eq!(
            token.token_type,
            SemanticTokenType::Type,
            "Type reference should be classified as Type"
        );
    }
}

// =============================================================================
// Hover & Go-to-definition Tests
// =============================================================================
