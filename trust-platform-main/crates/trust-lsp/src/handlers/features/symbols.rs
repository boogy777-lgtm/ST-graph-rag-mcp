use tower_lsp::lsp_types::*;
use tower_lsp::Client;

use crate::state::ServerState;

pub fn document_symbol(
    state: &ServerState,
    params: DocumentSymbolParams,
) -> Option<DocumentSymbolResponse> {
    super::core_impl::document_symbol(state, params)
}

#[cfg(test)]
pub fn workspace_symbol(
    state: &ServerState,
    params: WorkspaceSymbolParams,
) -> Option<Vec<SymbolInformation>> {
    super::core_impl::workspace_symbol(state, params)
}

pub async fn workspace_symbol_with_progress(
    client: &Client,
    state: &ServerState,
    params: WorkspaceSymbolParams,
) -> Option<Vec<SymbolInformation>> {
    super::core_impl::workspace_symbol_with_progress(client, state, params).await
}

pub fn semantic_tokens_full(
    state: &ServerState,
    params: SemanticTokensParams,
) -> Option<SemanticTokensResult> {
    super::core_impl::semantic_tokens_full(state, params)
}

pub fn semantic_tokens_full_delta(
    state: &ServerState,
    params: SemanticTokensDeltaParams,
) -> Option<SemanticTokensFullDeltaResult> {
    super::core_impl::semantic_tokens_full_delta(state, params)
}

pub fn semantic_tokens_range(
    state: &ServerState,
    params: SemanticTokensRangeParams,
) -> Option<SemanticTokensRangeResult> {
    super::core_impl::semantic_tokens_range(state, params)
}

pub fn folding_range(state: &ServerState, params: FoldingRangeParams) -> Option<Vec<FoldingRange>> {
    super::core_impl::folding_range(state, params)
}
