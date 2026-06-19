use trust_runtime::harness::TestHarness;

#[test]
fn plant_demo_configuration_binds_io_and_tasks() {
    let root =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../examples/plant_demo/src");
    let files = ["types.st", "fb_pump.st", "program.st", "config.st"];
    let mut sources = Vec::with_capacity(files.len());
    for file in files {
        let path = root.join(file);
        let source = std::fs::read_to_string(&path)
            .unwrap_or_else(|err| panic!("failed to read {}: {err}", path.display()));
        sources.push(source);
    }
    let source_refs: Vec<&str> = sources.iter().map(|source| source.as_str()).collect();

    let harness = TestHarness::from_sources(&source_refs).expect("compile plant_demo sources");
    let runtime = harness.runtime();
    assert!(
        !runtime.tasks().is_empty(),
        "expected CONFIGURATION TASK entries to be registered"
    );
    assert!(
        !runtime.io().bindings().is_empty(),
        "expected VAR_CONFIG to produce I/O bindings"
    );
}
