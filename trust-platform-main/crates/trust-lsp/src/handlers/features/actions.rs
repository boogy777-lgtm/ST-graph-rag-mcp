use tower_lsp::lsp_types::*;

use crate::state::ServerState;

pub fn code_action(state: &ServerState, params: CodeActionParams) -> Option<CodeActionResponse> {
    super::core_impl::code_action(state, params)
}

pub fn code_lens(state: &ServerState, params: CodeLensParams) -> Option<Vec<CodeLens>> {
    super::core_impl::code_lens(state, params)
}
