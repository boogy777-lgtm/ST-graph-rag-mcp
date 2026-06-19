//! Lifetime-bound slices for memory-mapped regions (Phase 2).
//!
//! `MmapSlice` provides a way to safely reference sub-regions of a memory-mapped
//! file with compile-time lifetime tracking, preventing use-after-free bugs.

use crate::mmap::{Mmap, ReadOnly, ReadWrite};
use std::ops::{Deref, Range};

/// A lifetime-bound reference to a sub-region of a memory-mapped file.
///
/// This type ensures that the slice cannot outlive the underlying `Mmap`,
/// providing compile-time safety against use-after-free bugs.
///
/// # Examples
///
/// ```ignore
/// use mmap_rs::MmapOptions;
///
/// let mmap = MmapOptions::new()
///     .path("data.bin")
///     .map_readonly()?;
///
/// // Create a slice referencing part of the mapping
/// let slice = mmap.slice(0..1024);
///
/// // This would not compile:
/// // drop(mmap);
/// // println!("{}", slice[0]); // Error: slice borrows mmap
/// # Ok::<(), Box<dyn std::error::Error>>(())
/// ```
pub struct MmapSlice<'a, Mode> {
    mmap: &'a Mmap<Mode>,
    range: Range<usize>,
}

impl<'a, Mode> MmapSlice<'a, Mode> {
    /// Create a new slice referencing a sub-region of the mmap.
    ///
    /// # Panics
    ///
    /// Panics if the range is out of bounds.
    pub fn new(mmap: &'a Mmap<Mode>, range: Range<usize>) -> Self {
        assert!(range.end <= mmap.len(), "Slice range out of bounds");
        Self { mmap, range }
    }

    /// Get the length of this slice.
    pub fn len(&self) -> usize {
        self.range.len()
    }

    /// Check if the slice is empty.
    pub fn is_empty(&self) -> bool {
        self.range.is_empty()
    }

    /// Get the start offset of this slice within the mmap.
    pub fn offset(&self) -> usize {
        self.range.start
    }
}

impl<'a> MmapSlice<'a, ReadOnly> {
    /// Get a byte slice view of this region.
    pub fn as_slice(&self) -> &'a [u8] {
        // SAFETY: The range was validated in new() and the lifetime
        // is bound to the Mmap's lifetime
        unsafe {
            let ptr = self.mmap.as_ptr().add(self.range.start);
            std::slice::from_raw_parts(ptr, self.range.len())
        }
    }
}

impl<'a> Deref for MmapSlice<'a, ReadOnly> {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        self.as_slice()
    }
}

impl<'a> MmapSlice<'a, ReadWrite> {
    /// Get a byte slice view of this region.
    pub fn as_slice(&self) -> &'a [u8] {
        // SAFETY: The range was validated in new() and the lifetime
        // is bound to the Mmap's lifetime
        unsafe {
            let ptr = self.mmap.as_ptr().add(self.range.start);
            std::slice::from_raw_parts(ptr, self.range.len())
        }
    }
}

impl<'a> Deref for MmapSlice<'a, ReadWrite> {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        self.as_slice()
    }
}

// Extend Mmap with slice() method
impl<Mode> Mmap<Mode> {
    /// Create a lifetime-bound slice referencing a sub-region.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// let slice = mmap.slice(100..200);
    /// assert_eq!(slice.len(), 100);
    /// ```
    ///
    /// # Panics
    ///
    /// Panics if the range is out of bounds.
    pub fn slice(&self, range: Range<usize>) -> MmapSlice<'_, Mode> {
        MmapSlice::new(self, range)
    }

    /// Create a slice from a given offset to the end.
    pub fn slice_from(&self, start: usize) -> MmapSlice<'_, Mode> {
        self.slice(start..self.len())
    }

    /// Create a slice from the beginning to a given offset.
    pub fn slice_to(&self, end: usize) -> MmapSlice<'_, Mode> {
        self.slice(0..end)
    }
}

#[cfg(test)]
mod tests {
    use crate::MmapOptions;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn create_test_file(data: &[u8]) -> NamedTempFile {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(data).unwrap();
        file.flush().unwrap();
        file
    }

    #[test]
    fn test_slice_basic() {
        let data: Vec<u8> = (0..255).collect();
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let slice = mmap.slice(10..20);
        assert_eq!(slice.len(), 10);
        assert_eq!(slice[0], 10);
        assert_eq!(slice[9], 19);
    }

    #[test]
    fn test_slice_full() {
        let data = vec![0x42; 1024];
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let slice = mmap.slice(0..mmap.len());
        assert_eq!(slice.len(), 1024);
        assert_eq!(slice[0], 0x42);
    }

    #[test]
    fn test_slice_empty() {
        let data = vec![0x55; 512];
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let slice = mmap.slice(100..100);
        assert_eq!(slice.len(), 0);
        assert!(slice.is_empty());
    }

    #[test]
    fn test_slice_offset() {
        let data: Vec<u8> = (0..100).collect();
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let slice = mmap.slice(50..75);
        assert_eq!(slice.offset(), 50);
        assert_eq!(slice.len(), 25);
    }

    #[test]
    fn test_slice_from() {
        let data = vec![0xAA; 1000];
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let slice = mmap.slice_from(500);
        assert_eq!(slice.len(), 500);
        assert_eq!(slice.offset(), 500);
    }

    #[test]
    fn test_slice_to() {
        let data = vec![0xBB; 2000];
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let slice = mmap.slice_to(1000);
        assert_eq!(slice.len(), 1000);
        assert_eq!(slice.offset(), 0);
    }

    #[test]
    fn test_slice_deref() {
        let data: Vec<u8> = (0..50).collect();
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let slice = mmap.slice(10..20);

        // Test Deref implementation
        assert_eq!(&slice[..], &data[10..20]);
        assert_eq!(slice[0], 10);
    }

    #[test]
    fn test_multiple_slices() {
        let data = vec![0x77; 4096];
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        // Create multiple non-overlapping slices
        let slice1 = mmap.slice(0..1000);
        let slice2 = mmap.slice(1000..2000);
        let slice3 = mmap.slice(2000..3000);

        assert_eq!(slice1.len(), 1000);
        assert_eq!(slice2.len(), 1000);
        assert_eq!(slice3.len(), 1000);

        assert_eq!(slice1[0], 0x77);
        assert_eq!(slice2[0], 0x77);
        assert_eq!(slice3[0], 0x77);
    }

    #[test]
    fn test_slice_lifetime_bound() {
        let data = vec![0x99; 512];
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let slice = mmap.slice(0..256);

        // This would not compile if uncommented:
        // drop(mmap);
        // println!("{}", slice[0]); // Error: slice borrows mmap

        assert_eq!(slice[0], 0x99);
    }

    #[test]
    #[should_panic(expected = "out of bounds")]
    fn test_slice_out_of_bounds() {
        let data = vec![0xCC; 100];
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        // This should panic
        let _slice = mmap.slice(0..101);
    }

    #[test]
    fn test_nested_slicing() {
        let data: Vec<u8> = (0..100).collect();
        let file = create_test_file(&data);

        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let slice1 = mmap.slice(10..50);
        // We can use standard slice operations on the deref'd slice
        let nested = &slice1[5..15];

        assert_eq!(nested.len(), 10);
        assert_eq!(nested[0], 15); // 10 + 5
    }
}
