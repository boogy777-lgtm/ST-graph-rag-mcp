//! Shared text-range helpers used by IDE and LSP refactor/quick-fix flows.

use text_size::{TextRange, TextSize};

/// Extends a range to include the rest of its line including trailing newline.
#[must_use]
pub fn extend_range_to_line_end(source: &str, range: TextRange) -> TextRange {
    let mut end = usize::from(range.end());
    let bytes = source.as_bytes();
    while end < bytes.len() {
        match bytes[end] {
            b'\n' => {
                end += 1;
                break;
            }
            b'\r' => {
                end += 1;
                if end < bytes.len() && bytes[end] == b'\n' {
                    end += 1;
                }
                break;
            }
            _ => end += 1,
        }
    }
    TextRange::new(range.start(), TextSize::from(end as u32))
}

/// Returns the trimmed source text covered by the given range.
#[must_use]
pub fn text_for_range(source: &str, range: TextRange) -> String {
    let start: usize = range.start().into();
    let end: usize = range.end().into();
    source
        .get(start..end)
        .map(|text| text.trim().to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extend_range_to_line_end_includes_trailing_newline() {
        let source = "line1\nline2\n";
        let range = TextRange::new(TextSize::from(0), TextSize::from(3));
        let extended = extend_range_to_line_end(source, range);
        assert_eq!(usize::from(extended.start()), 0);
        assert_eq!(usize::from(extended.end()), 6);
    }

    #[test]
    fn text_for_range_trims_segment() {
        let source = "  Alpha  \nBeta";
        let range = TextRange::new(TextSize::from(0), TextSize::from(9));
        assert_eq!(text_for_range(source, range), "Alpha");
    }
}
