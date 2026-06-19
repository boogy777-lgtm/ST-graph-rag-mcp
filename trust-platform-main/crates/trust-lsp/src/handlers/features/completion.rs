use tower_lsp::lsp_types::*;

use crate::state::ServerState;

pub fn hover(state: &ServerState, params: HoverParams) -> Option<Hover> {
    super::core_impl::hover(state, params)
}

pub fn completion(state: &ServerState, params: CompletionParams) -> Option<CompletionResponse> {
    super::core_impl::completion(state, params)
}

#[cfg(test)]
pub(crate) fn completion_with_ticket_for_tests(
    state: &ServerState,
    params: CompletionParams,
    request_ticket: u64,
) -> Option<CompletionResponse> {
    super::core_impl::completion_with_ticket_for_tests(state, params, request_ticket)
}

pub fn completion_resolve(state: &ServerState, item: CompletionItem) -> CompletionItem {
    super::core_impl::completion_resolve(state, item)
}

pub fn signature_help(state: &ServerState, params: SignatureHelpParams) -> Option<SignatureHelp> {
    super::core_impl::signature_help(state, params)
}

pub fn linked_editing_range(
    state: &ServerState,
    params: LinkedEditingRangeParams,
) -> Option<LinkedEditingRanges> {
    super::core_impl::linked_editing_range(state, params)
}

pub fn inlay_hint(state: &ServerState, params: InlayHintParams) -> Option<Vec<InlayHint>> {
    super::core_impl::inlay_hint(state, params)
}
