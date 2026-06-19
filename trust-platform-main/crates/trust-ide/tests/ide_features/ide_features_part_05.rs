use super::*;

#[test]
fn test_goto_definition_method_member() {
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
    let call_offset = TextSize::from(source.rfind("Fetch()").unwrap() as u32);
    let def_offset = TextSize::from(source.find("Fetch : DINT").unwrap() as u32);

    let def = goto_definition(&db, file, call_offset).expect("definition");
    assert_eq!(
        u32::from(def.range.start()),
        u32::from(def_offset),
        "Method call should resolve to method definition"
    );
}

#[test]
fn test_hover_initializers_and_retention() {
    let source = r#"
PROGRAM Test
    VAR CONSTANT
        PI : REAL := 3.14;
    END_VAR
    VAR RETAIN
        counter : INT := 10;
    END_VAR
END_PROGRAM
"#;
    let (db, file) = setup(source);

    let pi_offset = TextSize::from(source.find("PI : REAL").unwrap() as u32);
    let pi_hover = hover(&db, file, pi_offset).expect("hover");
    assert!(
        pi_hover.contents.contains("PI : REAL := 3.14"),
        "Constant hover should include initializer"
    );

    let counter_offset = TextSize::from(source.find("counter : INT").unwrap() as u32);
    let counter_hover = hover(&db, file, counter_offset).expect("hover");
    assert!(
        counter_hover.contents.contains("VAR RETAIN"),
        "Hover should include RETAIN qualifier"
    );
    assert!(
        counter_hover.contents.contains("counter : INT := 10"),
        "Hover should include initializer for retained variable"
    );
}

#[test]
fn test_hover_task_priority() {
    let source = r#"
PROGRAM Main
END_PROGRAM

CONFIGURATION Conf
RESOURCE Res ON PLC
    TASK Fast (INTERVAL := T#10ms, PRIORITY := 1);
    PROGRAM P1 WITH Fast : Main;
END_RESOURCE
END_CONFIGURATION
"#;
    let (db, file) = setup(source);

    let priority_offset = TextSize::from(source.find("PRIORITY").unwrap() as u32);
    let priority_hover = hover(&db, file, priority_offset).expect("hover");
    assert!(
        priority_hover.contents.contains("PRIORITY : UINT"),
        "Hover should show PRIORITY type"
    );
    assert!(
        priority_hover.contents.contains("0 = highest priority"),
        "Hover should explain priority ordering"
    );
}

#[test]
fn test_hover_type_definitions_and_fb_interface() {
    let source = r#"
TYPE MyInt : INT;
END_TYPE

TYPE Color :
(
    Red := 0,
    Green := 1
);
END_TYPE

TYPE Point : STRUCT
    x : DINT;
    y : DINT;
END_STRUCT
END_TYPE

INTERFACE IFoo
END_INTERFACE

FUNCTION_BLOCK Base
END_FUNCTION_BLOCK

FUNCTION_BLOCK Motor EXTENDS Base IMPLEMENTS IFoo
VAR_INPUT
    speed : INT;
END_VAR
VAR_OUTPUT
    ok : BOOL;
END_VAR
END_FUNCTION_BLOCK
"#;
    let (db, file) = setup(source);

    let alias_offset = TextSize::from(source.find("MyInt").unwrap() as u32);
    let alias_hover = hover(&db, file, alias_offset).expect("hover");
    assert!(
        alias_hover.contents.contains("TYPE MyInt : INT"),
        "Hover should show alias definition"
    );

    let enum_offset = TextSize::from(source.find("Color").unwrap() as u32);
    let enum_hover = hover(&db, file, enum_offset).expect("hover");
    assert!(
        enum_hover.contents.contains("Red := 0") && enum_hover.contents.contains("Green := 1"),
        "Hover should list enum values"
    );

    let struct_offset = TextSize::from(source.find("Point : STRUCT").unwrap() as u32);
    let struct_hover = hover(&db, file, struct_offset).expect("hover");
    assert!(
        struct_hover.contents.contains("x : DINT") && struct_hover.contents.contains("y : DINT"),
        "Hover should list struct fields"
    );

    let fb_offset = TextSize::from(source.find("Motor EXTENDS").unwrap() as u32);
    let fb_hover = hover(&db, file, fb_offset).expect("hover");
    assert!(
        fb_hover.contents.contains("VAR_INPUT") && fb_hover.contents.contains("speed : INT"),
        "Hover should show FB interface"
    );
    assert!(
        fb_hover.contents.contains("VAR_OUTPUT") && fb_hover.contents.contains("ok : BOOL"),
        "Hover should show FB outputs"
    );
    assert!(
        fb_hover.contents.contains("EXTENDS Base") && fb_hover.contents.contains("IMPLEMENTS IFoo"),
        "Hover should show inheritance and implements"
    );
}

#[test]
fn test_hover_function_block_uses_declared_type_when_type_resolution_is_unknown() {
    let source = r#"
FUNCTION_BLOCK FB_Pump
VAR_INPUT
    Command : ST_PumpCommand;
END_VAR
VAR_OUTPUT
    Status : ST_PumpStatus;
END_VAR
END_FUNCTION_BLOCK
"#;
    let (db, file) = setup(source);
    let fb_offset = TextSize::from(source.find("FB_Pump").unwrap() as u32);
    let hover_result = hover(&db, file, fb_offset).expect("hover");

    assert!(
        hover_result.contents.contains("Command : ST_PumpCommand;"),
        "Hover should preserve declared input type text when semantic type is unresolved. Hover:\n{}",
        hover_result.contents
    );
    assert!(
        hover_result.contents.contains("Status : ST_PumpStatus;"),
        "Hover should preserve declared output type text when semantic type is unresolved. Hover:\n{}",
        hover_result.contents
    );
    assert!(
        !hover_result.contents.contains("Command : ?;") && !hover_result.contents.contains("Status : ?;"),
        "Hover should avoid unresolved placeholders for explicitly declared member types. Hover:\n{}",
        hover_result.contents
    );
}
