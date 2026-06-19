//! Type-safe builder for memory-mapped file operations.

use std::marker::PhantomData;
use std::path::{Path, PathBuf};

use crate::advice::MemoryAdvice;
use crate::huge_pages::HugePageSize;
#[cfg(unix)]
use crate::platform::MappingMode;
use crate::protection::Protection;
use crate::Result;

/// Builder for creating memory-mapped regions.
///
/// This builder uses compile-time type states to ensure valid configurations.
pub struct MmapOptions<State = NoPath> {
    path: Option<PathBuf>,
    protection: Protection,
    offset: u64,
    len: Option<usize>,
    advice: MemoryAdvice,
    anonymous: bool,
    prefault: bool,
    huge_pages: Option<HugePageSize>,
    #[cfg(unix)]
    mapping_mode: MappingMode,
    _state: PhantomData<State>,
}

/// Type state: no path set yet
pub struct NoPath;

/// Type state: path has been set
pub struct HasPath;

impl MmapOptions<NoPath> {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            path: None,
            protection: Protection::READ,
            offset: 0,
            len: None,
            advice: MemoryAdvice::Normal,
            anonymous: false,
            prefault: false,
            huge_pages: None,
            #[cfg(unix)]
            mapping_mode: MappingMode::Shared,
            _state: PhantomData,
        }
    }

    /// Create an anonymous mapping builder (no file backing)
    ///
    /// Anonymous mappings require an explicit size.
    pub fn new_anonymous(size: usize) -> MmapOptions<HasPath> {
        MmapOptions {
            path: None,
            protection: Protection::READ | Protection::WRITE,
            offset: 0,
            len: Some(size),
            advice: MemoryAdvice::Normal,
            anonymous: true,
            prefault: false,
            huge_pages: None,
            #[cfg(unix)]
            mapping_mode: MappingMode::Private,
            _state: PhantomData,
        }
    }

    /// Set the file path
    pub fn path(self, path: impl AsRef<Path>) -> MmapOptions<HasPath> {
        MmapOptions {
            path: Some(path.as_ref().to_path_buf()),
            protection: self.protection,
            offset: self.offset,
            len: self.len,
            advice: self.advice,
            anonymous: false,
            prefault: self.prefault,
            huge_pages: self.huge_pages,
            #[cfg(unix)]
            mapping_mode: MappingMode::Shared,
            _state: PhantomData,
        }
    }
}

impl MmapOptions<HasPath> {
    /// Set the protection flags
    pub fn protection(mut self, protection: Protection) -> Self {
        self.protection = protection;
        self
    }

    /// Set the offset into the file
    pub fn offset(mut self, offset: u64) -> Self {
        self.offset = offset;
        self
    }

    /// Set the length of the mapping
    pub fn len(mut self, len: usize) -> Self {
        self.len = Some(len);
        self
    }

    /// Set memory advice hint
    pub fn advice(mut self, advice: MemoryAdvice) -> Self {
        self.advice = advice;
        self
    }

    /// Enable prefaulting (fault all pages into memory immediately)
    pub fn prefault(mut self, enable: bool) -> Self {
        self.prefault = enable;
        self
    }

    /// Enable prefaulting (convenience method)
    pub fn populate(self) -> Self {
        self.prefault(true)
    }

    /// Enable huge pages for better TLB performance
    ///
    /// # Platform Support
    ///
    /// - **Linux**: Requires huge pages configured in `/proc/sys/vm/nr_hugepages`
    /// - **Windows**: Requires "Lock pages in memory" privilege
    /// - **macOS**: Best-effort superpage allocation
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mmap_rs::{MmapOptions, HugePageSize};
    ///
    /// let mmap = MmapOptions::new()
    ///     .path("large_data.bin")
    ///     .huge_pages(HugePageSize::Size2MB)
    ///     .map_readonly()?;
    /// # Ok::<(), mmap_rs::MmapError>(())
    /// ```
    pub fn huge_pages(mut self, size: HugePageSize) -> Self {
        self.huge_pages = Some(size);
        self
    }

    /// Set mapping mode to shared (changes written to file and visible to other processes)
    ///
    /// This is the default for file-backed mappings on Unix.
    ///
    /// # Platform Support
    ///
    /// - **Unix**: Uses `MAP_SHARED`
    /// - **Windows**: Always shared for file mappings
    #[cfg(unix)]
    pub fn shared(mut self) -> Self {
        self.mapping_mode = MappingMode::Shared;
        self
    }

    /// Set mapping mode to private (copy-on-write, changes not written to file)
    ///
    /// This enables Copy-on-Write (COW) semantics where writes create private copies.
    ///
    /// # Platform Support
    ///
    /// - **Unix**: Uses `MAP_PRIVATE`
    /// - **Windows**: Uses copy-on-write section
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mmap_rs::MmapOptions;
    ///
    /// // Create COW mapping - writes won't affect the file
    /// let mut mmap = MmapOptions::new()
    ///     .path("data.bin")
    ///     .private()
    ///     .map_readwrite()?;
    ///
    /// mmap[0] = 0xFF; // This won't modify the file
    /// # Ok::<(), mmap_rs::MmapError>(())
    /// ```
    #[cfg(unix)]
    pub fn private(mut self) -> Self {
        self.mapping_mode = MappingMode::Private;
        self
    }

    /// Create a read-only mapping (convenience method)
    pub fn map_readonly(mut self) -> Result<crate::mmap::Mmap<crate::mmap::ReadOnly>> {
        self.protection = Protection::READ;
        self.map_internal()
    }

    /// Create a read-write mapping (convenience method)
    pub fn map_readwrite(mut self) -> Result<crate::mmap::Mmap<crate::mmap::ReadWrite>> {
        self.protection = Protection::READ | Protection::WRITE;
        self.map_internal()
    }

    /// Create a mapping with the configured options
    pub fn map<Mode>(self) -> Result<crate::mmap::Mmap<Mode>> {
        self.map_internal()
    }

    /// Internal mapping implementation
    fn map_internal<Mode>(self) -> Result<crate::mmap::Mmap<Mode>> {
        use crate::platform::PlatformMmap;
        use std::fs::OpenOptions;

        let platform_mmap = if self.anonymous {
            // Anonymous mapping
            let len = self.len.ok_or_else(|| {
                crate::MmapError::InvalidConfiguration(
                    "Anonymous mapping requires explicit size".to_string(),
                )
            })?;

            if let Some(huge_page_size) = self.huge_pages {
                PlatformMmap::new_anonymous_huge(len, self.protection, huge_page_size)?
            } else {
                PlatformMmap::new_anonymous(len, self.protection)?
            }
        } else {
            // File-backed mapping
            let path = self.path.expect("Path must be set");

            // Open the file with appropriate permissions
            let file = if self.protection.can_write() {
                OpenOptions::new().read(true).write(true).open(&path)?
            } else {
                OpenOptions::new().read(true).open(&path)?
            };

            // Determine the length if not specified
            let len = match self.len {
                Some(l) => l,
                None => {
                    let metadata = file.metadata()?;
                    metadata.len() as usize
                }
            };

            #[cfg(unix)]
            {
                if let Some(huge_page_size) = self.huge_pages {
                    PlatformMmap::new_huge(
                        &file,
                        self.offset,
                        len,
                        self.protection,
                        huge_page_size,
                    )?
                } else {
                    PlatformMmap::new(&file, self.offset, len, self.protection, self.mapping_mode)?
                }
            }
            #[cfg(not(unix))]
            {
                if let Some(huge_page_size) = self.huge_pages {
                    PlatformMmap::new_huge(
                        &file,
                        self.offset,
                        len,
                        self.protection,
                        huge_page_size,
                    )?
                } else {
                    PlatformMmap::new(&file, self.offset, len, self.protection)?
                }
            }
        };

        // Apply memory advice if specified (takes &self, not &mut self)
        if self.advice != MemoryAdvice::Normal {
            platform_mmap.advise(self.advice)?;
        }

        // Prefault pages if requested (takes &self, not &mut self)
        if self.prefault {
            platform_mmap.prefault()?;
        }

        // Wrap in type-safe Mmap
        Ok(crate::mmap::Mmap::from_platform(platform_mmap))
    }
}

impl Default for MmapOptions<NoPath> {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Protection;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn create_test_file(size: usize) -> NamedTempFile {
        let mut file = NamedTempFile::new().unwrap();
        let data = vec![0xAB; size];
        file.write_all(&data).unwrap();
        file.flush().unwrap();
        file
    }

    #[test]
    fn test_builder_default() {
        let builder = MmapOptions::new();
        assert!(builder.path.is_none());
        assert_eq!(builder.protection, Protection::READ);
        assert_eq!(builder.offset, 0);
        assert!(builder.len.is_none());
    }

    #[test]
    fn test_builder_with_path() {
        let builder = MmapOptions::new().path("/tmp/test.dat");
        assert!(builder.path.is_some());
        assert_eq!(builder.path.unwrap().to_str().unwrap(), "/tmp/test.dat");
    }

    #[test]
    fn test_builder_protection() {
        let file = create_test_file(4096);
        let builder = MmapOptions::new()
            .path(file.path())
            .protection(Protection::READ | Protection::WRITE);

        assert_eq!(builder.protection, Protection::READ | Protection::WRITE);
    }

    #[test]
    fn test_builder_offset() {
        let file = create_test_file(8192);
        let builder = MmapOptions::new().path(file.path()).offset(4096);

        assert_eq!(builder.offset, 4096);
    }

    #[test]
    fn test_builder_len() {
        let file = create_test_file(8192);
        let builder = MmapOptions::new().path(file.path()).len(4096);

        assert_eq!(builder.len, Some(4096));
    }

    #[test]
    fn test_map_readonly() {
        let file = create_test_file(4096);
        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        assert_eq!(mmap.len(), 4096);
        let data = mmap.as_slice();
        assert_eq!(data[0], 0xAB);
    }

    #[test]
    fn test_map_readwrite() {
        let file = create_test_file(4096);
        let mut mmap = MmapOptions::new()
            .path(file.path())
            .map_readwrite()
            .unwrap();

        assert_eq!(mmap.len(), 4096);
        let data = mmap.as_mut_slice();
        data[0] = 0xCD;
        assert_eq!(data[0], 0xCD);
    }

    #[test]
    fn test_map_with_custom_len() {
        let file = create_test_file(8192);
        let mmap = MmapOptions::new()
            .path(file.path())
            .len(4096)
            .map_readonly()
            .unwrap();

        assert_eq!(mmap.len(), 4096);
    }

    #[test]
    fn test_map_with_offset() {
        use crate::platform::page_size;
        let page = page_size();
        let file = create_test_file(page * 3);

        let mmap = MmapOptions::new()
            .path(file.path())
            .offset(page as u64)
            .len(page)
            .map_readonly()
            .unwrap();

        assert_eq!(mmap.len(), page);
    }

    #[test]
    fn test_builder_chaining() {
        let file = create_test_file(4096);
        let mmap = MmapOptions::new()
            .path(file.path())
            .protection(Protection::READ)
            .offset(0)
            .len(2048)
            .map_readonly()
            .unwrap();

        assert_eq!(mmap.len(), 2048);
    }

    #[test]
    fn test_map_nonexistent_file() {
        let result = MmapOptions::new()
            .path("/nonexistent/file.dat")
            .map_readonly();

        assert!(result.is_err());
    }
}
