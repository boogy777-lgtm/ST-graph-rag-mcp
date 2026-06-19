//! File locking integration example
//!
//! Demonstrates safe concurrent access using file locks.

use mmap_rs::{FileLock, LockType, MmapOptions, Result};
use std::io::Write;
use std::thread;
use std::time::Duration;
use tempfile::NamedTempFile;

fn main() -> Result<()> {
    println!("=== File Locking Example ===\n");

    // Create a test file
    let mut file = NamedTempFile::new().unwrap();
    let data = vec![0u8; 4096];
    file.write_all(&data).unwrap();
    file.flush().unwrap();

    let path = file.path().to_path_buf();

    // Example 1: Shared (read) locks
    println!("1. Multiple shared locks (readers):");
    {
        let file1 = std::fs::File::open(&path).unwrap();
        let file2 = std::fs::File::open(&path).unwrap();

        let lock1 = FileLock::lock(file1, LockType::Shared)?;
        println!("   ✓ Acquired shared lock 1");

        let lock2 = FileLock::lock(file2, LockType::Shared)?;
        println!("   ✓ Acquired shared lock 2 (multiple readers allowed)");

        // Both can read simultaneously
        let _mmap1 = MmapOptions::new().path(&path).map_readonly()?;
        let _mmap2 = MmapOptions::new().path(&path).map_readonly()?;

        println!("   ✓ Both readers can access the file");

        drop(lock1);
        drop(lock2);
        println!("   ✓ Locks released\n");
    }

    // Example 2: Exclusive (write) lock
    println!("2. Exclusive lock (single writer):");
    {
        let file = std::fs::File::open(&path).unwrap();
        let lock = FileLock::lock(file, LockType::Exclusive)?;
        println!("   ✓ Acquired exclusive lock");

        let mut mmap = MmapOptions::new().path(&path).map_readwrite()?;

        mmap[0] = 42;
        println!("   ✓ Modified file while holding exclusive lock");

        drop(lock);
        println!("   ✓ Exclusive lock released\n");
    }

    // Example 3: Try-lock (non-blocking)
    println!("3. Non-blocking try_lock:");
    {
        let file1 = std::fs::File::open(&path).unwrap();
        let file2 = std::fs::File::open(&path).unwrap();

        let lock1 = FileLock::lock(file1, LockType::Exclusive)?;
        println!("   ✓ Acquired exclusive lock");

        // Try to acquire another exclusive lock (should fail)
        match FileLock::try_lock(file2, LockType::Exclusive) {
            Ok(_) => println!("   ✗ Unexpected: got second exclusive lock"),
            Err(_) => println!("   ✓ try_lock correctly failed (would block)"),
        }

        drop(lock1);
        println!("   ✓ Lock released\n");
    }

    // Example 4: Safe concurrent access pattern
    println!("4. Safe multi-threaded access:");
    {
        let path_clone = path.clone();

        // Writer thread
        let writer = thread::spawn(move || -> Result<()> {
            let file = std::fs::File::open(&path_clone).unwrap();
            let _lock = FileLock::lock(file, LockType::Exclusive)?;

            let mut mmap = MmapOptions::new().path(&path_clone).map_readwrite()?;

            mmap[0] = 100;
            println!("   [Writer] Modified data");
            thread::sleep(Duration::from_millis(100));

            Ok(())
        });

        thread::sleep(Duration::from_millis(50));

        // Reader thread
        let reader = thread::spawn(move || -> Result<()> {
            let file = std::fs::File::open(&path).unwrap();
            let _lock = FileLock::lock(file, LockType::Shared)?;

            let mmap = MmapOptions::new().path(&path).map_readonly()?;

            println!("   [Reader] Read data: {}", mmap[0]);

            Ok(())
        });

        writer.join().unwrap()?;
        reader.join().unwrap()?;

        println!("   ✓ Safe concurrent access completed\n");
    }

    println!("✓ All file locking examples completed successfully!");

    Ok(())
}
