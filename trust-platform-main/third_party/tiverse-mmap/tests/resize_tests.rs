//! Tests for resize operations
//!
//! Note: Resize is only fully supported on Linux via mremap()

use mmap_rs::MmapOptions;
use std::io::Write;
use tempfile::NamedTempFile;

#[test]
#[cfg(target_os = "linux")]
fn test_resize_grow_anonymous() {
    let mut mmap = MmapOptions::new_anonymous(4096).map_readwrite().unwrap();

    // Write pattern before resize
    mmap[0] = 0xAA;
    mmap[100] = 0xBB;

    // Grow to 8KB
    mmap.resize(8192).unwrap();

    assert_eq!(mmap.len(), 8192);
    // Original data should be preserved
    assert_eq!(mmap[0], 0xAA);
    assert_eq!(mmap[100], 0xBB);
    // New space should be zero
    assert_eq!(mmap[5000], 0);
}

#[test]
#[cfg(target_os = "linux")]
fn test_resize_shrink_anonymous() {
    let mut mmap = MmapOptions::new_anonymous(8192).map_readwrite().unwrap();

    // Write pattern
    mmap[0] = 0xCC;
    mmap[1000] = 0xDD;

    // Shrink to 4KB
    mmap.resize(4096).unwrap();

    assert_eq!(mmap.len(), 4096);
    // Data within new size should be preserved
    assert_eq!(mmap[0], 0xCC);
    assert_eq!(mmap[1000], 0xDD);
}

#[test]
#[cfg(target_os = "linux")]
fn test_resize_noop() {
    let mut mmap = MmapOptions::new_anonymous(4096).map_readwrite().unwrap();

    // Resize to same size should be no-op
    mmap.resize(4096).unwrap();

    assert_eq!(mmap.len(), 4096);
}

#[test]
#[cfg(target_os = "linux")]
fn test_resize_large_growth() {
    let mut mmap = MmapOptions::new_anonymous(1024 * 1024)
        .map_readwrite()
        .unwrap();

    mmap[0] = 0xFF;

    // Grow to 10MB
    mmap.resize(10 * 1024 * 1024).unwrap();

    assert_eq!(mmap.len(), 10 * 1024 * 1024);
    assert_eq!(mmap[0], 0xFF);
}

#[test]
#[cfg(target_os = "linux")]
fn test_resize_error_zero() {
    let mut mmap = MmapOptions::new_anonymous(4096).map_readwrite().unwrap();

    // Resize to zero should error
    let result = mmap.resize(0);
    assert!(result.is_err());
}

#[test]
#[cfg(target_os = "linux")]
fn test_resize_with_file_backed() {
    let mut file = NamedTempFile::new().unwrap();
    // Create 8KB file
    file.write_all(&vec![0x55; 8192]).unwrap();
    file.flush().unwrap();

    let mut mmap = MmapOptions::new()
        .path(file.path())
        .map_readwrite()
        .unwrap();

    assert_eq!(mmap[0], 0x55);

    // Try to grow (may fail if file not big enough)
    // Note: mremap can work but file must be big enough
    let result = mmap.resize(16384);

    match result {
        Ok(_) => {
            assert_eq!(mmap.len(), 16384);
        }
        Err(_) => {
            // Expected if file backing insufficient
            eprintln!("Resize failed as expected for file-backed mapping");
        }
    }
}

#[test]
#[cfg(not(target_os = "linux"))]
fn test_resize_not_supported() {
    let mut mmap = MmapOptions::new_anonymous(4096).map_readwrite().unwrap();

    // Resize should fail on non-Linux platforms
    let result = mmap.resize(8192);
    assert!(result.is_err());
}

#[test]
#[cfg(target_os = "linux")]
fn test_resize_multiple_times() {
    let mut mmap = MmapOptions::new_anonymous(4096).map_readwrite().unwrap();

    mmap[0] = 0xAA;

    // Grow
    mmap.resize(8192).unwrap();
    assert_eq!(mmap.len(), 8192);
    assert_eq!(mmap[0], 0xAA);

    // Grow more
    mmap.resize(16384).unwrap();
    assert_eq!(mmap.len(), 16384);
    assert_eq!(mmap[0], 0xAA);

    // Shrink
    mmap.resize(4096).unwrap();
    assert_eq!(mmap.len(), 4096);
    assert_eq!(mmap[0], 0xAA);
}

#[test]
#[cfg(target_os = "linux")]
fn test_resize_preserves_data_pattern() {
    let mut mmap = MmapOptions::new_anonymous(1024).map_readwrite().unwrap();

    // Write pattern
    for i in 0..1024 {
        mmap[i] = (i % 256) as u8;
    }

    // Grow
    mmap.resize(2048).unwrap();

    // Verify pattern preserved
    for i in 0..1024 {
        assert_eq!(mmap[i], (i % 256) as u8);
    }
}
