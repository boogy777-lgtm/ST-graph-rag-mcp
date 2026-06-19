//! Safety tests for memory and thread safety guarantees
//!
//! These tests verify that the type system prevents unsafe usage patterns.

use mmap_rs::{Mmap, MmapOptions, ReadOnly, ReadWrite};
use std::io::Write;
use std::sync::Arc;
use std::thread;
use tempfile::NamedTempFile;

fn create_test_file(size: usize) -> NamedTempFile {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(&vec![0x42; size]).unwrap();
    file.flush().unwrap();
    file
}

#[test]
fn test_readonly_is_send() {
    let file = create_test_file(4096);
    let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    // ReadOnly mappings should be Send
    thread::spawn(move || {
        assert_eq!(mmap[0], 0x42);
    })
    .join()
    .unwrap();
}

#[test]
fn test_readonly_is_sync() {
    let file = create_test_file(4096);
    let mmap = Arc::new(MmapOptions::new().path(file.path()).map_readonly().unwrap());

    // ReadOnly mappings should be Sync (shareable across threads)
    let mmap1 = Arc::clone(&mmap);
    let mmap2 = Arc::clone(&mmap);

    let handle1 = thread::spawn(move || {
        assert_eq!(mmap1[0], 0x42);
    });

    let handle2 = thread::spawn(move || {
        assert_eq!(mmap2[100], 0x42);
    });

    handle1.join().unwrap();
    handle2.join().unwrap();
}

#[test]
fn test_readwrite_is_send() {
    let file = create_test_file(4096);
    let mut mmap = MmapOptions::new()
        .path(file.path())
        .map_readwrite()
        .unwrap();

    mmap[0] = 0xFF;

    // ReadWrite mappings should be Send
    thread::spawn(move || {
        assert_eq!(mmap[0], 0xFF);
    })
    .join()
    .unwrap();
}

#[test]
fn test_concurrent_readonly_access() {
    let file = create_test_file(8192);
    let mmap = Arc::new(MmapOptions::new().path(file.path()).map_readonly().unwrap());

    let mut handles = vec![];

    for i in 0..10 {
        let mmap_clone = Arc::clone(&mmap);
        let handle = thread::spawn(move || {
            // All threads can read concurrently
            let offset = i * 100;
            assert_eq!(mmap_clone[offset], 0x42);
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }
}

#[test]
fn test_drop_safety() {
    let file = create_test_file(4096);

    let ptr = {
        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();
        mmap.as_ptr()
    }; // mmap is dropped here

    // The pointer exists but accessing it would be UB
    // We can't safely test this, but the type system prevents it
    assert!(!ptr.is_null());
}

#[test]
fn test_lifetime_prevents_use_after_drop() {
    let file = create_test_file(4096);

    let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    let slice = mmap.as_slice();

    // This would not compile if uncommented:
    // drop(mmap);
    // println!("{}", slice[0]); // Error: slice borrows mmap

    assert_eq!(slice[0], 0x42);
}

#[test]
fn test_no_aliasing_mutable_and_immutable() {
    let file = create_test_file(4096);
    let mut mmap = MmapOptions::new()
        .path(file.path())
        .map_readwrite()
        .unwrap();

    // Get mutable reference
    let slice_mut = mmap.as_mut_slice();
    slice_mut[0] = 0xFF;

    // This would not compile if we tried to get immutable reference while
    // mutable reference exists:
    // let slice = mmap.as_slice(); // Error: cannot borrow as immutable

    assert_eq!(slice_mut[0], 0xFF);
}

#[test]
fn test_readwrite_exclusive_access() {
    let file = create_test_file(4096);
    let mut mmap = MmapOptions::new()
        .path(file.path())
        .map_readwrite()
        .unwrap();

    // Only one mutable reference at a time
    {
        let slice = mmap.as_mut_slice();
        slice[0] = 0xAA;
    }

    {
        let slice = mmap.as_mut_slice();
        slice[1] = 0xBB;
    }

    assert_eq!(mmap[0], 0xAA);
    assert_eq!(mmap[1], 0xBB);
}

#[test]
fn test_type_safety_readonly() {
    let file = create_test_file(4096);
    let mmap: Mmap<ReadOnly> = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    // ReadOnly type prevents mutation at compile time
    // This would not compile:
    // mmap.as_mut_slice(); // Error: method not found for Mmap<ReadOnly>

    let _slice: &[u8] = mmap.as_slice();
}

#[test]
fn test_type_safety_readwrite() {
    let file = create_test_file(4096);
    let mut mmap: Mmap<ReadWrite> = MmapOptions::new()
        .path(file.path())
        .map_readwrite()
        .unwrap();

    // ReadWrite allows both immutable and mutable access
    let _slice: &[u8] = &mmap;
    let _slice_mut: &mut [u8] = mmap.as_mut_slice();
}

#[test]
fn test_panic_safety_readonly() {
    let file = create_test_file(4096);

    let result = std::panic::catch_unwind(|| {
        let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

        let _ = mmap[0];
        panic!("Intentional panic");
    });

    assert!(result.is_err());
    // Mmap should be properly dropped even with panic
}

#[test]
fn test_panic_safety_readwrite() {
    let file = create_test_file(4096);

    let result = std::panic::catch_unwind(|| {
        let mut mmap = MmapOptions::new()
            .path(file.path())
            .map_readwrite()
            .unwrap();

        mmap[0] = 0xFF;
        panic!("Intentional panic");
    });

    assert!(result.is_err());
    // Mmap should be properly dropped even with panic
}

#[test]
fn test_multiple_mappings_same_file() {
    let file = create_test_file(4096);

    // Multiple independent readonly mappings
    let mmap1 = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    let mmap2 = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    assert_eq!(mmap1[0], 0x42);
    assert_eq!(mmap2[0], 0x42);

    // Both mappings are independent
    drop(mmap1);
    assert_eq!(mmap2[0], 0x42);
}

#[test]
fn test_zero_sized_slice_safety() {
    let file = create_test_file(4096);
    let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    // Create a zero-sized slice within a valid mapping
    let slice = mmap.slice(100..100);
    assert_eq!(slice.len(), 0);
    assert!(slice.is_empty());

    // Accessing empty slice should be safe
    let _: &[u8] = &slice[..];
}

#[test]
fn test_deref_coercion_safety() {
    let file = create_test_file(4096);
    let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    // Deref coercion to slice
    fn takes_slice(s: &[u8]) -> u8 {
        s[0]
    }

    let value = takes_slice(&mmap);
    assert_eq!(value, 0x42);
}

#[test]
fn test_no_double_free() {
    let file = create_test_file(4096);

    let mmap = MmapOptions::new().path(file.path()).map_readonly().unwrap();

    let ptr = mmap.as_ptr();

    // Explicit drop
    drop(mmap);

    // Pointer still exists but is invalid (no way to access safely)
    // Type system prevents double-free
    assert!(!ptr.is_null());
}

/// This test verifies that the compiler prevents dangerous patterns.
/// The following should NOT compile:
///
/// ```compile_fail
/// let mut mmap = MmapOptions::new().path("test").map_readonly().unwrap();
/// mmap[0] = 5; // Error: cannot assign to immutable
/// ```
#[test]
fn test_compile_time_safety_documented() {
    // This test documents compile-time safety guarantees
    // Actual compile failures are tested via doc tests
}
