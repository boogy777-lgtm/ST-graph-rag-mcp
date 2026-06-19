//! Diagnostics collection for Structured Text.
//!
//! This module provides functionality to collect and format diagnostics.

use trust_hir::db::SemanticDatabase;
use trust_hir::{Database, Diagnostic, DiagnosticSeverity};

/// Collects all diagnostics for a file.
pub fn collect_diagnostics(db: &Database, file_id: trust_hir::db::FileId) -> Vec<Diagnostic> {
    // Get diagnostics from the database
    let diagnostics = db.diagnostics(file_id);
    diagnostics.as_ref().clone()
}

/// Filters diagnostics by severity.
pub fn filter_by_severity(
    diagnostics: &[Diagnostic],
    min_severity: DiagnosticSeverity,
) -> Vec<&Diagnostic> {
    diagnostics
        .iter()
        .filter(|d| d.severity <= min_severity)
        .collect()
}

/// Returns only error diagnostics.
pub fn errors_only(diagnostics: &[Diagnostic]) -> Vec<&Diagnostic> {
    diagnostics.iter().filter(|d| d.is_error()).collect()
}

/// Returns true if there are any errors.
pub fn has_errors(diagnostics: &[Diagnostic]) -> bool {
    diagnostics.iter().any(Diagnostic::is_error)
}
