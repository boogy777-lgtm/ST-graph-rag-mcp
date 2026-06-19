//! Test helpers shared across LSP unit tests.

use std::sync::{Arc, Mutex};
use tower_lsp::{Client, LanguageServer, LspService};

pub(crate) fn test_client() -> Client {
    struct DummyServer;

    #[tower_lsp::async_trait]
    impl LanguageServer for DummyServer {
        async fn initialize(
            &self,
            _: tower_lsp::lsp_types::InitializeParams,
        ) -> tower_lsp::jsonrpc::Result<tower_lsp::lsp_types::InitializeResult> {
            Ok(tower_lsp::lsp_types::InitializeResult::default())
        }

        async fn shutdown(&self) -> tower_lsp::jsonrpc::Result<()> {
            Ok(())
        }
    }

    let captured = Arc::new(Mutex::new(None));
    let captured_clone = captured.clone();
    let (_service, socket) = LspService::new(move |client| {
        *captured_clone.lock().expect("lock test client") = Some(client.clone());
        DummyServer
    });
    drop(socket);

    let client = captured
        .lock()
        .expect("lock test client")
        .take()
        .expect("test client");
    client
}
