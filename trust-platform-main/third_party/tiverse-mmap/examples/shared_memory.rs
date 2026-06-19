//! Shared Memory IPC Example
//!
//! Demonstrates inter-process communication using shared memory mappings.
//! This example shows how multiple processes can communicate through
//! a memory-mapped file using atomic operations for synchronization.
//!
//! # Use Cases
//! - High-performance IPC between processes
//! - Producer-consumer patterns
//! - Shared cache or buffer pools
//! - Lock-free data structures
//!
//! # Safety
//! When using shared memory across processes:
//! - Use atomic operations for synchronization
//! - Consider using file locks for exclusive access
//! - Be aware of cache coherency on multi-core systems
//! - Ensure processes coordinate lifecycle (don't unmap while others use it)

use mmap_rs::{MmapOptions, Result};
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::thread;
use std::time::Duration;

/// Shared memory structure for IPC
///
/// Layout: [counter: u64][data: u32][...]
#[repr(C)]
struct SharedData {
    /// Message counter (atomically incremented)
    counter: AtomicU64,
    /// Shared data value
    data: AtomicU32,
    /// Padding to prevent false sharing (64 bytes = typical cache line)
    _padding: [u8; 48],
}

impl SharedData {
    /// Create a reference to shared data from raw pointer
    ///
    /// # Safety
    /// The pointer must point to properly initialized SharedData
    unsafe fn from_ptr<'a>(ptr: *mut u8) -> &'a Self {
        &*(ptr as *const Self)
    }
}

fn main() -> Result<()> {
    println!("=== Shared Memory IPC Example ===\n");

    // Create or open shared memory file
    let shared_path = "/tmp/mmap_rs_shared_example.dat";

    // Example 1: Simple shared counter
    example_1_shared_counter(shared_path)?;

    // Example 2: Producer-consumer pattern
    example_2_producer_consumer(shared_path)?;

    // Example 3: With file locking
    example_3_with_locking(shared_path)?;

    // Cleanup
    let _ = std::fs::remove_file(shared_path);

    println!("\n✓ All shared memory examples completed!");
    Ok(())
}

/// Example 1: Simple shared counter between threads
fn example_1_shared_counter(path: &str) -> Result<()> {
    println!("1. Shared Counter Example:");
    println!("   Multiple threads incrementing a shared counter\n");

    // Create shared memory file
    std::fs::write(path, vec![0u8; 4096])?;

    // Map as read-write, shared
    let mmap = MmapOptions::new().path(path).map_readwrite()?;

    // Get reference to shared data
    let shared = unsafe { SharedData::from_ptr(mmap.as_ptr() as *mut u8) };

    // Reset counter
    shared.counter.store(0, Ordering::SeqCst);

    // Spawn multiple threads to increment counter
    let handles: Vec<_> = (0..4)
        .map(|id| {
            // Clone the path for each thread (in real IPC, each process opens separately)
            let thread_path = path.to_string();
            thread::spawn(move || -> Result<()> {
                // Each thread maps the shared memory
                let thread_mmap = MmapOptions::new().path(&thread_path).map_readwrite()?;

                let thread_shared =
                    unsafe { SharedData::from_ptr(thread_mmap.as_ptr() as *mut u8) };

                // Increment counter 1000 times
                for _ in 0..1000 {
                    thread_shared.counter.fetch_add(1, Ordering::SeqCst);
                    thread::sleep(Duration::from_micros(1));
                }

                println!("   Thread {} completed", id);
                Ok(())
            })
        })
        .collect();

    // Wait for all threads
    for handle in handles {
        handle.join().unwrap()?;
    }

    // Check final count
    let final_count = shared.counter.load(Ordering::SeqCst);
    println!("   Final count: {} (expected: 4000)", final_count);
    assert_eq!(final_count, 4000, "Counter mismatch!");
    println!("   ✓ Atomicity verified\n");

    Ok(())
}

/// Example 2: Producer-consumer pattern
fn example_2_producer_consumer(path: &str) -> Result<()> {
    println!("2. Producer-Consumer Pattern:");
    println!("   One thread writes, another reads\n");

    // Create fresh shared memory
    std::fs::write(path, vec![0u8; 4096])?;

    let mmap = MmapOptions::new().path(path).map_readwrite()?;

    let shared = unsafe { SharedData::from_ptr(mmap.as_ptr() as *mut u8) };
    shared.counter.store(0, Ordering::SeqCst);
    shared.data.store(0, Ordering::SeqCst);

    let producer_path = path.to_string();
    let consumer_path = path.to_string();

    // Producer thread
    let producer = thread::spawn(move || -> Result<()> {
        let mmap = MmapOptions::new().path(&producer_path).map_readwrite()?;

        let shared = unsafe { SharedData::from_ptr(mmap.as_ptr() as *mut u8) };

        for i in 1..=10 {
            // Write data
            shared.data.store(i * 100, Ordering::Release);

            // Signal that data is ready (increment counter)
            shared.counter.fetch_add(1, Ordering::Release);

            println!("   [Producer] Wrote: {}", i * 100);
            thread::sleep(Duration::from_millis(10));
        }

        Ok(())
    });

    // Consumer thread
    let consumer = thread::spawn(move || -> Result<()> {
        let mmap = MmapOptions::new().path(&consumer_path).map_readwrite()?;

        let shared = unsafe { SharedData::from_ptr(mmap.as_ptr() as *mut u8) };

        let mut last_count = 0;
        let mut values_read = 0;

        while values_read < 10 {
            let current_count = shared.counter.load(Ordering::Acquire);

            if current_count > last_count {
                // New data available
                let value = shared.data.load(Ordering::Acquire);
                println!("   [Consumer] Read: {}", value);

                last_count = current_count;
                values_read += 1;
            } else {
                // Wait for new data
                thread::sleep(Duration::from_millis(5));
            }
        }

        Ok(())
    });

    // Wait for both
    producer.join().unwrap()?;
    consumer.join().unwrap()?;

    println!("   ✓ Producer-consumer communication verified\n");

    Ok(())
}

/// Example 3: With file locking for exclusive access
fn example_3_with_locking(path: &str) -> Result<()> {
    println!("3. Shared Memory with File Locking:");
    println!("   Safe concurrent access using locks\n");

    use mmap_rs::{FileLock, LockType};

    // Create shared memory
    std::fs::write(path, vec![0u8; 4096])?;

    let handles: Vec<_> = (0..3)
        .map(|id| {
            let thread_path = path.to_string();
            thread::spawn(move || -> Result<()> {
                // Acquire exclusive lock
                let file = std::fs::OpenOptions::new()
                    .read(true)
                    .write(true)
                    .open(&thread_path)?;
                let _lock = FileLock::lock(file, LockType::Exclusive)?;
                println!("   Thread {} acquired lock", id);

                // Map shared memory
                let mut mmap = MmapOptions::new().path(&thread_path).map_readwrite()?;

                // Critical section: read, modify, write
                let old_value = mmap[0];
                thread::sleep(Duration::from_millis(10)); // Simulate work
                mmap[0] = old_value.wrapping_add(1);

                println!(
                    "   Thread {} incremented value: {} -> {}",
                    id, old_value, mmap[0]
                );

                // Lock automatically released when _lock drops
                Ok(())
            })
        })
        .collect();

    // Wait for all
    for handle in handles {
        handle.join().unwrap()?;
    }

    // Verify final value
    let mmap = MmapOptions::new().path(path).map_readonly()?;

    println!("   Final value: {} (expected: 3)", mmap[0]);
    assert_eq!(mmap[0], 3, "Lock didn't prevent race condition!");
    println!("   ✓ File locking prevented race conditions\n");

    Ok(())
}
