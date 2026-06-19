//! Core memory-mapped region types.

use crate::platform::PlatformMmap;
use std::marker::PhantomData;
use std::ops::{Deref, DerefMut};

/// Phantom type for read-only access
pub struct ReadOnly;

/// Phantom type for read-write access
pub struct ReadWrite;

/// Phantom type for copy-on-write access
pub struct CopyOnWrite;

/// A memory-mapped region with type-safe access control.
///
/// The `Mode` type parameter enforces access permissions at compile time:
/// - `Mmap<ReadOnly>`: Immutable access only
/// - `Mmap<ReadWrite>`: Mutable access allowed
/// - `Mmap<CopyOnWrite>`: Copy-on-write semantics
///
/// # Examples
///
/// ```ignore
/// use mmap_rs::{MmapOptions, Mmap, ReadOnly};
///
/// let mmap: Mmap<ReadOnly> = MmapOptions::new()
///     .path("data.bin")
///     .map_readonly()?;
///
/// let data: &[u8] = &mmap;
/// # Ok::<(), Box<dyn std::error::Error>>(())
/// ```
pub struct Mmap<Mode = ReadOnly> {
    inner: PlatformMmap,
    _mode: PhantomData<Mode>,
}

impl<Mode> Mmap<Mode> {
    /// Create a new Mmap from a platform mapping
    pub(crate) fn from_platform(inner: PlatformMmap) -> Self {
        Self {
            inner,
            _mode: PhantomData,
        }
    }

    /// Get the length of the mapped region
    pub fn len(&self) -> usize {
        self.inner.len()
    }

    /// Check if the mapping is empty
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    /// Get a pointer to the mapped memory
    pub fn as_ptr(&self) -> *const u8 {
        self.inner.as_ptr()
    }
}

impl Mmap<ReadOnly> {
    /// Get a slice view of the mapped region
    pub fn as_slice(&self) -> &[u8] {
        // SAFETY: The PlatformMmap guarantees ptr and len are valid
        // for the lifetime of this Mmap
        unsafe { std::slice::from_raw_parts(self.inner.as_ptr(), self.inner.len()) }
    }
}

impl Deref for Mmap<ReadOnly> {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        self.as_slice()
    }
}

impl Mmap<ReadWrite> {
    /// Get a mutable slice view of the mapped region
    pub fn as_mut_slice(&mut self) -> &mut [u8] {
        // SAFETY: The PlatformMmap guarantees ptr and len are valid
        // for the lifetime of this Mmap, and ReadWrite mode ensures
        // we have exclusive mutable access
        unsafe { std::slice::from_raw_parts_mut(self.inner.as_mut_ptr(), self.inner.len()) }
    }

    /// Resize the mapping to a new size.
    ///
    /// On Linux, this uses `mremap()` which can efficiently grow or shrink
    /// the mapping. On other platforms, this falls back to unmapping and
    /// remapping, which may change the address.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// let mut mmap = MmapOptions::new()
    ///     .path("growable.dat")
    ///     .map_readwrite()?;
    ///
    /// // Grow from 1MB to 2MB
    /// mmap.resize(2 * 1024 * 1024)?;
    /// # Ok::<(), mmap_rs::MmapError>(())
    /// ```
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The new size is zero
    /// - The system cannot allocate the requested size
    /// - The file backing is too small (for file-backed mappings)
    pub fn resize(&mut self, new_size: usize) -> crate::Result<()> {
        self.inner.resize(new_size)
    }
}

impl Deref for Mmap<ReadWrite> {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        // SAFETY: The PlatformMmap guarantees ptr and len are valid
        unsafe { std::slice::from_raw_parts(self.inner.as_ptr(), self.inner.len()) }
    }
}

impl DerefMut for Mmap<ReadWrite> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.as_mut_slice()
    }
}

// Note: Mmap does not implement Copy (contains PlatformMmap which is not Copy)

// SAFETY: Mmap<ReadOnly> can be safely shared across threads since it only
// provides immutable access to the underlying memory
unsafe impl Send for Mmap<ReadOnly> {}
unsafe impl Sync for Mmap<ReadOnly> {}

// SAFETY: Mmap<ReadWrite> can be sent but not shared since it provides
// mutable access and requires exclusive access per Rust's borrowing rules
unsafe impl Send for Mmap<ReadWrite> {}

#[cfg(test)]
mod tests {
    use crate::MmapOptions;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn create_test_file(size: usize, pattern: u8) -> NamedTempFile {
        let mut file = NamedTempFile::new().unwrap();
        let data = vec![pattern; size];
        file.write_all(&data).unwrap();
        file.flush().unwrap();
        file
    }

    #[test]
    fn test_mmap_len() {
        let file = create_test_file(4096, 0x42);
        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        assert_eq!(mmap.len(), 4096);
        assert!(!mmap.is_empty());
    }

    #[test]
    fn test_readonly_as_slice() {
        let file = create_test_file(1024, 0x55);
        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let slice = mmap.as_slice();
        assert_eq!(slice.len(), 1024);
        assert_eq!(slice[0], 0x55);
        assert_eq!(slice[512], 0x55);
        assert_eq!(slice[1023], 0x55);
    }

    #[test]
    fn test_readonly_deref() {
        let file = create_test_file(2048, 0xAA);
        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        // Test Deref implementation
        assert_eq!(mmap[0], 0xAA);
        assert_eq!(mmap[1024], 0xAA);
        assert_eq!(mmap.len(), 2048);
    }

    #[test]
    fn test_readwrite_as_mut_slice() {
        let file = create_test_file(4096, 0x00);
        let mut mmap = MmapOptions::new()
            .path(file.path())
            .map_readwrite()
            .unwrap();

        let slice = mmap.as_mut_slice();
        slice[0] = 0xFF;
        slice[100] = 0xEE;
        slice[4095] = 0xDD;

        assert_eq!(slice[0], 0xFF);
        assert_eq!(slice[100], 0xEE);
        assert_eq!(slice[4095], 0xDD);
    }

    #[test]
    fn test_readwrite_deref_mut() {
        let file = create_test_file(1024, 0x00);
        let mut mmap = MmapOptions::new()
            .path(file.path())
            .map_readwrite()
            .unwrap();

        // Test DerefMut implementation
        mmap[0] = 0x11;
        mmap[512] = 0x22;

        assert_eq!(mmap[0], 0x11);
        assert_eq!(mmap[512], 0x22);
    }

    #[test]
    fn test_readwrite_immutable_access() {
        let file = create_test_file(2048, 0xBB);
        let mmap = MmapOptions::new()
            .path(file.path())
            .map_readwrite()
            .unwrap();

        // ReadWrite should also allow immutable access via Deref
        assert_eq!(mmap[0], 0xBB);
        assert_eq!(mmap[1024], 0xBB);
    }

    #[test]
    fn test_as_ptr() {
        let file = create_test_file(512, 0x33);
        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let ptr = mmap.as_ptr();
        assert!(!ptr.is_null());

        // SAFETY: We know the pointer is valid for the mmap lifetime
        unsafe {
            assert_eq!(*ptr, 0x33);
        }
    }

    #[test]
    fn test_multiple_reads() {
        let file = create_test_file(8192, 0x77);
        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        // Multiple immutable borrows should work
        let slice1 = mmap.as_slice();
        let slice2 = mmap.as_slice();

        assert_eq!(slice1[0], 0x77);
        assert_eq!(slice2[0], 0x77);
    }

    #[test]
    fn test_zero_sized_mapping() {
        let file = create_test_file(0, 0x00);
        let result = MmapOptions::new().path(file.path()).map_readonly();

        // Zero-sized mappings should error (platform limitation)
        assert!(result.is_err());
    }

    #[test]
    fn test_large_mapping() {
        let size = 1024 * 1024; // 1MB
        let file = create_test_file(size, 0x99);
        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        assert_eq!(mmap.len(), size);
        assert_eq!(mmap[0], 0x99);
        assert_eq!(mmap[size / 2], 0x99);
        assert_eq!(mmap[size - 1], 0x99);
    }

    #[test]
    fn test_persistence_after_write() {
        let file = create_test_file(4096, 0x00);
        let path = file.path().to_path_buf();

        {
            let mut mmap = MmapOptions::new().path(&path).map_readwrite().unwrap();

            mmap[0] = 0xAA;
            mmap[100] = 0xBB;
            mmap[4095] = 0xCC;
        }

        // Read back to verify persistence
        let mmap = MmapOptions::new().path(&path).map_readonly().unwrap();

        assert_eq!(mmap[0], 0xAA);
        assert_eq!(mmap[100], 0xBB);
        assert_eq!(mmap[4095], 0xCC);
    }
}
