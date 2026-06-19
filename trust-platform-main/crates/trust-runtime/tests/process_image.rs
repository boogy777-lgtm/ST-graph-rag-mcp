use trust_runtime::bytecode::{
    BytecodeMetadata, BytecodeVersion, ProcessImageConfig, ResourceMetadata,
    SUPPORTED_MAJOR_VERSION,
};
use trust_runtime::harness::TestHarness;

#[test]
fn sized_from_metadata() {
    let source = r#"
PROGRAM Main
VAR
    counter : INT := 0;
END_VAR
counter := counter + 1;
END_PROGRAM
"#;

    let mut runtime = TestHarness::from_source(source).unwrap().into_runtime();
    let resource = ResourceMetadata {
        name: "R".into(),
        process_image: ProcessImageConfig {
            inputs: 16,
            outputs: 8,
            memory: 4,
        },
        tasks: Vec::new(),
    };
    let metadata = BytecodeMetadata {
        version: BytecodeVersion::new(SUPPORTED_MAJOR_VERSION, 0),
        resources: vec![resource],
    };

    runtime.apply_bytecode_metadata(&metadata, None).unwrap();

    assert_eq!(runtime.io().inputs().len(), 16);
    assert_eq!(runtime.io().outputs().len(), 8);
    assert_eq!(runtime.io().memory().len(), 4);
}
