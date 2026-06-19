use trust_runtime::harness::TestHarness;

#[test]
fn jmp_flow() {
    let source = r#"
        PROGRAM Demo
        VAR
            x: INT := 0;
        END_VAR
        x := INT#1;
        JMP L1;
        x := INT#2;
        L1: x := x + INT#3;
        END_PROGRAM
    "#;

    let err = TestHarness::from_source(source)
        .err()
        .expect("JMP lowering should fail under VM");
    assert!(err
        .to_string()
        .contains("unsupported C5 edge-case lowering path"));
}

#[test]
fn jmp_to_empty_label() {
    let source = r#"
        PROGRAM Demo
        VAR
            x: INT := 0;
        END_VAR
        JMP L1;
        x := INT#1;
        L1: ;
        x := INT#2;
        END_PROGRAM
    "#;

    let err = TestHarness::from_source(source)
        .err()
        .expect("JMP lowering should fail under VM");
    assert!(err
        .to_string()
        .contains("unsupported C5 edge-case lowering path"));
}
