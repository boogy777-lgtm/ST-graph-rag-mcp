//! Memory access pattern advice hints for optimization.

/// Memory advice hints to optimize I/O performance.
///
/// These hints inform the OS about expected memory access patterns,
/// allowing it to optimize page caching and prefetching strategies.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemoryAdvice {
    /// Normal access pattern (default)
    Normal,

    /// Expect random access
    Random,

    /// Expect sequential access
    Sequential,

    /// Will need these pages soon
    WillNeed,

    /// Won't need these pages
    DontNeed,
}

impl MemoryAdvice {
    /// Convert to platform-specific value for madvise() calls
    #[cfg(unix)]
    pub(crate) fn to_unix_advice(self) -> libc::c_int {
        match self {
            Self::Normal => libc::MADV_NORMAL,
            Self::Random => libc::MADV_RANDOM,
            Self::Sequential => libc::MADV_SEQUENTIAL,
            Self::WillNeed => libc::MADV_WILLNEED,
            Self::DontNeed => libc::MADV_DONTNEED,
        }
    }
}

impl Default for MemoryAdvice {
    fn default() -> Self {
        Self::Normal
    }
}
