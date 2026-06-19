//! Linked editing range computation.
//!
//! Linked editing provides ranges that should be edited together when they have
//! identical text content (e.g., same-spelling identifier references).

use text_size::{TextRange, TextSize};

use trust_hir::db::{FileId, SourceDatabase};
use trust_hir::Database;

use crate::references::{find_references, FindReferencesOptions};
use crate::util::ident_at_offset;

/// Computes linked editing ranges for the identifier at a given position.
pub fn linked_editing_ranges(
    db: &Database,
    file_id: FileId,
    position: TextSize,
) -> Option<Vec<TextRange>> {
    let source = db.source_text(file_id);
    let (name, _) = ident_at_offset(&source, position)?;

    let references = find_references(
        db,
        file_id,
        position,
        FindReferencesOptions {
            include_declaration: true,
        },
    );

    let mut ranges: Vec<TextRange> = references
        .into_iter()
        .filter(|reference| reference.file_id == file_id)
        .filter(|reference| range_text(&source, reference.range) == name)
        .map(|reference| reference.range)
        .collect();

    ranges.sort_by_key(|range| (range.start(), range.end()));
    ranges.dedup();

    if ranges.len() <= 1 {
        return None;
    }

    Some(ranges)
}

fn range_text(source: &str, range: TextRange) -> &str {
    let start = usize::from(range.start());
    let end = usize::from(range.end());
    &source[start..end]
}

#[cfg(test)]
mod tests {
    use super::*;
    use trust_hir::db::{Database, FileId, SourceDatabase};

    #[test]
    fn linked_editing_filters_by_spelling() {
        let source = r#"
PROGRAM Test
    VAR x : INT; END_VAR
    x := 1;
    X := x + 1;
END_PROGRAM
"#;
        let cursor = source.find("x := 1").expect("cursor");
        let mut db = Database::new();
        let file_id = FileId(0);
        db.set_source_text(file_id, source.to_string());

        let ranges = linked_editing_ranges(&db, file_id, TextSize::from(cursor as u32))
            .expect("linked ranges");
        assert_eq!(ranges.len(), 3);
        for range in ranges {
            assert_eq!(range_text(source, range), "x");
        }
    }
}
