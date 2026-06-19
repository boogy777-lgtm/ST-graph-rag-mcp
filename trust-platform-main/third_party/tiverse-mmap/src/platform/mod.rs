//! Platform-specific memory mapping implementations.

// Platform-specific modules
#[cfg(unix)]
mod unix;

#[cfg(windows)]
mod windows;

mod common;

// Re-export platform-specific implementation
#[cfg(unix)]
pub use unix::*;

#[cfg(windows)]
pub use windows::*;

pub use common::*;
