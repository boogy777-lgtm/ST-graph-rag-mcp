//! Selection range computation for Structured Text.
//!
//! This module provides hierarchical selection ranges based on the CST.

use text_size::{TextRange, TextSize};

use trust_hir::db::{FileId, SourceDatabase};
use trust_hir::Database;
use trust_syntax::parser::parse;
use trust_syntax::syntax::{SyntaxNode, SyntaxToken};

/// A selection range with an optional parent.
#[derive(Debug, Clone)]
pub struct SelectionRange {
    /// The range for this selection.
    pub range: TextRange,
    /// The parent range (larger container).
    pub parent: Option<Box<SelectionRange>>,
}

/// Computes selection ranges for a set of positions in a file.
pub fn selection_ranges(
    db: &Database,
    file_id: FileId,
    positions: &[TextSize],
) -> Vec<SelectionRange> {
    let source = db.source_text(file_id);
    let parsed = parse(&source);
    let root = parsed.syntax();

    positions
        .iter()
        .map(|position| selection_range_at(&root, *position))
        .collect()
}

fn selection_range_at(root: &SyntaxNode, position: TextSize) -> SelectionRange {
    let ranges = selection_chain(root, position);
    if ranges.is_empty() {
        return SelectionRange {
            range: root.text_range(),
            parent: None,
        };
    }

    let mut current: Option<SelectionRange> = None;
    for range in ranges.into_iter().rev() {
        current = Some(SelectionRange {
            range,
            parent: current.map(Box::new),
        });
    }

    current.unwrap_or(SelectionRange {
        range: root.text_range(),
        parent: None,
    })
}

fn selection_chain(root: &SyntaxNode, position: TextSize) -> Vec<TextRange> {
    let mut ranges = Vec::new();
    let Some(token) = find_token_at_position(root, position) else {
        return ranges;
    };

    let token_range = token.text_range();
    ranges.push(token_range);

    for node in token.parent_ancestors() {
        let range = node.text_range();
        if ranges.last().copied() != Some(range) {
            ranges.push(range);
        }
    }

    ranges
}

fn find_token_at_position(root: &SyntaxNode, position: TextSize) -> Option<SyntaxToken> {
    let token = root.token_at_offset(position);
    token
        .clone()
        .right_biased()
        .or_else(|| token.left_biased())
        .or_else(|| root.last_token())
}

#[cfg(test)]
mod tests {
    use super::*;
    use trust_hir::db::SourceDatabase;

    #[test]
    fn selection_range_has_parent_chain() {
        let source = r#"
PROGRAM Test
    VAR x : INT; END_VAR
    x := x + 1;
END_PROGRAM
"#;
        let cursor = source.find("x + 1").expect("cursor") + 1;
        let mut db = Database::new();
        let file_id = FileId(0);
        db.set_source_text(file_id, source.to_string());

        let ranges = selection_ranges(&db, file_id, &[TextSize::from(cursor as u32)]);
        let selection = &ranges[0];
        assert!(selection.parent.is_some());
        let parent = selection.parent.as_ref().unwrap();
        assert!(range_contains(&parent.range, &selection.range));
    }

    fn range_contains(parent: &TextRange, child: &TextRange) -> bool {
        parent.start() <= child.start() && parent.end() >= child.end()
    }
}
