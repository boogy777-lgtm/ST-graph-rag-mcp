//! Huge page support for better TLB performance.
//!
//! Huge pages (also called large pages or superpages) reduce TLB pressure
//! by using larger page sizes (2MB or 1GB instead of 4KB).

/// Huge page size options.
///
/// # Platform Support
///
/// - **Linux**: Full support via `MAP_HUGETLB`
/// - **Windows**: Full support via `MEM_LARGE_PAGES`
/// - **macOS**: Limited support via superpage hints
///
/// # Examples
///
/// ```ignore
/// use mmap_rs::{MmapOptions, HugePageSize};
///
/// let mmap = MmapOptions::new()
///     .path("large_dataset.bin")
///     .huge_pages(HugePageSize::Size2MB)
///     .map_readonly()?;
/// # Ok::<(), mmap_rs::MmapError>(())
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HugePageSize {
    /// 2 MB pages (most common)
    ///
    /// - Linux: Requires 2MB huge pages configured
    /// - Windows: Requires "Lock pages in memory" privilege
    /// - macOS: Best-effort superpage allocation
    Size2MB,

    /// 1 GB pages (for very large datasets)
    ///
    /// - Linux: Requires 1GB huge pages configured
    /// - Windows: Not supported
    /// - macOS: Not supported
    Size1GB,
}

impl HugePageSize {
    /// Get the size in bytes
    pub const fn size_bytes(self) -> usize {
        match self {
            Self::Size2MB => 2 * 1024 * 1024,
            Self::Size1GB => 1024 * 1024 * 1024,
        }
    }

    /// Convert to Linux MAP_HUGE_* flags
    #[cfg(target_os = "linux")]
    pub(crate) fn to_linux_flags(self) -> libc::c_int {
        match self {
            Self::Size2MB => libc::MAP_HUGE_2MB,
            Self::Size1GB => libc::MAP_HUGE_1GB,
        }
    }

}

impl Default for HugePageSize {
    fn default() -> Self {
        Self::Size2MB
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_huge_page_sizes() {
        assert_eq!(HugePageSize::Size2MB.size_bytes(), 2 * 1024 * 1024);
        assert_eq!(HugePageSize::Size1GB.size_bytes(), 1024 * 1024 * 1024);
    }

    #[test]
    fn test_default() {
        assert_eq!(HugePageSize::default(), HugePageSize::Size2MB);
    }
}
