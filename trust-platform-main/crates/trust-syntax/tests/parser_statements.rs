mod common;
use common::*;

// Statements - Control Flow
#[test]
// IEC 61131-3 Ed.3 Table 72 (IF statement)
fn test_if_statement() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
IF x > 0 THEN
    y := 1;
END_IF;
END_PROGRAM"#
    ));
}

#[test]
fn test_if_elsif_else() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
IF x > 0 THEN
    y := 1;
ELSIF x < 0 THEN
    y := -1;
ELSE
    y := 0;
END_IF;
END_PROGRAM"#
    ));
}

#[test]
// IEC 61131-3 Ed.3 Table 72 (CASE statement)
fn test_case_statement() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
CASE state OF
    1..2: y := 10;
    3, 4..5: y := 20;
ELSE
    y := 0;
END_CASE;
END_PROGRAM"#
    ));
}

#[test]
// IEC 61131-3 Ed.3 Table 72 (FOR statement)
fn test_for_loop() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
FOR i := 0 TO 10 BY 2 DO
    sum := sum + i;
END_FOR;
END_PROGRAM"#
    ));
}

#[test]
fn test_while_loop() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
WHILE x < 10 DO
    x := x + 1;
END_WHILE;
END_PROGRAM"#
    ));
}

#[test]
fn test_repeat_loop() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
REPEAT
    x := x + 1;
UNTIL x >= 10
END_REPEAT;
END_PROGRAM"#
    ));
}

#[test]
// IEC 61131-3 Ed.3 Table 72 (RETURN statement)
fn test_return_statement() {
    insta::assert_snapshot!(snapshot_parse(
        r#"FUNCTION Test : INT
RETURN 42;
END_FUNCTION"#
    ));
}

#[test]
fn test_exit_continue() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
FOR i := 0 TO 10 DO
    IF i = 5 THEN
        CONTINUE;
    END_IF;
    IF i = 8 THEN
        EXIT;
    END_IF;
END_FOR;
END_PROGRAM"#
    ));
}

#[test]
// IEC 61131-3 Ed.3 Table 72 (JMP statement)
fn test_jmp_statement() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
    JMP Target;
END_PROGRAM"#
    ));
}

#[test]
// IEC 61131-3 Ed.3 Table 72 (labelled statement)
fn test_label_statement() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
    VAR
        x : INT;
    END_VAR
    Start: x := 1;
    JMP Start;
END_PROGRAM"#
    ));
}

#[test]
// IEC 61131-3 Ed.3 Table 71 (reference assignment operator)
fn test_assignment_attempt() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
    interface1 ?= interface2;
END_PROGRAM"#
    ));
}

#[test]
// IEC 61131-3 Ed.3 Table 71 (output parameter connection)
fn test_output_connection() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
    result := SafeDiv(EN := cond, Num := a, Den := b, ENO => ok);
END_PROGRAM"#
    ));
}

#[test]
fn test_siemens_hash_prefixed_statement_forms() {
    insta::assert_snapshot!(snapshot_parse(
        r#"PROGRAM Test
    #sum := 0;
    FOR #i := 0 TO 3 DO
        #sum := #sum + #i;
    END_FOR;
END_PROGRAM"#
    ));
}
