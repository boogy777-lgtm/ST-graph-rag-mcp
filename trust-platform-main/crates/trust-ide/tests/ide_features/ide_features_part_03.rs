use super::*;

#[test]
fn test_struct_field_definition_and_references_across_files() {
    let types_source = r#"
TYPE
    ST_Cmd : STRUCT
        Enable : BOOL;
    END_STRUCT;
END_TYPE
"#;
    let fb_source = r#"
FUNCTION_BLOCK FB_Test
VAR_INPUT
    Command : ST_Cmd;
END_VAR
VAR
    LocalEnable : BOOL;
END_VAR

LocalEnable := Command.Enable;
END_FUNCTION_BLOCK
"#;
    let program_source = r#"
PROGRAM Main
VAR
    Cmd : ST_Cmd;
END_VAR

Cmd.Enable := TRUE;
END_PROGRAM
"#;

    let mut db = Database::new();
    let types_file = FileId(0);
    let fb_file = FileId(1);
    let program_file = FileId(2);
    db.set_source_text(types_file, types_source.to_string());
    db.set_source_text(fb_file, fb_source.to_string());
    db.set_source_text(program_file, program_source.to_string());

    let pos = TextSize::from(types_source.find("Enable : BOOL").unwrap() as u32);
    let def = goto_definition(&db, types_file, pos).expect("definition should resolve");
    assert_eq!(
        def.file_id, types_file,
        "struct field definition should resolve to the type declaration file"
    );

    let refs = find_references(
        &db,
        types_file,
        pos,
        FindReferencesOptions {
            include_declaration: true,
        },
    );
    assert!(
        refs.iter().any(|reference| reference.file_id == types_file),
        "references should include struct field declaration, got file ids: {:?}",
        refs.iter()
            .map(|reference| reference.file_id)
            .collect::<Vec<_>>()
    );
    assert!(
        refs.iter().any(|reference| reference.file_id == fb_file),
        "references should include field usage in function block file, got file ids: {:?}",
        refs.iter()
            .map(|reference| reference.file_id)
            .collect::<Vec<_>>()
    );
    assert!(
        refs.iter()
            .any(|reference| reference.file_id == program_file),
        "references should include field usage in program file, got file ids: {:?}",
        refs.iter()
            .map(|reference| reference.file_id)
            .collect::<Vec<_>>()
    );
}

#[test]
fn test_symbol_navigation_and_rename_from_punctuation_adjacent_positions() {
    let source = r#"
TYPE
    ST_PumpStatus :
    STRUCT
        ActualSpeed : REAL;
    END_STRUCT;
END_TYPE

FUNCTION_BLOCK FB_Pump
VAR
    ramp : REAL;
    Status : ST_PumpStatus;
END_VAR

ramp := ramp + 0.2;
Status.ActualSpeed := ramp;
END_FUNCTION_BLOCK
"#;
    let (db, file) = setup(source);

    let ramp_plus_pos = TextSize::from(source.find("ramp + 0.2").unwrap() as u32 + 5);
    let ramp_def = goto_definition(&db, file, ramp_plus_pos).expect("ramp definition");
    let ramp_decl = TextSize::from(source.find("ramp : REAL").unwrap() as u32);
    assert_eq!(
        ramp_def.range.start(),
        ramp_decl,
        "definition should resolve when cursor is punctuation-adjacent"
    );

    let field_colon_pos = TextSize::from(
        source.find("ActualSpeed : REAL").unwrap() as u32 + "ActualSpeed ".len() as u32,
    );
    let refs = find_references(
        &db,
        file,
        field_colon_pos,
        FindReferencesOptions {
            include_declaration: true,
        },
    );
    assert!(
        refs.len() >= 2,
        "references should resolve for punctuation-adjacent cursor on field declaration"
    );

    let renamed = rename(&db, file, field_colon_pos, "ActualSpeedRpm");
    assert!(
        renamed.is_some(),
        "rename should resolve for punctuation-adjacent cursor on declaration"
    );
}

#[test]
fn test_rename_function_block_updates_type_usage_in_other_file() {
    let fb_source = r#"
FUNCTION_BLOCK LevelControllerFb
END_FUNCTION_BLOCK
"#;
    let main_source = r#"
PROGRAM Main
VAR
    Ctrl : LevelControllerFb;
END_VAR
END_PROGRAM
"#;

    let mut db = Database::new();
    let fb_file = FileId(0);
    let main_file = FileId(1);
    db.set_source_text(fb_file, fb_source.to_string());
    db.set_source_text(main_file, main_source.to_string());

    let pos = TextSize::from(fb_source.find("LevelControllerFb").unwrap() as u32);
    let result = rename(&db, fb_file, pos, "LevelControllerFb2")
        .expect("rename should succeed across files");

    let fb_edits = result
        .edits
        .get(&fb_file)
        .expect("expected declaration edit in FB file");
    assert!(
        fb_edits.iter().any(|edit| &fb_source
            [u32::from(edit.range.start()) as usize..u32::from(edit.range.end()) as usize]
            == "LevelControllerFb"),
        "expected declaration edit in FB file"
    );

    let main_edits = result
        .edits
        .get(&main_file)
        .expect("expected type-usage edit in Main file");
    assert!(
        main_edits.iter().any(|edit| &main_source
            [u32::from(edit.range.start()) as usize..u32::from(edit.range.end()) as usize]
            == "LevelControllerFb"),
        "expected type usage edit in Main file"
    );
}

#[test]
fn test_rename_function_block_from_usage_site_updates_declaration() {
    let fb_source = r#"
FUNCTION_BLOCK LevelControllerFb
END_FUNCTION_BLOCK
"#;
    let main_source = r#"
PROGRAM Main
VAR
    Ctrl : LevelControllerFb;
END_VAR
END_PROGRAM
"#;

    let mut db = Database::new();
    let fb_file = FileId(0);
    let main_file = FileId(1);
    db.set_source_text(fb_file, fb_source.to_string());
    db.set_source_text(main_file, main_source.to_string());

    let pos = TextSize::from(main_source.find("LevelControllerFb").unwrap() as u32);
    let result = rename(&db, main_file, pos, "LevelControllerFb2")
        .expect("rename should succeed from usage site");

    assert!(
        result.edits.contains_key(&fb_file),
        "expected declaration edit in FB file"
    );
    assert!(
        result.edits.contains_key(&main_file),
        "expected usage edit in Main file"
    );
}

// =============================================================================
// Semantic Token Tests
// =============================================================================

#[test]
fn test_semantic_tokens_function() {
    let source = r#"
FUNCTION Add : INT
    VAR_INPUT a : INT; b : INT; END_VAR
    Add := a + b;
END_FUNCTION
"#;
    let (db, file) = setup(source);
    let tokens = semantic_tokens(&db, file);

    // Find the token for 'Add' in declaration
    let add_offset = source.find("Add :").unwrap() as u32;
    let add_token = tokens
        .iter()
        .find(|t| u32::from(t.range.start()) == add_offset);

    assert!(
        add_token.is_some(),
        "Should have token for 'Add' declaration"
    );
    if let Some(token) = add_token {
        assert_eq!(
            token.token_type,
            SemanticTokenType::Function,
            "Function name should be classified as Function"
        );
        assert!(
            token.modifiers.declaration,
            "Declaration site should have declaration modifier"
        );
    }
}
