//! Facade exports for feature handlers.

pub use super::actions::{code_action, code_lens};
pub use super::completion::{
    completion, completion_resolve, hover, inlay_hint, linked_editing_range, signature_help,
};
pub use super::hierarchy::{
    incoming_calls, outgoing_calls, prepare_call_hierarchy, prepare_type_hierarchy,
    type_hierarchy_subtypes, type_hierarchy_supertypes,
};
pub use super::inline_values::inline_value;
pub use super::links::document_link;
pub use super::navigation::{
    document_highlight, goto_declaration, goto_definition, goto_implementation,
    goto_type_definition, prepare_rename, references_with_progress, rename, selection_range,
};
pub use super::symbols::{
    document_symbol, folding_range, semantic_tokens_full, semantic_tokens_full_delta,
    semantic_tokens_range, workspace_symbol_with_progress,
};

#[cfg(test)]
pub(crate) use super::completion::completion_with_ticket_for_tests;
#[cfg(test)]
pub use super::navigation::references;
#[cfg(test)]
pub use super::symbols::workspace_symbol;
