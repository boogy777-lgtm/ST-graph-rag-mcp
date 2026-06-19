use crate::syntax::SyntaxKind;

use super::super::Parser;

impl Parser<'_, '_> {
    /// Parse a pragma: `{attribute ...}`, `{IF ...}`, `{region ...}`, etc.
    ///
    /// Pragmas are IEC 61131-3 implementer-specific directives enclosed in `{ ... }`.
    /// The lexer produces a single `Pragma` token per balanced `{...}` pair (including
    /// nested braces via lexer callback).
    ///
    /// Classification is driven by the text prefix after the opening brace:
    ///
    /// | Prefix | SyntaxKind | IEC 61131-3 role |
    /// |--------|------------|------------------|
    /// | `attribute` | `AttributePragma` | Compiler hints (qualified_only, init_on_reset, etc.) |
    /// | `IF` | `ConditionalPragma` | Compile-time conditional begin |
    /// | `ELSIF` | `ConditionalPragmaBranch` | Conditional alternative |
    /// | `ELSE` | `ConditionalPragmaBranch` | Conditional fallback |
    /// | `END_IF` | `ConditionalPragma` | Conditional end |
    /// | `region` | `RegionPragma` | Code folding region start |
    /// | `endregion` | `EndRegionPragma` | Code folding region end |
    /// | `define` | `DefinePragma` | Symbol definition |
    /// | `undefine` | `UndefinePragma` | Symbol removal |
    /// | `info`/`warning`/`error`/`text` | `MessagePragma` | Diagnostic messages |
    ///
    /// Unknown prefixes fall back to `AttributePragma`.
    pub(crate) fn parse_pragma(&mut self) {
        let kind = classify_pragma_text(self.source.current_text());
        self.start_node(kind);
        self.bump();
        self.finish_node();
    }
}

fn classify_pragma_text(text: &str) -> SyntaxKind {
    let inner = text
        .strip_prefix('{')
        .and_then(|s| s.strip_suffix('}'))
        .unwrap_or(text)
        .trim();
    let inner_lower = inner.to_ascii_lowercase();

    if pragma_equals(&inner_lower, "attribute") {
        SyntaxKind::AttributePragma
    } else if pragma_equals(&inner_lower, "if") {
        SyntaxKind::ConditionalPragma
    } else if pragma_equals(&inner_lower, "elsif") || pragma_equals(&inner_lower, "else") {
        SyntaxKind::ConditionalPragmaBranch
    } else if pragma_equals(&inner_lower, "end_if") {
        SyntaxKind::ConditionalPragma
    } else if pragma_equals(&inner_lower, "region") {
        SyntaxKind::RegionPragma
    } else if pragma_equals(&inner_lower, "endregion") {
        SyntaxKind::EndRegionPragma
    } else if pragma_equals(&inner_lower, "define") {
        SyntaxKind::DefinePragma
    } else if pragma_equals(&inner_lower, "undefine") {
        SyntaxKind::UndefinePragma
    } else if pragma_equals(&inner_lower, "info")
        || pragma_equals(&inner_lower, "warning")
        || pragma_equals(&inner_lower, "error")
        || pragma_equals(&inner_lower, "text")
    {
        SyntaxKind::MessagePragma
    } else {
        SyntaxKind::AttributePragma
    }
}

fn pragma_equals(text_lower: &str, key: &str) -> bool {
    text_lower == key
        || (text_lower.starts_with(key)
            && text_lower.as_bytes().get(key.len()) == Some(&b' '))
}
