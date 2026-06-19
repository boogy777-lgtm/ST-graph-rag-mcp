//! Error types for mmap operations.

use std::path::PathBuf;

/// Errors that can occur during memory-mapped file operations.
#[derive(Debug, thiserror::Error)]
pub enum MmapError {
    /// Failed to open file
    #[error("Failed to open file: {0}")]
    FileOpen(#[from] std::io::Error),

    /// Invalid alignment
    #[error("Invalid alignment: size {size} not aligned to {alignment}")]
    InvalidAlignment {
        /// The size that failed alignment
        size: usize,
        /// The required alignment
        alignment: usize,
    },

    /// Permission denied for operation
    #[error("Permission denied for {operation}")]
    PermissionDenied {
        /// Description of the operation that was denied
        operation: String,
    },

    /// Huge pages not supported on this platform
    #[error("Huge pages not supported on this platform")]
    HugePagesUnsupported,

    /// Address space exhausted
    #[error("Address space exhausted")]
    OutOfMemory,

    /// File was truncated while mapped
    #[error("File truncated while mapped: {0}")]
    FileTruncated(PathBuf),

    /// Invalid mapping configuration
    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),

    /// Platform-specific system error
    #[error("System error: {0}")]
    SystemError(String),

    /// Mapping failed
    #[error("Mapping failed: {0}")]
    MappingFailed(String),
}

// Allow conversion from io::Error
impl From<MmapError> for std::io::Error {
    fn from(err: MmapError) -> Self {
        match err {
            MmapError::FileOpen(e) => e,
            other => std::io::Error::new(std::io::ErrorKind::Other, other),
        }
    }
}
