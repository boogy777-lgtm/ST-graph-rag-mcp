mod common;
use common::*;

// Example Project Parsing Tests
/// Test that all example files parse without errors
#[test]
fn test_examples_parse() {
    use std::fs;
    use std::path::Path;

    fn test_dir(dir: &Path) {
        if !dir.exists() {
            return;
        }
        for entry in fs::read_dir(dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() {
                test_dir(&path);
            } else if path.extension().map(|e| e == "st").unwrap_or(false) {
                let content = fs::read_to_string(&path).unwrap();
                let parsed = parse(&content);

                if !parsed.ok() {
                    let errors: Vec<_> = parsed.errors().iter().map(|e| e.to_string()).collect();
                    panic!("Parse errors in {}:\n{}", path.display(), errors.join("\n"));
                }
            }
        }
    }

    let examples = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/corpus/examples");
    test_dir(&examples);
}

#[test]
fn test_pragmas_parse_and_preserve_tokens() {
    let source = r#"
{VERSION 2.0}
PROGRAM P
VAR
    x : INT;
END_VAR
    x := 1;
END_PROGRAM
"#;

    let parsed = parse(source);
    assert!(
        parsed.ok(),
        "Parse errors: {:?}",
        parsed
            .errors()
            .iter()
            .map(|e| e.to_string())
            .collect::<Vec<_>>()
    );

    let pragma_count = parsed
        .syntax()
        .descendants_with_tokens()
        .filter_map(|it| it.into_token())
        .filter(|t| t.kind() == SyntaxKind::Pragma)
        .count();

    assert_eq!(pragma_count, 1);
}
