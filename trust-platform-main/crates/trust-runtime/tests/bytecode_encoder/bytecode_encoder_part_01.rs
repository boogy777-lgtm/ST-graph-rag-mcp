use super::*;

#[test]
fn encoder_roundtrip_validates() {
    let source = r#"
PROGRAM Main
VAR
    counter : INT := 0;
END_VAR
counter := counter + 1;
END_PROGRAM

CONFIGURATION C
RESOURCE R ON CPU
TASK T (INTERVAL := T#10ms, PRIORITY := 0);
PROGRAM Main WITH T : Main;
END_RESOURCE
END_CONFIGURATION
"#;

    let module = bytecode_module_from_source(source).unwrap();
    let bytes = module.encode().unwrap();
    let decoded = BytecodeModule::decode(&bytes).unwrap();
    decoded.validate().unwrap();
}

#[test]
fn encoder_emits_method_tables() {
    let source = r#"
CLASS Base
METHOD PUBLIC Foo : INT
Foo := INT#1;
END_METHOD
END_CLASS

CLASS Derived EXTENDS Base
METHOD PUBLIC OVERRIDE Foo : INT
Foo := INT#2;
END_METHOD
METHOD PUBLIC Bar : INT
Bar := INT#3;
END_METHOD
END_CLASS

PROGRAM Main
VAR
    obj : Derived;
END_VAR
END_PROGRAM
"#;

    let module = bytecode_module_from_source(source).unwrap();
    let strings = match module.section(SectionId::StringTable) {
        Some(SectionData::StringTable(table)) => table,
        other => panic!("expected STRING_TABLE, got {other:?}"),
    };
    let pou_index = match module.section(SectionId::PouIndex) {
        Some(SectionData::PouIndex(index)) => index,
        other => panic!("expected POU_INDEX, got {other:?}"),
    };

    let base = pou_index
        .entries
        .iter()
        .find(|entry| {
            entry.kind == PouKind::Class && lookup_string(strings, entry.name_idx) == "Base"
        })
        .expect("Base class entry");
    let derived = pou_index
        .entries
        .iter()
        .find(|entry| {
            entry.kind == PouKind::Class && lookup_string(strings, entry.name_idx) == "Derived"
        })
        .expect("Derived class entry");

    let derived_meta = derived.class_meta.as_ref().expect("Derived metadata");
    assert_eq!(derived_meta.parent_pou_id, Some(base.id));
    assert_eq!(derived_meta.methods.len(), 2);

    let foo_entry = derived_meta
        .methods
        .iter()
        .find(|entry| lookup_string(strings, entry.name_idx) == "Foo")
        .expect("Foo entry");
    let bar_entry = derived_meta
        .methods
        .iter()
        .find(|entry| lookup_string(strings, entry.name_idx) == "Bar")
        .expect("Bar entry");

    assert_eq!(foo_entry.vtable_slot, 0);
    assert_eq!(bar_entry.vtable_slot, 1);

    let derived_foo = pou_index
        .entries
        .iter()
        .find(|entry| {
            entry.kind == PouKind::Method
                && entry.owner_pou_id == Some(derived.id)
                && lookup_string(strings, entry.name_idx) == "Foo"
        })
        .expect("Derived.Foo POU");
    assert_eq!(foo_entry.pou_id, derived_foo.id);
}
