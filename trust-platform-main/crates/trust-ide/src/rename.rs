//! Rename for Structured Text.
//!
//! This module provides safe symbol renaming functionality.

use std::collections::HashMap;
use text_size::{TextRange, TextSize};

use crate::refactor::{move_namespace_path, namespace_full_path, parse_namespace_path};
use crate::references::{find_references, find_references_to_field, FindReferencesOptions};
use crate::util::{ident_at_offset, resolve_target_at_position, FieldTarget, ResolvedTarget};
use trust_hir::db::{FileId, SemanticDatabase};
use trust_hir::symbols::{ScopeId, SymbolTable};
use trust_hir::{
    is_reserved_keyword, is_valid_identifier, Database, SourceDatabase, SymbolId, Type,
};

/// A text edit representing a change to the source.
#[derive(Debug, Clone)]
pub struct TextEdit {
    /// The range to replace.
    pub range: TextRange,
    /// The new text.
    pub new_text: String,
}

/// Result of a rename operation.
#[derive(Debug, Clone)]
pub struct RenameResult {
    /// Edits grouped by file.
    pub edits: HashMap<FileId, Vec<TextEdit>>,
}

impl RenameResult {
    /// Creates an empty rename result.
    #[must_use]
    pub fn new() -> Self {
        Self {
            edits: HashMap::new(),
        }
    }

    /// Adds an edit for a file.
    pub fn add_edit(&mut self, file_id: FileId, edit: TextEdit) {
        self.edits.entry(file_id).or_default().push(edit);
    }

    /// Returns the total number of edits.
    #[must_use]
    pub fn edit_count(&self) -> usize {
        self.edits.values().map(Vec::len).sum()
    }
}

impl Default for RenameResult {
    fn default() -> Self {
        Self::new()
    }
}

/// Prepares a rename operation, checking if rename is valid at the position.
pub fn prepare_rename(db: &Database, file_id: FileId, position: TextSize) -> Option<TextRange> {
    let source = db.source_text(file_id);
    let (_, range) = ident_at_offset(&source, position)?;
    Some(range)
}

/// Performs a rename operation.
pub fn rename(
    db: &Database,
    file_id: FileId,
    position: TextSize,
    new_name: &str,
) -> Option<RenameResult> {
    let target = resolve_target_at_position(db, file_id, position)?;

    if new_name.contains('.') {
        let new_path = parse_namespace_path(new_name)?;
        if let ResolvedTarget::Symbol(symbol_id) = target {
            let symbols = db.file_symbols(file_id);
            if let Some(path) = namespace_full_path(&symbols, symbol_id) {
                return move_namespace_path(db, &path, &new_path);
            }
        }
        return None;
    }

    // Validate the new name
    if !is_valid_identifier(new_name) {
        return None;
    }

    // Check if it's a reserved keyword
    if is_reserved_keyword(new_name) {
        return None;
    }

    match target {
        ResolvedTarget::Symbol(symbol_id) => {
            let symbols = db.file_symbols(file_id);
            if has_conflict(&symbols, symbol_id, new_name) {
                return None;
            }
            rename_symbol(db, file_id, symbol_id, new_name)
        }
        ResolvedTarget::Field(field) => rename_field(db, file_id, &field, new_name),
    }
}

/// Renames a symbol by ID using semantic reference finding.
pub fn rename_symbol(
    db: &Database,
    file_id: FileId,
    symbol_id: SymbolId,
    new_name: &str,
) -> Option<RenameResult> {
    if !is_valid_identifier(new_name) {
        return None;
    }

    let symbols = db.file_symbols_with_project(file_id);
    let target_symbol = symbols.get(symbol_id)?;
    let (target_file_id, target_position) = match target_symbol.origin {
        Some(origin) => {
            let origin_symbols = db.file_symbols_with_project(origin.file_id);
            let position = origin_symbols
                .get(origin.symbol_id)
                .map(|sym| sym.range.start())
                .unwrap_or(target_symbol.range.start());
            (origin.file_id, position)
        }
        None => (file_id, target_symbol.range.start()),
    };

    let mut result = RenameResult::new();

    // Find all references across project (including declaration)
    let references = find_references(
        db,
        target_file_id,
        target_position,
        FindReferencesOptions {
            include_declaration: true,
        },
    );

    // Create edits for all references
    for reference in references {
        result.add_edit(
            reference.file_id,
            TextEdit {
                range: reference.range,
                new_text: new_name.to_string(),
            },
        );
    }

    Some(result)
}

fn rename_field(
    db: &Database,
    file_id: FileId,
    field: &FieldTarget,
    new_name: &str,
) -> Option<RenameResult> {
    if !is_valid_identifier(new_name) || is_reserved_keyword(new_name) {
        return None;
    }

    let symbols = db.file_symbols(file_id);
    if field_has_conflict(&symbols, field, new_name) {
        return None;
    }

    let references = find_references_to_field(
        db,
        file_id,
        field,
        FindReferencesOptions {
            include_declaration: true,
        },
    );

    if references.is_empty() {
        return None;
    }

    let mut result = RenameResult::new();
    for reference in references {
        result.add_edit(
            reference.file_id,
            TextEdit {
                range: reference.range,
                new_text: new_name.to_string(),
            },
        );
    }

    Some(result)
}

/// Checks if renaming a symbol to the new name would cause a conflict.
fn has_conflict(symbols: &SymbolTable, symbol_id: SymbolId, new_name: &str) -> bool {
    // Verify symbol exists
    if symbols.get(symbol_id).is_none() {
        return false;
    }

    // Find the declaring scope
    let declaring_scope = find_declaring_scope(symbols, symbol_id);

    // Check if new_name already exists in that scope
    if let Some(scope) = symbols.get_scope(declaring_scope) {
        if let Some(existing_id) = scope.lookup_local(new_name) {
            // Conflict if a different symbol has this name
            if existing_id != symbol_id {
                return true;
            }
        }
    }

    false
}

fn field_has_conflict(symbols: &SymbolTable, field: &FieldTarget, new_name: &str) -> bool {
    match symbols.type_by_id(field.type_id) {
        Some(Type::Struct { fields, .. }) => fields.iter().any(|field_def| {
            field_def.name.eq_ignore_ascii_case(new_name)
                && !field_def.name.eq_ignore_ascii_case(&field.name)
        }),
        Some(Type::Union { variants, .. }) => variants.iter().any(|variant_def| {
            variant_def.name.eq_ignore_ascii_case(new_name)
                && !variant_def.name.eq_ignore_ascii_case(&field.name)
        }),
        _ => false,
    }
}

/// Finds the scope where a symbol is declared.
fn find_declaring_scope(symbols: &SymbolTable, symbol_id: SymbolId) -> ScopeId {
    for i in 0..symbols.scope_count() {
        let scope_id = ScopeId(i as u32);
        if let Some(scope) = symbols.get_scope(scope_id) {
            if scope.symbols.values().any(|&id| id == symbol_id) {
                return scope_id;
            }
        }
    }
    ScopeId::GLOBAL
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_valid_identifier() {
        assert!(is_valid_identifier("foo"));
        assert!(is_valid_identifier("_bar"));
        assert!(is_valid_identifier("FB_Motor"));
        assert!(is_valid_identifier("x1"));

        assert!(!is_valid_identifier(""));
        assert!(!is_valid_identifier("1foo"));
        assert!(!is_valid_identifier("foo-bar"));
        assert!(!is_valid_identifier("foo bar"));
        assert!(!is_valid_identifier("A__B"));
        assert!(!is_valid_identifier("A_"));
        assert!(!is_valid_identifier("__A"));
    }

    #[test]
    fn test_reserved_keywords_rejected() {
        assert!(is_reserved_keyword("EN"));
        assert!(is_reserved_keyword("ENO"));
        assert!(is_reserved_keyword("TOD"));
        assert!(is_reserved_keyword("DT"));
        assert!(is_reserved_keyword("ANY_ELEMENTARY"));
        assert!(is_reserved_keyword("CHAR"));
    }
}
