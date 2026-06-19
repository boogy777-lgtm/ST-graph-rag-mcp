//! Integration tests for mmap-rs
//!
//! These tests verify end-to-end functionality with real file operations.

use mmap_rs::MmapOptions;
use std::fs::File;
use std::io::Write;
use tempfile::{NamedTempFile, TempDir};

#[test]
fn test_basic_readonly_mapping() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(b"Hello, mmap!").unwrap();
    file.flush().unwrap();

    let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    assert_eq!(&mmap[..], b"Hello, mmap!");
}

#[test]
fn test_basic_readwrite_mapping() {
    let mut file = NamedTempFile::new().unwrap();
    let data = vec![0u8; 4096];
    file.write_all(&data).unwrap();
    file.flush().unwrap();

    let mut mmap = MmapOptions::new()
        .path(file.path())
        .map_readwrite()
        .unwrap();

    // Write some data
    mmap[0..5].copy_from_slice(b"Hello");
    mmap[100..105].copy_from_slice(b"World");

    assert_eq!(&mmap[0..5], b"Hello");
    assert_eq!(&mmap[100..105], b"World");
}

#[test]
fn test_concurrent_readonly_mappings() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(b"Shared data").unwrap();
    file.flush().unwrap();

    let mmap1 = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    let mmap2 = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    assert_eq!(&mmap1[..], b"Shared data");
    assert_eq!(&mmap2[..], b"Shared data");
}

#[test]
fn test_partial_mapping_with_offset() {
    use mmap_rs::platform::page_size;

    let page = page_size();
    let mut file = NamedTempFile::new().unwrap();

    // Write data across multiple pages
    let mut data = Vec::new();
    for i in 0..3 {
        data.extend(vec![i as u8; page]);
    }
    file.write_all(&data).unwrap();
    file.flush().unwrap();

    // Map only the second page
    let mmap = MmapOptions::new()
        .path(file.path())
        .offset(page as u64)
        .len(page)
        .map_readonly()
        .unwrap();

    assert_eq!(mmap.len(), page);
    assert_eq!(mmap[0], 1); // Second page has value 1
}

#[test]
fn test_empty_file_mapping() {
    let file = NamedTempFile::new().unwrap();

    let result = MmapOptions::new().path(file.path()).map_readonly();

    // Empty files cannot be mapped (platform limitation)
    assert!(result.is_err());
}

#[test]
fn test_large_file_mapping() {
    let size = 10 * 1024 * 1024; // 10 MB
    let mut file = NamedTempFile::new().unwrap();

    // Write in chunks to avoid memory issues
    let chunk = vec![0xAB; 1024 * 1024];
    for _ in 0..10 {
        file.write_all(&chunk).unwrap();
    }
    file.flush().unwrap();

    let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    assert_eq!(mmap.len(), size);
    assert_eq!(mmap[0], 0xAB);
    assert_eq!(mmap[size / 2], 0xAB);
    assert_eq!(mmap[size - 1], 0xAB);
}

#[test]
fn test_data_persistence() {
    let dir = TempDir::new().unwrap();
    let file_path = dir.path().join("persistent.dat");

    // Create and write to file
    {
        let mut file = File::create(&file_path).unwrap();
        file.write_all(&vec![0u8; 4096]).unwrap();
    }

    // Map and modify
    {
        let mut mmap = MmapOptions::new().path(&file_path).map_readwrite().unwrap();

        mmap[0] = 0xFF;
        mmap[1024] = 0xEE;
        mmap[4095] = 0xDD;
    }

    // Verify persistence
    {
        let mmap = MmapOptions::new().path(&file_path).map_readonly().unwrap();

        assert_eq!(mmap[0], 0xFF);
        assert_eq!(mmap[1024], 0xEE);
        assert_eq!(mmap[4095], 0xDD);
    }
}

#[test]
fn test_sequential_write_pattern() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0u8; 8192]).unwrap();
    file.flush().unwrap();

    let mut mmap = MmapOptions::new()
        .path(file.path())
        .map_readwrite()
        .unwrap();

    // Sequential write pattern
    for i in 0..mmap.len() {
        mmap[i] = (i % 256) as u8;
    }

    // Verify pattern
    for i in 0..mmap.len() {
        assert_eq!(mmap[i], (i % 256) as u8);
    }
}

#[test]
fn test_error_nonexistent_file() {
    let result = MmapOptions::new()
        .path("/nonexistent/path/file.dat")
        .map_readonly();

    assert!(result.is_err());
}

#[test]
fn test_error_directory_mapping() {
    let dir = TempDir::new().unwrap();

    let result = MmapOptions::new().path(dir.path()).map_readonly();

    assert!(result.is_err());
}

#[test]
fn test_multiple_sequential_maps() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0x55; 4096]).unwrap();
    file.flush().unwrap();

    // Map, verify, drop, map again
    for _ in 0..5 {
        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        assert_eq!(mmap[0], 0x55);
    }
}

#[test]
fn test_write_beyond_boundary_patterns() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0u8; 1024]).unwrap();
    file.flush().unwrap();

    let mut mmap = MmapOptions::new()
        .path(file.path())
        .map_readwrite()
        .unwrap();

    // Write at boundaries
    mmap[0] = 0xAA;
    mmap[1023] = 0xBB;

    assert_eq!(mmap[0], 0xAA);
    assert_eq!(mmap[1023], 0xBB);
}

#[test]
fn test_slice_operations() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(b"0123456789ABCDEF").unwrap();
    file.flush().unwrap();

    let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    // Test various slice operations
    assert_eq!(&mmap[0..5], b"01234");
    assert_eq!(&mmap[5..10], b"56789");
    assert_eq!(&mmap[10..], b"ABCDEF");

    // Iterator operations
    let sum: usize = mmap.iter().map(|&b| b as usize).sum();
    assert!(sum > 0);
}

#[test]
#[cfg(unix)]
fn test_readonly_permissions() {
    use std::os::unix::fs::PermissionsExt;

    let mut file = NamedTempFile::new().unwrap();
    file.write_all(b"readonly data").unwrap();

    // Set file to readonly
    let metadata = file.as_file().metadata().unwrap();
    let mut perms = metadata.permissions();
    perms.set_mode(0o444); // Read-only for all
    file.as_file().set_permissions(perms).unwrap();

    // Should succeed with readonly mapping
    let mmap = MmapOptions::new().path(file.path()).map_readonly();

    assert!(mmap.is_ok());
}
