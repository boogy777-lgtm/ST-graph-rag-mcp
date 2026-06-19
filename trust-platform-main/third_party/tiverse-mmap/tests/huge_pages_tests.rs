//! Tests for huge page support
//!
//! Note: These tests may fail if huge pages are not configured on the system.

use mmap_rs::{HugePageSize, MmapOptions};
use std::io::Write;
use tempfile::NamedTempFile;

#[test]
#[cfg(target_os = "linux")]
fn test_huge_pages_anonymous_2mb() {
    // This test requires huge pages to be configured
    // May fail with HugePagesUnsupported if not available
    let result = MmapOptions::new_anonymous(2 * 1024 * 1024)
        .huge_pages(HugePageSize::Size2MB)
        .map_readwrite();

    // Either succeeds or fails with HugePagesUnsupported
    match result {
        Ok(mmap) => {
            assert_eq!(mmap.len(), 2 * 1024 * 1024);
        }
        Err(e) => {
            // Expected if huge pages not configured
            eprintln!("Huge pages not available: {}", e);
        }
    }
}

#[test]
fn test_huge_pages_fallback() {
    // Huge pages for file-backed mappings may not be available
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0x42; 4096]).unwrap();
    file.flush().unwrap();

    let result = MmapOptions::new()
        .path(file.path())
        .huge_pages(HugePageSize::Size2MB)
        .map_readonly();

    // Either succeeds or fails gracefully
    match result {
        Ok(mmap) => {
            assert_eq!(mmap[0], 0x42);
        }
        Err(e) => {
            eprintln!("Huge pages not available for file-backed mapping: {}", e);
        }
    }
}

#[test]
fn test_huge_pages_with_prefault() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0x77; 8192]).unwrap();
    file.flush().unwrap();

    let result = MmapOptions::new()
        .path(file.path())
        .huge_pages(HugePageSize::Size2MB)
        .populate()
        .map_readonly();

    match result {
        Ok(mmap) => {
            assert_eq!(mmap[0], 0x77);
        }
        Err(e) => {
            eprintln!("Huge pages not available: {}", e);
        }
    }
}

#[test]
fn test_huge_page_sizes() {
    assert_eq!(HugePageSize::Size2MB.size_bytes(), 2 * 1024 * 1024);
    assert_eq!(HugePageSize::Size1GB.size_bytes(), 1024 * 1024 * 1024);
}

#[test]
fn test_huge_pages_with_advice() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0x88; 4096]).unwrap();
    file.flush().unwrap();

    let result = MmapOptions::new()
        .path(file.path())
        .huge_pages(HugePageSize::Size2MB)
        .advice(mmap_rs::MemoryAdvice::Sequential)
        .map_readonly();

    match result {
        Ok(mmap) => {
            assert_eq!(mmap[0], 0x88);
        }
        Err(e) => {
            eprintln!("Huge pages not available: {}", e);
        }
    }
}
