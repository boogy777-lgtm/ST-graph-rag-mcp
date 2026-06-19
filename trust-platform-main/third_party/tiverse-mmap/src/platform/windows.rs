//! Windows-specific memory mapping implementation.

use crate::huge_pages::HugePageSize;
use crate::protection::Protection;
use crate::{MmapError, Result};
use std::fs::File;
use std::os::windows::io::AsRawHandle;
use std::ptr;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Memory::{
    CreateFileMappingW, MapViewOfFile, UnmapViewOfFile, VirtualAlloc, FILE_MAP, FILE_MAP_EXECUTE,
    FILE_MAP_READ, FILE_MAP_WRITE, MEM_COMMIT, MEM_LARGE_PAGES, MEM_RESERVE, PAGE_EXECUTE_READ,
    PAGE_PROTECTION_FLAGS, PAGE_READONLY, PAGE_READWRITE,
};

/// Platform-specific mapping handle
pub struct PlatformMmap {
    ptr: *mut u8,
    len: usize,
    file_mapping: HANDLE,
}

impl PlatformMmap {
    /// Create a new memory mapping (Windows implementation)
    pub fn new(file: &File, offset: u64, len: usize, protection: Protection) -> Result<Self> {
        if len == 0 {
            return Err(MmapError::InvalidConfiguration(
                "Mapping length cannot be zero".to_string(),
            ));
        }

        // Convert protection flags to Windows page protection
        let page_protection = Self::protection_to_windows_page(protection);

        // Create file mapping object
        // SAFETY: We're calling CreateFileMappingW with:
        // - Valid file handle
        // - NULL security attributes (default)
        // - Valid page protection flags
        // - Maximum size (0 = use file size)
        // - NULL name (anonymous mapping object)
        let file_mapping = unsafe {
            CreateFileMappingW(
                HANDLE(file.as_raw_handle() as isize),
                None,
                PAGE_PROTECTION_FLAGS(page_protection),
                0,    // dwMaximumSizeHigh
                0,    // dwMaximumSizeLow (0 = use file size)
                None, // lpName
            )
            .map_err(|e| MmapError::MappingFailed(format!("CreateFileMappingW failed: {:?}", e)))?
        };

        // Map view of file
        let desired_access = Self::protection_to_windows_access(protection);

        // SAFETY: We're calling MapViewOfFile with:
        // - Valid file mapping handle
        // - Valid access flags
        // - Valid offset
        // - Valid length
        let ptr = unsafe {
            MapViewOfFile(
                file_mapping,
                FILE_MAP(desired_access),
                (offset >> 32) as u32,        // dwFileOffsetHigh
                (offset & 0xFFFFFFFF) as u32, // dwFileOffsetLow
                len,
            )
        };

        if ptr.Value.is_null() {
            // Clean up file mapping handle
            unsafe {
                let _ = CloseHandle(file_mapping);
            }
            return Err(MmapError::MappingFailed("MapViewOfFile failed".to_string()));
        }

        Ok(Self {
            ptr: ptr.Value as *mut u8,
            len,
            file_mapping,
        })
    }

    /// Convert Protection to Windows page protection flags
    fn protection_to_windows_page(protection: Protection) -> u32 {
        if protection.can_execute() {
            if protection.can_write() {
                // Execute + Write + Read
                0x40 // PAGE_EXECUTE_READWRITE
            } else if protection.can_read() {
                PAGE_EXECUTE_READ.0
            } else {
                0x10 // PAGE_EXECUTE
            }
        } else if protection.can_write() {
            PAGE_READWRITE.0
        } else if protection.can_read() {
            PAGE_READONLY.0
        } else {
            0x01 // PAGE_NOACCESS
        }
    }

    /// Convert Protection to Windows file mapping access flags
    fn protection_to_windows_access(protection: Protection) -> u32 {
        let mut access = 0;

        if protection.can_read() {
            access |= FILE_MAP_READ.0;
        }
        if protection.can_write() {
            access |= FILE_MAP_WRITE.0;
        }
        if protection.can_execute() {
            access |= FILE_MAP_EXECUTE.0;
        }

        access
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

    /// Check if file has been truncated (Windows stub)
    ///
    /// Windows handles file truncation differently than Unix.
    /// This is a compatibility stub that always returns Ok.
    pub fn check_truncation(&self, _file: &File) -> Result<()> {
        // Windows file mappings maintain references to the file
        // and handle truncation internally
        Ok(())
    }

    /// Create an anonymous memory mapping (not backed by a file)
    pub fn new_anonymous(len: usize, protection: Protection) -> Result<Self> {
        if len == 0 {
            return Err(MmapError::InvalidConfiguration(
                "Mapping length cannot be zero".to_string(),
            ));
        }

        // Convert protection for VirtualAlloc
        let page_protection = Self::protection_to_windows_page(protection);

        // SAFETY: Calling VirtualAlloc with:
        // - NULL address (let OS choose)
        // - Valid length
        // - MEM_COMMIT | MEM_RESERVE
        // - Valid page protection
        let ptr = unsafe {
            VirtualAlloc(
                None,
                len,
                MEM_COMMIT | MEM_RESERVE,
                PAGE_PROTECTION_FLAGS(page_protection),
            )
        };

        if ptr.is_null() {
            return Err(MmapError::MappingFailed(
                "VirtualAlloc failed for anonymous mapping".to_string(),
            ));
        }

        Ok(Self {
            ptr: ptr as *mut u8,
            len,
            file_mapping: HANDLE(0), // No file mapping for anonymous
        })
    }

    /// Apply memory advice hints (Windows implementation)
    pub fn advise(&self, _advice: crate::advice::MemoryAdvice) -> Result<()> {
        // Windows doesn't have a direct equivalent to madvise
        // We could use PrefetchVirtualMemory for WillNeed, but keeping it simple for now
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

    /// Create file-backed mapping with huge pages (Windows)
    pub fn new_huge(
        file: &File,
        offset: u64,
        len: usize,
        protection: Protection,
        _huge_page_size: HugePageSize,
    ) -> Result<Self> {
        // Windows doesn't support huge pages for file-backed mappings well
        // Fall back to regular mapping
        Self::new(file, offset, len, protection)
    }

    /// Create anonymous mapping with huge pages (Windows)
    pub fn new_anonymous_huge(
        len: usize,
        protection: Protection,
        _huge_page_size: HugePageSize,
    ) -> Result<Self> {
        if len == 0 {
            return Err(MmapError::InvalidConfiguration(
                "Mapping length cannot be zero".to_string(),
            ));
        }

        let page_protection = Self::protection_to_windows_page(protection);

        // Try with MEM_LARGE_PAGES (requires SeLockMemoryPrivilege)
        // SAFETY: Calling VirtualAlloc with large pages
        let ptr = unsafe {
            VirtualAlloc(
                None,
                len,
                MEM_COMMIT | MEM_RESERVE | MEM_LARGE_PAGES,
                PAGE_PROTECTION_FLAGS(page_protection),
            )
        };

        if ptr.is_null() {
            // Fall back to regular allocation if large pages unavailable
            return Self::new_anonymous(len, protection);
        }

        Ok(Self {
            ptr: ptr as *mut u8,
            len,
            file_mapping: HANDLE(0),
        })
    }

    /// Resize the mapping (Windows - not supported)
    pub fn resize(&mut self, _new_size: usize) -> Result<()> {
        // Windows doesn't have an equivalent to mremap
        // Would need to unmap and remap, but we don't have file handle
        Err(MmapError::InvalidConfiguration(
            "Resize not supported on Windows".to_string(),
        ))
    }
}

impl Drop for PlatformMmap {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            // SAFETY: We're unmapping memory that was successfully mapped.
            // - ptr was returned by a successful MapViewOfFile call
            unsafe {
                let result =
                    UnmapViewOfFile(windows::Win32::System::Memory::MEMORY_MAPPED_VIEW_ADDRESS {
                        Value: self.ptr as *mut _,
                    });
                if result.is_err() {
                    eprintln!("Warning: UnmapViewOfFile failed");
                }
            }
        }

        // Close file mapping handle
        if !self.file_mapping.is_invalid() {
            unsafe {
                let _ = CloseHandle(self.file_mapping);
            }
        }
    }
}

// SAFETY: PlatformMmap can be sent between threads
unsafe impl Send for PlatformMmap {}

// Note: Not implementing Sync - requires separate consideration for thread-safety
