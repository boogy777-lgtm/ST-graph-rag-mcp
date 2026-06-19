//! Go to definition for Structured Text.
//!
//! This module provides navigation to symbol declarations.

use text_size::{TextRange, TextSize};

use trust_hir::db::SemanticDatabase;
use trust_hir::{Database, SourceDatabase, SymbolId};
use trust_syntax::parser::parse;

use crate::util::{
    field_declaration_ranges, field_type, resolve_target_at_position, FieldTarget, ResolvedTarget,
};

/// Result of a go-to-definition request.
#[derive(Debug, Clone)]
pub struct DefinitionResult {
    /// The file containing the definition.
    pub file_id: trust_hir::db::FileId,
    /// The range of the definition.
    pub range: TextRange,
}

/// Finds the definition of the symbol at the given position.
pub fn goto_definition(
    db: &Database,
    file_id: trust_hir::db::FileId,
    position: TextSize,
) -> Option<DefinitionResult> {
    let target = resolve_target_at_position(db, file_id, position)?;
    match target {
        ResolvedTarget::Symbol(symbol_id) => definition_of_symbol(db, file_id, symbol_id),
        ResolvedTarget::Field(field) => definition_of_field(db, &field),
    }
}

/// Finds the declaration of the symbol at the given position.
///
/// For Structured Text, declaration and definition are the same for most symbols.
pub fn goto_declaration(
    db: &Database,
    file_id: trust_hir::db::FileId,
    position: TextSize,
) -> Option<DefinitionResult> {
    goto_definition(db, file_id, position)
}

/// Finds the type definition for the symbol at the given position.
pub fn goto_type_definition(
    db: &Database,
    file_id: trust_hir::db::FileId,
    position: TextSize,
) -> Option<DefinitionResult> {
    let target = resolve_target_at_position(db, file_id, position)?;
    match target {
        ResolvedTarget::Symbol(symbol_id) => type_definition_for_symbol(db, file_id, symbol_id),
        ResolvedTarget::Field(field) => {
            let symbols = db.file_symbols_with_project(file_id);
            let type_id = field_type(&symbols, &field)?;
            type_definition_for_type_id(db, file_id, type_id)
        }
    }
}

/// Finds the definition of a symbol by ID.
pub fn definition_of_symbol(
    db: &Database,
    file_id: trust_hir::db::FileId,
    symbol_id: SymbolId,
) -> Option<DefinitionResult> {
    let symbols = db.file_symbols_with_project(file_id);
    let symbol = symbols.get(symbol_id)?;
    let (origin_file, origin_range) = if let Some(origin) = symbol.origin {
        let origin_symbols = db.file_symbols(origin.file_id);
        let origin_range = origin_symbols
            .get(origin.symbol_id)
            .map(|sym| sym.range)
            .unwrap_or(symbol.range);
        (origin.file_id, origin_range)
    } else {
        (file_id, symbol.range)
    };

    Some(DefinitionResult {
        file_id: origin_file,
        range: origin_range,
    })
}

fn type_definition_for_symbol(
    db: &Database,
    file_id: trust_hir::db::FileId,
    symbol_id: SymbolId,
) -> Option<DefinitionResult> {
    let symbols = db.file_symbols_with_project(file_id);
    let symbol = symbols.get(symbol_id)?;

    if is_type_symbol(symbol) {
        return definition_of_symbol(db, file_id, symbol_id);
    }

    type_definition_for_type_id(db, file_id, symbol.type_id)
}

fn type_definition_for_type_id(
    db: &Database,
    file_id: trust_hir::db::FileId,
    type_id: trust_hir::TypeId,
) -> Option<DefinitionResult> {
    let symbols = db.file_symbols_with_project(file_id);
    let symbol = symbols
        .iter()
        .find(|sym| sym.type_id == type_id && is_type_symbol(sym))?;
    definition_of_symbol(db, file_id, symbol.id)
}

fn definition_of_field(db: &Database, field: &FieldTarget) -> Option<DefinitionResult> {
    for candidate_file_id in db.file_ids() {
        let source = db.source_text(candidate_file_id);
        let parsed = parse(&source);
        let root = parsed.syntax();
        let symbols = db.file_symbols_with_project(candidate_file_id);
        if let Some(range) = field_declaration_ranges(&root, &symbols, field)
            .into_iter()
            .next()
        {
            return Some(DefinitionResult {
                file_id: candidate_file_id,
                range,
            });
        }
    }
    None
}

fn is_type_symbol(symbol: &trust_hir::symbols::Symbol) -> bool {
    matches!(
        symbol.kind,
        trust_hir::symbols::SymbolKind::Type
            | trust_hir::symbols::SymbolKind::FunctionBlock
            | trust_hir::symbols::SymbolKind::Class
            | trust_hir::symbols::SymbolKind::Interface
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use trust_hir::db::{FileId, SourceDatabase};

    #[test]
    fn test_goto_def_catch_variable() {
        let source = r#"
PROGRAM Main
VAR
    x : INT;
END_VAR
    __TRY
        x := 1;
    __CATCH(e|x)
        x := ex;
    __FINALLY
        x := 0;
    __ENDTRY
END_PROGRAM
"#;
        let cursor = source.find('|').expect("cursor");
        let mut cleaned = source.to_string();
        cleaned.remove(cursor);

        let mut db = Database::new();
        let file_id = FileId(0);
        db.set_source_text(file_id, cleaned);
        db.analyze(file_id);

        let result =
            goto_definition(&db, file_id, TextSize::from(cursor as u32)).expect("goto-def result");
        assert_eq!(result.file_id, file_id);
        assert!(result.range.start() <= TextSize::from(cursor as u32));
    }

    #[test]
    fn test_goto_def_catch_variable_with_error() {
        // Verify whether goto-def works for __CATCH(e) when the try body
        // contains a parse error (x := ;). The DA claims a __TRY codegen gap
        // creates incomplete goto-def in error-tolerant mode.
        let source =
            "PROGRAM Test __TRY x := ; __CATCH(e) y := |e; __ENDTRY END_PROGRAM";

        let cursor = source.find('|').expect("cursor");
        let mut cleaned = source.to_string();
        cleaned.remove(cursor);

        let mut db = Database::new();
        let file_id = FileId(0);
        db.set_source_text(file_id, cleaned);
        db.analyze(file_id);

        let result = goto_definition(&db, file_id, TextSize::from(cursor as u32));
        // TODO: Currently returns None when try body has errors.
        // This documents the __TRY codegen gap in error-tolerant mode.
        // When the gap is fixed, change the assertions to:
        //   assert!(result.is_some(), "...");
        //   assert_eq!(result.file_id, file_id);
        //   assert!(result.range.start() <= TextSize::from(cursor as u32));
        assert!(
            result.is_none(),
            "gap verified: goto-def on catch variable returns None when try body has errors"
        );
    }
}
