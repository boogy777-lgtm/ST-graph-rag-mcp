//! Common utilities shared across platforms.

use std::sync::OnceLock;

/// Cached page size
static PAGE_SIZE: OnceLock<usize> = OnceLock::new();

/// Get the page size for the current platform
pub fn page_size() -> usize {
    *PAGE_SIZE.get_or_init(|| {
        #[cfg(unix)]
        {
            // SAFETY: sysconf is safe to call
            unsafe {
                let size = libc::sysconf(libc::_SC_PAGESIZE);
                if size > 0 {
                    size as usize
                } else {
                    4096 // Fallback to common page size
                }
            }
        }

        #[cfg(windows)]
        {
            use windows::Win32::System::SystemInformation::{GetSystemInfo, SYSTEM_INFO};

            // SAFETY: GetSystemInfo is safe to call
            unsafe {
                let mut info: SYSTEM_INFO = std::mem::zeroed();
                GetSystemInfo(&mut info);
                info.dwPageSize as usize
            }
        }

        #[cfg(not(any(unix, windows)))]
        {
            4096 // Fallback for unsupported platforms
        }
    })
}

/// Align a size to the page boundary
pub fn align_to_page(size: usize) -> usize {
    let page = page_size();
    (size + page - 1) & !(page - 1)
}

/// Check if a size is page-aligned
pub fn is_page_aligned(size: usize) -> bool {
    size % page_size() == 0
}

/// Check if an offset is page-aligned
pub fn is_offset_aligned(offset: u64) -> bool {
    offset % page_size() as u64 == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_page_size_is_valid() {
        let ps = page_size();
        assert!(ps > 0);
        // Page size should be a power of 2
        assert_eq!(ps & (ps - 1), 0);
    }

    #[test]
    fn test_page_alignment() {
        let ps = page_size();
        assert!(is_page_aligned(ps));
        assert!(is_page_aligned(ps * 2));
        assert!(!is_page_aligned(ps + 1));
    }

    #[test]
    fn test_align_to_page() {
        let ps = page_size();
        assert_eq!(align_to_page(1), ps);
        assert_eq!(align_to_page(ps), ps);
        assert_eq!(align_to_page(ps + 1), ps * 2);
    }

    #[test]
    fn test_offset_alignment() {
        let ps = page_size();
        assert!(is_offset_aligned(0));
        assert!(is_offset_aligned(ps as u64));
        assert!(!is_offset_aligned(1));
    }
}
