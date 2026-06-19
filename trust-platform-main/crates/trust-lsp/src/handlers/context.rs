//! Shared handler context abstraction.

use text_size::TextSize;
use tower_lsp::lsp_types::Url;

use crate::config::ProjectConfig;
use crate::state::{Document, ServerState};
use trust_hir::db::FileId;
use trust_ide::rename::RenameResult;

/// Minimal state surface needed by command handlers.
pub(crate) trait ServerContext {
    fn workspace_configs(&self) -> Vec<(Url, ProjectConfig)>;
    fn workspace_config_for_uri(&self, uri: &Url) -> Option<ProjectConfig>;
    fn workspace_folders(&self) -> Vec<Url>;
    fn get_document(&self, uri: &Url) -> Option<Document>;
    fn document_for_file_id(&self, file_id: FileId) -> Option<Document>;
    fn rename(&self, file_id: FileId, offset: TextSize, new_name: &str) -> Option<RenameResult>;
}

impl ServerContext for ServerState {
    fn workspace_configs(&self) -> Vec<(Url, ProjectConfig)> {
        self.workspace_configs()
    }

    fn workspace_config_for_uri(&self, uri: &Url) -> Option<ProjectConfig> {
        self.workspace_config_for_uri(uri)
    }

    fn workspace_folders(&self) -> Vec<Url> {
        self.workspace_folders()
    }

    fn get_document(&self, uri: &Url) -> Option<Document> {
        self.get_document(uri)
    }

    fn document_for_file_id(&self, file_id: FileId) -> Option<Document> {
        self.document_for_file_id(file_id)
    }

    fn rename(&self, file_id: FileId, offset: TextSize, new_name: &str) -> Option<RenameResult> {
        self.with_database(|db| trust_ide::rename(db, file_id, offset, new_name))
    }
}
