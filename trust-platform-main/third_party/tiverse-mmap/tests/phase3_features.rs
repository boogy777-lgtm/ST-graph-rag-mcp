//! Tests for Phase 3 advanced features
//!
//! - Anonymous mappings
//! - Memory advice hints
//! - Prefaulting strategies

use mmap_rs::{MemoryAdvice, MmapOptions, Protection};
use std::io::Write;
use tempfile::NamedTempFile;

// ============================================================================
// Anonymous Mapping Tests
// ============================================================================

#[test]
fn test_anonymous_basic() {
    let mmap = MmapOptions::new_anonymous(4096).map_readwrite().unwrap();

    assert_eq!(mmap.len(), 4096);
    assert!(!mmap.is_empty());
}

#[test]
fn test_anonymous_read_write() {
    let mut mmap = MmapOptions::new_anonymous(1024).map_readwrite().unwrap();

    // Write data
    mmap[0] = 0xAA;
    mmap[512] = 0xBB;
    mmap[1023] = 0xCC;

    // Read it back
    assert_eq!(mmap[0], 0xAA);
    assert_eq!(mmap[512], 0xBB);
    assert_eq!(mmap[1023], 0xCC);
}

#[test]
fn test_anonymous_zero_initialized() {
    let mmap = MmapOptions::new_anonymous(2048).map_readwrite().unwrap();

    // Anonymous mappings should be zero-initialized
    for i in 0..mmap.len() {
        assert_eq!(mmap[i], 0, "Byte at offset {} should be zero", i);
    }
}

#[test]
fn test_anonymous_large() {
    let size = 10 * 1024 * 1024; // 10MB
    let mmap = MmapOptions::new_anonymous(size).map_readwrite().unwrap();

    assert_eq!(mmap.len(), size);
}

#[test]
fn test_anonymous_custom_protection() {
    // Read-only anonymous mapping
    let mmap: mmap_rs::Mmap<mmap_rs::ReadOnly> = MmapOptions::new_anonymous(4096)
        .protection(Protection::READ)
        .map()
        .unwrap();

    assert_eq!(mmap.len(), 4096);
    // All bytes should be zero
    assert_eq!(mmap[0], 0);
}

#[test]
fn test_anonymous_multiple_independent() {
    let mut mmap1 = MmapOptions::new_anonymous(1024).map_readwrite().unwrap();

    let mut mmap2 = MmapOptions::new_anonymous(1024).map_readwrite().unwrap();

    // Write different values
    mmap1[0] = 0xFF;
    mmap2[0] = 0xEE;

    // They should be independent
    assert_eq!(mmap1[0], 0xFF);
    assert_eq!(mmap2[0], 0xEE);
}

#[test]
fn test_anonymous_slice_operations() {
    let mut mmap = MmapOptions::new_anonymous(8192).map_readwrite().unwrap();

    // Write pattern
    for i in 0..100 {
        mmap[i] = i as u8;
    }

    // Create slice
    let slice = mmap.slice(10..50);
    assert_eq!(slice.len(), 40);
    assert_eq!(slice[0], 10);
    assert_eq!(slice[39], 49);
}

// ============================================================================
// Memory Advice Tests
// ============================================================================

#[test]
fn test_memory_advice_sequential() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0x42; 8192]).unwrap();
    file.flush().unwrap();

    let mmap = MmapOptions::new()
        .path(file.path())
        .advice(MemoryAdvice::Sequential)
        .map_readonly()
        .unwrap();

    assert_eq!(mmap[0], 0x42);
}

#[test]
fn test_memory_advice_random() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0x55; 4096]).unwrap();
    file.flush().unwrap();

    let mmap = MmapOptions::new()
        .path(file.path())
        .advice(MemoryAdvice::Random)
        .map_readonly()
        .unwrap();

    assert_eq!(mmap[1000], 0x55);
}

#[test]
fn test_memory_advice_willneed() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0xAA; 16384]).unwrap();
    file.flush().unwrap();

    let mmap = MmapOptions::new()
        .path(file.path())
        .advice(MemoryAdvice::WillNeed)
        .map_readonly()
        .unwrap();

    assert_eq!(mmap[8000], 0xAA);
}

#[test]
fn test_memory_advice_dontneed() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0xBB; 4096]).unwrap();
    file.flush().unwrap();

    let mmap = MmapOptions::new()
        .path(file.path())
        .advice(MemoryAdvice::DontNeed)
        .map_readonly()
        .unwrap();

    assert_eq!(mmap[0], 0xBB);
}

#[test]
fn test_memory_advice_anonymous() {
    let mmap = MmapOptions::new_anonymous(4096)
        .advice(MemoryAdvice::Sequential)
        .map_readwrite()
        .unwrap();

    assert_eq!(mmap.len(), 4096);
}

// ============================================================================
// Prefaulting Tests
// ============================================================================

#[test]
fn test_prefault_file_mapping() {
    let mut file = NamedTempFile::new().unwrap();
    let data = vec![0x77; 1024 * 1024]; // 1MB
    file.write_all(&data).unwrap();
    file.flush().unwrap();

    let mmap = MmapOptions::new()
        .path(file.path())
        .prefault(true)
        .map_readonly()
        .unwrap();

    // All pages should be faulted in, verify by reading
    assert_eq!(mmap[0], 0x77);
    assert_eq!(mmap[512 * 1024], 0x77);
    assert_eq!(mmap[1024 * 1024 - 1], 0x77);
}

#[test]
fn test_prefault_anonymous() {
    let mmap = MmapOptions::new_anonymous(512 * 1024)
        .prefault(true)
        .map_readwrite()
        .unwrap();

    // All pages should be faulted in and zero-initialized
    assert_eq!(mmap[0], 0);
    assert_eq!(mmap[256 * 1024], 0);
}

#[test]
fn test_populate_convenience() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0x99; 65536]).unwrap();
    file.flush().unwrap();

    let mmap = MmapOptions::new()
        .path(file.path())
        .populate() // Convenience method for prefault(true)
        .map_readonly()
        .unwrap();

    assert_eq!(mmap[0], 0x99);
    assert_eq!(mmap[32768], 0x99);
}

#[test]
fn test_no_prefault_by_default() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0x88; 4096]).unwrap();
    file.flush().unwrap();

    // Without prefault, mapping should still work
    let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    assert_eq!(mmap[0], 0x88);
}

// ============================================================================
// Combined Features Tests
// ============================================================================

#[test]
fn test_anonymous_with_advice() {
    let mmap = MmapOptions::new_anonymous(8192)
        .advice(MemoryAdvice::Sequential)
        .map_readwrite()
        .unwrap();

    assert_eq!(mmap.len(), 8192);
}

#[test]
fn test_anonymous_with_prefault() {
    let mut mmap = MmapOptions::new_anonymous(4096)
        .prefault(true)
        .map_readwrite()
        .unwrap();

    // Write after prefault
    mmap[0] = 0xFF;
    assert_eq!(mmap[0], 0xFF);
}

#[test]
fn test_file_with_advice_and_prefault() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0xDD; 16384]).unwrap();
    file.flush().unwrap();

    let mmap = MmapOptions::new()
        .path(file.path())
        .advice(MemoryAdvice::Sequential)
        .populate()
        .map_readonly()
        .unwrap();

    assert_eq!(mmap[0], 0xDD);
    assert_eq!(mmap[8192], 0xDD);
}

#[test]
fn test_anonymous_pattern_fill() {
    let mut mmap = MmapOptions::new_anonymous(1024).map_readwrite().unwrap();

    // Fill with pattern
    for i in 0..mmap.len() {
        mmap[i] = (i % 256) as u8;
    }

    // Verify pattern
    for i in 0..mmap.len() {
        assert_eq!(mmap[i], (i % 256) as u8);
    }
}

#[test]
fn test_large_anonymous_mapping() {
    let size = 100 * 1024 * 1024; // 100MB
    let mut mmap = MmapOptions::new_anonymous(size).map_readwrite().unwrap();

    assert_eq!(mmap.len(), size);

    // Write to first and last page
    let data = mmap.as_mut_slice();
    data[0] = 0xAB;
    data[size - 1] = 0xCD;

    assert_eq!(mmap[0], 0xAB);
    assert_eq!(mmap[size - 1], 0xCD);
}

#[test]
fn test_anonymous_concurrent_access() {
    use std::sync::Arc;
    use std::thread;

    let mmap: Arc<mmap_rs::Mmap<mmap_rs::ReadOnly>> = Arc::new(
        MmapOptions::new_anonymous(4096)
            .protection(Protection::READ)
            .map()
            .unwrap(),
    );

    let mmap1 = Arc::clone(&mmap);
    let handle = thread::spawn(move || {
        // Just read, since we can't safely share mutable access
        assert_eq!(mmap1[0], 0);
    });

    assert_eq!(mmap[0], 0);
    handle.join().unwrap();
}

#[test]
fn test_advice_combinations() {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0x11; 8192]).unwrap();
    file.flush().unwrap();

    // Test each advice type
    let advice_types = [
        MemoryAdvice::Normal,
        MemoryAdvice::Sequential,
        MemoryAdvice::Random,
        MemoryAdvice::WillNeed,
        MemoryAdvice::DontNeed,
    ];

    for advice in advice_types.iter() {
        let mmap = MmapOptions::new()
            .path(file.path())
            .advice(*advice)
            .map_readonly()
            .unwrap();

        assert_eq!(mmap[0], 0x11);
    }
}
