//! # mmap-rs — Modern Memory-Mapped File Library for Rust
//!
//! A safe, performant, and ergonomic memory-mapped file I/O library that leverages
//! modern Rust features and OS capabilities.
//!
//! ## Features
//!
//! - **Safe by default**: Zero `unsafe` in public API
//! - **Cross-platform**: Full Linux/Windows/macOS/BSD support
//! - **Type-safe builders**: Compile-time validation
//! - **Modern Rust**: Edition 2021+, MSRV 1.70
//! - **High performance**: Zero-cost abstractions, huge pages, prefaulting
//!
//! ## Quick Start
//!
//! ```ignore
//! // TODO: This example will work once Phase 1 is complete
//! use mmap_rs::MmapOptions;
//!
//! // Read-only mapping
//! let mmap = MmapOptions::new()
//!     .path("data.bin")
//!     .map_readonly()?;
//!
//! let data: &[u8] = &mmap;
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```
//!
//! ## Safety
//!
//! All public APIs are 100% safe Rust. Internal platform-specific code uses
//! `unsafe` but is carefully audited and documented.

#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![deny(unsafe_op_in_unsafe_fn)]

// Public modules
mod advice;
mod builder;
pub mod error;
mod file_lock;
mod huge_pages;
mod mmap;
mod protection;
mod slice;

#[cfg(feature = "numa")]
pub mod numa;

#[cfg(feature = "async")]
mod async_mmap;

// Platform-specific implementation
pub mod platform;

// Re-exports for public API
pub use advice::MemoryAdvice;
pub use builder::{HasPath, MmapOptions, NoPath};
pub use error::MmapError;
pub use file_lock::{FileLock, LockType};
pub use huge_pages::HugePageSize;
pub use mmap::{CopyOnWrite, Mmap, ReadOnly, ReadWrite};
pub use protection::Protection;
pub use slice::MmapSlice;

#[cfg(unix)]
pub use platform::MappingMode;

#[cfg(feature = "async")]
pub use async_mmap::AsyncMmap;

/// Result type alias for mmap operations
pub type Result<T> = std::result::Result<T, MmapError>;
