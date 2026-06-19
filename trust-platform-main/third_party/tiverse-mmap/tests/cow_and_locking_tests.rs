//! Tests for Copy-on-Write mappings and file locking

use mmap_rs::{FileLock, LockType, MmapOptions};
use std::io::Write;
use tempfile::NamedTempFile;

fn create_test_file(size: usize, pattern: u8) -> NamedTempFile {
    let mut file = NamedTempFile::new().unwrap();
    let data = vec![pattern; size];
    file.write_all(&data).unwrap();
    file.flush().unwrap();
    file
}

// Copy-on-Write tests
#[cfg(unix)]
#[test]
fn test_cow_mapping_basic() {
    let file = create_test_file(4096, 0xAA);

    // Create a private (COW) mapping
    let mut mmap = MmapOptions::new()
        .path(file.path())
        .private()
        .map_readwrite()
        .unwrap();

    // Verify initial content
    assert_eq!(mmap[0], 0xAA);
    assert_eq!(mmap[100], 0xAA);

    // Modify the mapping
    mmap[0] = 0xFF;
    mmap[100] = 0xEE;

    assert_eq!(mmap[0], 0xFF);
    assert_eq!(mmap[100], 0xEE);

    // Drop the mapping
    drop(mmap);

    // Verify file wasn't modified (COW behavior)
    let verify = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    assert_eq!(verify[0], 0xAA, "File should not be modified with COW");
    assert_eq!(verify[100], 0xAA, "File should not be modified with COW");
}

#[cfg(unix)]
#[test]
fn test_shared_mapping_modifies_file() {
    let file = create_test_file(4096, 0xAA);
    let path = file.path().to_path_buf();

    // Create a shared mapping
    {
        let mut mmap = MmapOptions::new()
            .path(&path)
            .shared() // Explicitly shared
            .map_readwrite()
            .unwrap();

        mmap[0] = 0xFF;
        mmap[100] = 0xEE;
    }

    // Verify file WAS modified (shared behavior)
    let verify = MmapOptions::new().path(&path).map_readonly().unwrap();

    assert_eq!(verify[0], 0xFF, "Shared mapping should modify file");
    assert_eq!(verify[100], 0xEE, "Shared mapping should modify file");
}

#[cfg(unix)]
#[test]
fn test_cow_large_write() {
    let size = 1024 * 1024; // 1MB
    let file = create_test_file(size, 0x00);

    let mut mmap = MmapOptions::new()
        .path(file.path())
        .private()
        .map_readwrite()
        .unwrap();

    // Write a pattern
    for i in 0..size {
        mmap[i] = (i % 256) as u8;
    }

    // Verify pattern
    for i in 0..size {
        assert_eq!(mmap[i], (i % 256) as u8);
    }

    drop(mmap);

    // File should still be all zeros
    let verify = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    for i in 0..size {
        assert_eq!(verify[i], 0x00, "COW should not modify file");
    }
}

#[cfg(unix)]
#[test]
fn test_mapping_mode_default() {
    let file = create_test_file(4096, 0xAA);

    // Default for file mappings should be shared
    let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    // Should be able to access the data
    assert_eq!(mmap[0], 0xAA);
}

// File locking tests
#[test]
fn test_file_lock_shared() {
    let file = create_test_file(1024, 0x42);
    let file_handle = std::fs::File::open(file.path()).unwrap();

    let lock = FileLock::lock(file_handle, LockType::Shared).unwrap();
    assert_eq!(lock.lock_type(), LockType::Shared);
}

#[test]
fn test_file_lock_exclusive() {
    let file = create_test_file(1024, 0x42);
    let file_handle = std::fs::File::open(file.path()).unwrap();

    let lock = FileLock::lock(file_handle, LockType::Exclusive).unwrap();
    assert_eq!(lock.lock_type(), LockType::Exclusive);
}

#[test]
fn test_file_lock_try_lock() {
    let file = create_test_file(1024, 0x42);
    let file_handle = std::fs::File::open(file.path()).unwrap();

    let lock = FileLock::try_lock(file_handle, LockType::Shared).unwrap();
    assert_eq!(lock.lock_type(), LockType::Shared);
}

#[test]
fn test_file_lock_unlock() {
    let file = create_test_file(1024, 0x42);
    let file_handle = std::fs::File::open(file.path()).unwrap();

    let lock = FileLock::lock(file_handle, LockType::Exclusive).unwrap();
    let _file = lock.unlock();
    // Lock should be released
}

#[test]
fn test_multiple_shared_locks() {
    let file = create_test_file(1024, 0x42);
    let path = file.path().to_path_buf();

    let file1 = std::fs::File::open(&path).unwrap();
    let file2 = std::fs::File::open(&path).unwrap();

    let _lock1 = FileLock::lock(file1, LockType::Shared).unwrap();
    let _lock2 = FileLock::lock(file2, LockType::Shared).unwrap();

    // Both shared locks should succeed
}

#[test]
fn test_lock_with_mmap() {
    let file = create_test_file(4096, 0xAA);
    let path = file.path().to_path_buf();

    // Acquire lock then map
    let file_handle = std::fs::File::open(&path).unwrap();
    let _lock = FileLock::lock(file_handle, LockType::Shared).unwrap();

    let mmap = MmapOptions::new().path(&path).map_readonly().unwrap();

    assert_eq!(mmap[0], 0xAA);
    assert_eq!(mmap.len(), 4096);
}

#[test]
fn test_exclusive_lock_with_write_mmap() {
    let file = create_test_file(4096, 0x00);
    let path = file.path().to_path_buf();

    let file_handle = std::fs::File::open(&path).unwrap();
    let _lock = FileLock::lock(file_handle, LockType::Exclusive).unwrap();

    let mut mmap = MmapOptions::new().path(&path).map_readwrite().unwrap();

    mmap[0] = 0xFF;
    assert_eq!(mmap[0], 0xFF);
}

// SIGBUS safety tests
#[test]
fn test_file_size_validation() {
    let file = create_test_file(1024, 0x42);

    // Try to map beyond file size
    let result = MmapOptions::new()
        .path(file.path())
        .len(2048) // Larger than file
        .map_readonly();

    assert!(result.is_err(), "Should fail when mapping beyond file size");
}

#[test]
fn test_offset_plus_len_validation() {
    let file = create_test_file(4096, 0x42);

    // offset + len > file size
    let result = MmapOptions::new()
        .path(file.path())
        .offset(2048)
        .len(3072) // 2048 + 3072 = 5120 > 4096
        .map_readonly();

    assert!(result.is_err(), "Should fail when offset + len > file size");
}

#[cfg(unix)]
#[test]
fn test_truncation_detection() {
    use std::fs::OpenOptions;

    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0u8; 8192]).unwrap();
    file.flush().unwrap();

    let path = file.path().to_path_buf();

    let mmap = MmapOptions::new().path(&path).map_readonly().unwrap();

    assert_eq!(mmap.len(), 8192);

    // Truncate the file
    {
        let file = OpenOptions::new().write(true).open(&path).unwrap();
        file.set_len(4096).unwrap();
    }

    // Note: Accessing beyond the truncation point would cause SIGBUS
    // The library validates size before mapping to prevent this
    // Truncation detection requires keeping file handle, which we demonstrate
    // by noting that remapping will catch the size change

    // Create new mapping after truncation
    let mmap_new = MmapOptions::new().path(&path).map_readonly().unwrap();

    assert_eq!(mmap_new.len(), 4096, "New mapping reflects truncated size");
}

#[test]
fn test_safe_file_extension() {
    use std::fs::OpenOptions;

    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0u8; 4096]).unwrap();
    file.flush().unwrap();

    let path = file.path().to_path_buf();

    // Initial mapping
    let mmap = MmapOptions::new().path(&path).map_readonly().unwrap();

    assert_eq!(mmap.len(), 4096);

    // Extend the file
    {
        let mut file = OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap();
        file.write_all(&vec![0u8; 4096]).unwrap();
        file.flush().unwrap();
    }

    // Old mapping still valid (maps first 4096 bytes)
    assert_eq!(mmap.len(), 4096);

    drop(mmap);

    // New mapping sees extended size
    let mmap_new = MmapOptions::new().path(&path).map_readonly().unwrap();

    assert_eq!(mmap_new.len(), 8192);
}

#[test]
fn test_zero_size_mapping_fails() {
    let file = create_test_file(0, 0x00);

    let result = MmapOptions::new().path(file.path()).map_readonly();

    assert!(result.is_err(), "Zero-sized mappings should fail");
}

#[test]
fn test_valid_range_mapping() {
    let file = create_test_file(16384, 0xAA);

    // Map middle portion (offset must be page-aligned)
    let page_size = 4096; // Common page size
    let mmap = MmapOptions::new()
        .path(file.path())
        .offset(page_size as u64)
        .len(page_size)
        .map_readonly()
        .unwrap();

    assert_eq!(mmap.len(), page_size);
    assert_eq!(mmap[0], 0xAA);
}
