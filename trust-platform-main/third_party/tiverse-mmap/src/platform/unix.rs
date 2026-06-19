//! Unix-specific memory mapping implementation (Linux, macOS, BSD).

use crate::huge_pages::HugePageSize;
use crate::protection::Protection;
use crate::{MmapError, Result};
use std::fs::File;
use std::os::unix::io::AsRawFd;
use std::ptr;

/// Mapping mode flags
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MappingMode {
    /// Shared mapping - changes are visible to other processes and written to file
    Shared,
    /// Private mapping - changes are copy-on-write and not written to file
    Private,
}

/// Platform-specific mapping handle
pub struct PlatformMmap {
    ptr: *mut u8,
    len: usize,
    file_len: Option<u64>, // Track original file length for truncation detection
    mode: MappingMode,
}

impl PlatformMmap {
    /// Create a new memory mapping (Unix implementation)
    pub fn new(
        file: &File,
        offset: u64,
        len: usize,
        protection: Protection,
        mode: MappingMode,
    ) -> Result<Self> {
        if len == 0 {
            return Err(MmapError::InvalidConfiguration(
                "Mapping length cannot be zero".to_string(),
            ));
        }

        // Validate file size before mapping to prevent SIGBUS
        let file_metadata = file.metadata()?;
        let file_size = file_metadata.len();

        if offset + len as u64 > file_size {
            return Err(MmapError::InvalidConfiguration(format!(
                "Mapping extends beyond file size: offset {} + len {} > file size {}",
                offset, len, file_size
            )));
        }

        // Convert protection flags to Unix mmap protection
        let prot = Self::protection_to_unix(protection);

        // Use appropriate mapping mode
        let flags = match mode {
            MappingMode::Shared => libc::MAP_SHARED,
            MappingMode::Private => libc::MAP_PRIVATE,
        };

        // SAFETY: We're calling mmap with validated parameters:
        // - addr is NULL (let kernel choose address)
        // - len is non-zero and validated
        // - prot is valid protection flags
        // - flags is valid mapping flags
        // - fd is a valid file descriptor
        // - offset is provided by caller
        let ptr = unsafe {
            libc::mmap(
                ptr::null_mut(),
                len,
                prot,
                flags,
                file.as_raw_fd(),
                offset as libc::off_t,
            )
        };

        // Check for mmap failure
        if ptr == libc::MAP_FAILED {
            let err = std::io::Error::last_os_error();
            return Err(MmapError::MappingFailed(format!("mmap failed: {}", err)));
        }

        Ok(Self {
            ptr: ptr as *mut u8,
            len,
            file_len: Some(file_size),
            mode,
        })
    }

    /// Convert Protection to Unix mmap protection flags
    fn protection_to_unix(protection: Protection) -> libc::c_int {
        let mut prot = libc::PROT_NONE;

        if protection.can_read() {
            prot |= libc::PROT_READ;
        }
        if protection.can_write() {
            prot |= libc::PROT_WRITE;
        }
        if protection.can_execute() {
            prot |= libc::PROT_EXEC;
        }

        prot
    }

    /// Get the pointer to mapped memory
    pub fn as_ptr(&self) -> *const u8 {
        self.ptr
    }

    /// Get a mutable pointer to mapped memory
    pub fn as_mut_ptr(&mut self) -> *mut u8 {
        self.ptr
    }

    /// Get the length of the mapping
    pub fn len(&self) -> usize {
        self.len
    }

    /// Check if the mapping is empty
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Check if file has been truncated (for SIGBUS safety)
    pub fn check_truncation(&self, file: &File) -> Result<()> {
        if let Some(original_len) = self.file_len {
            let current_len = file.metadata()?.len();
            if current_len < original_len {
                return Err(MmapError::FileTruncated(std::path::PathBuf::from(
                    "file truncated",
                )));
            }
        }
        Ok(())
    }

    /// Get the mapping mode
    pub fn mode(&self) -> MappingMode {
        self.mode
    }

    /// Create an anonymous memory mapping (not backed by a file)
    pub fn new_anonymous(len: usize, protection: Protection) -> Result<Self> {
        if len == 0 {
            return Err(MmapError::InvalidConfiguration(
                "Mapping length cannot be zero".to_string(),
            ));
        }

        // Convert protection flags
        let prot = Self::protection_to_unix(protection);

        // Anonymous mapping flags
        let flags = libc::MAP_PRIVATE | libc::MAP_ANONYMOUS;

        // SAFETY: Creating anonymous mapping:
        // - addr is NULL (let kernel choose)
        // - len is non-zero and validated
        // - prot is valid
        // - flags include MAP_ANONYMOUS
        // - fd is -1 (required for anonymous)
        // - offset is 0
        let ptr = unsafe { libc::mmap(ptr::null_mut(), len, prot, flags, -1, 0) };

        if ptr == libc::MAP_FAILED {
            let err = std::io::Error::last_os_error();
            return Err(MmapError::MappingFailed(format!(
                "Anonymous mmap failed: {}",
                err
            )));
        }

        Ok(Self {
            ptr: ptr as *mut u8,
            len,
            file_len: None,             // Anonymous mappings don't have file backing
            mode: MappingMode::Private, // Anonymous mappings are always private
        })
    }

    /// Apply memory advice hints
    pub fn advise(&self, advice: crate::advice::MemoryAdvice) -> Result<()> {
        if self.len == 0 {
            return Ok(()); // No-op for empty mappings
        }

        let advice_flag = advice.to_unix_advice();

        // SAFETY: Calling madvise with:
        // - Valid pointer from successful mmap
        // - Valid length
        // - Valid advice flag
        let result = unsafe { libc::madvise(self.ptr as *mut libc::c_void, self.len, advice_flag) };

        if result != 0 {
            let err = std::io::Error::last_os_error();
            return Err(MmapError::SystemError(format!("madvise failed: {}", err)));
        }

        Ok(())
    }

    /// Prefault pages into memory
    pub fn prefault(&self) -> Result<()> {
        if self.len == 0 {
            return Ok(());
        }

        // Touch each page to fault it in
        let page_size = super::page_size();

        // SAFETY: Reading from valid mapped memory
        unsafe {
            let mut offset = 0;
            while offset < self.len {
                // Volatile read to prevent optimization
                ptr::read_volatile(self.ptr.add(offset));
                offset += page_size;
            }
        }

        Ok(())
    }

    /// Create a file-backed mapping with huge pages
    #[cfg(target_os = "linux")]
    pub fn new_huge(
        file: &File,
        offset: u64,
        len: usize,
        protection: Protection,
        huge_page_size: HugePageSize,
    ) -> Result<Self> {
        if len == 0 {
            return Err(MmapError::InvalidConfiguration(
                "Mapping length cannot be zero".to_string(),
            ));
        }

        let prot = Self::protection_to_unix(protection);
        let flags = libc::MAP_SHARED | libc::MAP_HUGETLB | huge_page_size.to_linux_flags();

        // SAFETY: mmap with huge pages
        let ptr = unsafe {
            libc::mmap(
                ptr::null_mut(),
                len,
                prot,
                flags,
                file.as_raw_fd(),
                offset as libc::off_t,
            )
        };

        if ptr == libc::MAP_FAILED {
            let err = std::io::Error::last_os_error();
            return Err(MmapError::MappingFailed(format!(
                "mmap with huge pages failed: {} (check /proc/sys/vm/nr_hugepages)",
                err
            )));
        }

        // Validate file size before mapping
        let file_metadata = file.metadata()?;
        let file_size = file_metadata.len();

        if offset + len as u64 > file_size {
            return Err(MmapError::InvalidConfiguration(format!(
                "Mapping extends beyond file size: offset {} + len {} > file size {}",
                offset, len, file_size
            )));
        }

        Ok(Self {
            ptr: ptr as *mut u8,
            len,
            file_len: Some(file_size),
            mode: MappingMode::Shared,
        })
    }

    /// Create a file-backed mapping with huge pages (non-Linux fallback)
    #[cfg(not(target_os = "linux"))]
    pub fn new_huge(
        file: &File,
        offset: u64,
        len: usize,
        protection: Protection,
        _huge_page_size: HugePageSize,
    ) -> Result<Self> {
        // Fallback: try regular mmap with MADV_HUGEPAGE hint
        let mmap = Self::new(file, offset, len, protection, MappingMode::Shared)?;

        #[cfg(target_os = "macos")]
        {
            // macOS: Try superpage allocation (best effort)
            unsafe {
                let _ = libc::madvise(
                    mmap.ptr as *mut libc::c_void,
                    mmap.len,
                    0x00000001, // MADV_HUGEPAGE equivalent
                );
            }
        }

        Ok(mmap)
    }

    /// Create anonymous mapping with huge pages
    #[cfg(target_os = "linux")]
    pub fn new_anonymous_huge(
        len: usize,
        protection: Protection,
        huge_page_size: HugePageSize,
    ) -> Result<Self> {
        if len == 0 {
            return Err(MmapError::InvalidConfiguration(
                "Mapping length cannot be zero".to_string(),
            ));
        }

        let prot = Self::protection_to_unix(protection);
        let flags = libc::MAP_PRIVATE
            | libc::MAP_ANONYMOUS
            | libc::MAP_HUGETLB
            | huge_page_size.to_linux_flags();

        // SAFETY: Anonymous mapping with huge pages
        let ptr = unsafe { libc::mmap(ptr::null_mut(), len, prot, flags, -1, 0) };

        if ptr == libc::MAP_FAILED {
            return Err(MmapError::HugePagesUnsupported);
        }

        Ok(Self {
            ptr: ptr as *mut u8,
            len,
            file_len: None,
            mode: MappingMode::Private,
        })
    }

    /// Create anonymous mapping with huge pages (non-Linux fallback)
    #[cfg(not(target_os = "linux"))]
    pub fn new_anonymous_huge(
        len: usize,
        protection: Protection,
        _huge_page_size: HugePageSize,
    ) -> Result<Self> {
        // Fallback: try regular anonymous with hint
        let mmap = Self::new_anonymous(len, protection)?;
        Ok(mmap)
    }

    /// Resize the mapping (Linux mremap implementation)
    #[cfg(target_os = "linux")]
    pub fn resize(&mut self, new_size: usize) -> Result<()> {
        if new_size == 0 {
            return Err(MmapError::InvalidConfiguration(
                "Cannot resize to zero".to_string(),
            ));
        }

        if new_size == self.len {
            return Ok(()); // No-op
        }

        // SAFETY: Using mremap to resize the mapping
        // - ptr is valid from successful mmap
        // - old_size matches original mapping
        // - new_size is validated
        // - MREMAP_MAYMOVE allows kernel to relocate if needed
        let new_ptr = unsafe {
            libc::mremap(
                self.ptr as *mut libc::c_void,
                self.len,
                new_size,
                libc::MREMAP_MAYMOVE,
            )
        };

        if new_ptr == libc::MAP_FAILED {
            let err = std::io::Error::last_os_error();
            return Err(MmapError::SystemError(format!("mremap failed: {}", err)));
        }

        self.ptr = new_ptr as *mut u8;
        self.len = new_size;
        Ok(())
    }

    /// Resize the mapping (non-Linux fallback)
    #[cfg(not(target_os = "linux"))]
    pub fn resize(&mut self, _new_size: usize) -> Result<()> {
        // mremap not available on non-Linux platforms
        // Would need to unmap and remap, but we don't have file handle
        Err(MmapError::InvalidConfiguration(
            "Resize not supported on this platform".to_string(),
        ))
    }
}

impl Drop for PlatformMmap {
    fn drop(&mut self) {
        if !self.ptr.is_null() && self.len > 0 {
            // SAFETY: We're unmapping memory that was successfully mapped.
            // - ptr was returned by a successful mmap call
            // - len matches the original mmap call
            // - We ensure this is only called once (ptr is not Copy)
            unsafe {
                let result = libc::munmap(self.ptr as *mut libc::c_void, self.len);
                if result != 0 {
                    // Log error but don't panic in Drop
                    eprintln!(
                        "Warning: munmap failed: {}",
                        std::io::Error::last_os_error()
                    );
                }
            }
        }
    }
}

// SAFETY: PlatformMmap can be sent between threads
unsafe impl Send for PlatformMmap {}

// Note: Not implementing Sync - requires separate consideration for thread-safety
