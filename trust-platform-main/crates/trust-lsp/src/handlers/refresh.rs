//! Workspace refresh helpers for pull diagnostics and semantic tokens.

use tower_lsp::lsp_types::request::{SemanticTokensRefresh, WorkspaceDiagnosticRefresh};
use tower_lsp::Client;

use super::diagnostics::publish_diagnostics;
use crate::state::ServerState;

pub async fn refresh_diagnostics(client: &Client, state: &ServerState) {
    if state.use_pull_diagnostics() {
        let _ = client.send_request::<WorkspaceDiagnosticRefresh>(()).await;
        return;
    }

    for doc in state.documents() {
        if doc.is_open {
            publish_diagnostics(client, state, &doc.uri, &doc.content, doc.file_id).await;
        }
    }
}

pub async fn refresh_semantic_tokens(client: &Client, state: &ServerState) {
    if !state.semantic_tokens_refresh_supported() {
        return;
    }
    let _ = client.send_request::<SemanticTokensRefresh>(()).await;
}
