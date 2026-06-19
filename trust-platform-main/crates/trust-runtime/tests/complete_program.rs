use trust_runtime::harness::{CompileSession, SourceFile};

#[test]
fn complete_program_compiles_without_errors() {
    let sources = vec![
        SourceFile::with_path(
            "types.st",
            include_str!("fixtures/complete_program/types.st"),
        ),
        SourceFile::with_path("lib.st", include_str!("fixtures/complete_program/lib.st")),
        SourceFile::with_path("api.st", include_str!("fixtures/complete_program/api.st")),
        SourceFile::with_path("impl.st", include_str!("fixtures/complete_program/impl.st")),
        SourceFile::with_path("main.st", include_str!("fixtures/complete_program/main.st")),
        SourceFile::with_path(
            "config.st",
            include_str!("fixtures/complete_program/config.st"),
        ),
    ];

    let session = CompileSession::from_sources(sources).label_errors(true);
    if let Err(err) = session.build_runtime() {
        panic!("complete program compile failed:\n{err}");
    }
}
