//! LSP language feature handlers grouped by capability.

mod actions;
mod completion;
mod core;
mod core_impl;
mod hierarchy;
mod inline_values;
mod links;
mod navigation;
mod symbols;

pub use core::{
    code_action, code_lens, completion, completion_resolve, document_highlight, document_link,
    document_symbol, folding_range, goto_declaration, goto_definition, goto_implementation,
    goto_type_definition, hover, incoming_calls, inlay_hint, inline_value, linked_editing_range,
    outgoing_calls, prepare_call_hierarchy, prepare_rename, prepare_type_hierarchy,
    references_with_progress, rename, selection_range, semantic_tokens_full,
    semantic_tokens_full_delta, semantic_tokens_range, signature_help, type_hierarchy_subtypes,
    type_hierarchy_supertypes, workspace_symbol_with_progress,
};

#[cfg(test)]
pub(crate) use core::completion_with_ticket_for_tests;
#[cfg(test)]
pub use core::references;
#[cfg(test)]
pub use core::workspace_symbol;
