//! Shared helpers for parser snapshot tests.
#![allow(dead_code, unused_imports)]

pub use trust_syntax::parser::parse;
#[allow(unused_imports)]
pub use trust_syntax::syntax::SyntaxKind;

/// Helper to format a parse result for snapshot testing.
pub fn snapshot_parse(source: &str) -> String {
    let parsed = parse(source);
    let syntax = parsed.syntax();

    let mut output = String::new();
    format_node(&syntax, &mut output, 0);

    if !parsed.ok() {
        output.push_str("\n---\nErrors:\n");
        for err in parsed.errors() {
            output.push_str(&format!("  - {}\n", err));
        }
    }

    output
}

fn format_node(node: &trust_syntax::syntax::SyntaxNode, out: &mut String, depth: usize) {
    let indent = "  ".repeat(depth);

    // Print node kind
    out.push_str(&format!(
        "{}{:?}@{:?}\n",
        indent,
        node.kind(),
        node.text_range()
    ));

    // Print children
    for child in node.children_with_tokens() {
        match child {
            rowan::NodeOrToken::Node(n) => format_node(&n, out, depth + 1),
            rowan::NodeOrToken::Token(t) => {
                // Only show non-trivial tokens
                let kind = t.kind();
                if !kind.is_trivia() {
                    out.push_str(&format!(
                        "{}{:?}@{:?} {:?}\n",
                        "  ".repeat(depth + 1),
                        kind,
                        t.text_range(),
                        t.text()
                    ));
                }
            }
        }
    }
}
