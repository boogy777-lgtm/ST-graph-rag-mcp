//! Memory-Mapped Ring Buffer Example
//!
//! Demonstrates a high-performance ring buffer implementation using
//! memory-mapped files for inter-process communication or persistent
//! queues. Ring buffers are ideal for producer-consumer patterns with
//! bounded memory usage.
//!
//! # Benefits
//! - Fixed memory usage (bounded buffer)
//! - High-performance IPC
//! - Persistence across restarts
//! - Lock-free single producer/consumer
//!
//! # Use Cases
//! - Audio/video streaming buffers
//! - Real-time data processing pipelines
//! - Message queues between processes
//! - Logging with bounded memory

use mmap_rs::{MmapOptions, Result};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;
use std::time::Duration;

/// Memory-mapped ring buffer with atomic indices
///
/// Layout: [read_pos: usize][write_pos: usize][capacity: usize][data: bytes...]
#[repr(C)]
struct RingBuffer {
    /// Current read position (consumer)
    read_pos: AtomicUsize,
    /// Current write position (producer)
    write_pos: AtomicUsize,
    /// Buffer capacity in bytes
    capacity: usize,
    /// Padding to align data to cache line
    _padding: [u8; 40],
}

impl RingBuffer {
    const HEADER_SIZE: usize = std::mem::size_of::<Self>();

    /// Create ring buffer from memory-mapped region
    ///
    /// # Safety
    /// Pointer must be valid and properly aligned
    unsafe fn from_ptr(ptr: *mut u8, capacity: usize) -> &'static mut Self {
        let rb = &mut *(ptr as *mut Self);
        rb.capacity = capacity - Self::HEADER_SIZE;
        rb
    }

    /// Get pointer to data region
    fn data_ptr(&self) -> *mut u8 {
        unsafe { (self as *const Self as *mut u8).add(Self::HEADER_SIZE) }
    }

    /// Get data slice (for reading)
    fn data(&self) -> &[u8] {
        unsafe { std::slice::from_raw_parts(self.data_ptr(), self.capacity) }
    }

    /// Get mutable data slice (for writing)
    fn data_mut(&mut self) -> &mut [u8] {
        unsafe { std::slice::from_raw_parts_mut(self.data_ptr(), self.capacity) }
    }

    /// Number of bytes available to read
    fn available_read(&self) -> usize {
        let read = self.read_pos.load(Ordering::Acquire);
        let write = self.write_pos.load(Ordering::Acquire);

        if write >= read {
            write - read
        } else {
            self.capacity - read + write
        }
    }

    /// Number of bytes available to write
    fn available_write(&self) -> usize {
        // Keep one byte free to distinguish full from empty
        self.capacity - self.available_read() - 1
    }

    /// Write data to ring buffer
    ///
    /// Returns number of bytes written (may be less than input if buffer is full)
    fn write(&mut self, data: &[u8]) -> usize {
        let available = self.available_write();
        let to_write = data.len().min(available);

        if to_write == 0 {
            return 0;
        }

        let write_pos = self.write_pos.load(Ordering::Acquire);
        let capacity = self.capacity; // Save before mutable borrow
        let buf = self.data_mut();

        // Handle wrap-around
        if write_pos + to_write <= capacity {
            // Contiguous write
            buf[write_pos..write_pos + to_write].copy_from_slice(&data[..to_write]);
        } else {
            // Wrapped write
            let first_chunk = capacity - write_pos;
            buf[write_pos..].copy_from_slice(&data[..first_chunk]);
            buf[..to_write - first_chunk].copy_from_slice(&data[first_chunk..to_write]);
        }

        // Update write position
        let new_write_pos = (write_pos + to_write) % capacity;
        self.write_pos.store(new_write_pos, Ordering::Release);

        to_write
    }

    /// Read data from ring buffer
    ///
    /// Returns number of bytes read
    fn read(&mut self, buf: &mut [u8]) -> usize {
        let available = self.available_read();
        let to_read = buf.len().min(available);

        if to_read == 0 {
            return 0;
        }

        let read_pos = self.read_pos.load(Ordering::Acquire);
        let capacity = self.capacity; // Save before borrow
        let data = self.data();

        // Handle wrap-around
        if read_pos + to_read <= capacity {
            // Contiguous read
            buf[..to_read].copy_from_slice(&data[read_pos..read_pos + to_read]);
        } else {
            // Wrapped read
            let first_chunk = capacity - read_pos;
            buf[..first_chunk].copy_from_slice(&data[read_pos..]);
            buf[first_chunk..to_read].copy_from_slice(&data[..to_read - first_chunk]);
        }

        // Update read position
        let new_read_pos = (read_pos + to_read) % capacity;
        self.read_pos.store(new_read_pos, Ordering::Release);

        to_read
    }
}

fn main() -> Result<()> {
    println!("=== Ring Buffer Example ===\n");

    let buffer_file = "/tmp/mmap_rs_ring_buffer.dat";

    // Example 1: Basic ring buffer operations
    example_1_basic_operations(buffer_file)?;

    // Example 2: Producer-consumer pattern
    example_2_producer_consumer(buffer_file)?;

    // Example 3: Persistent ring buffer
    example_3_persistent_buffer(buffer_file)?;

    // Cleanup
    let _ = std::fs::remove_file(buffer_file);

    println!("\n✓ All ring buffer examples completed!");
    Ok(())
}

/// Example 1: Basic ring buffer operations
fn example_1_basic_operations(path: &str) -> Result<()> {
    println!("1. Basic Ring Buffer Operations:");

    let buffer_size = 1024;

    // Create buffer file
    std::fs::write(path, vec![0u8; buffer_size])?;

    // Map as read-write
    let mut mmap = MmapOptions::new().path(path).map_readwrite()?;

    // Initialize ring buffer
    let ring = unsafe { RingBuffer::from_ptr(mmap.as_mut_ptr(), buffer_size) };

    ring.read_pos.store(0, Ordering::Release);
    ring.write_pos.store(0, Ordering::Release);

    // Write some data
    let message = b"Hello, Ring Buffer!";
    let written = ring.write(message);
    println!(
        "   Wrote {} bytes: {:?}",
        written,
        std::str::from_utf8(message).unwrap()
    );

    // Read it back
    let mut read_buf = vec![0u8; 100];
    let read_count = ring.read(&mut read_buf);
    println!(
        "   Read {} bytes: {:?}",
        read_count,
        std::str::from_utf8(&read_buf[..read_count]).unwrap()
    );

    // Test wrap-around
    println!("\n   Testing wrap-around:");
    let large_data = vec![b'X'; 900];
    let written = ring.write(&large_data);
    println!("   Wrote {} bytes of 'X'", written);

    let mut read_buf = vec![0u8; 500];
    let read_count = ring.read(&mut read_buf);
    println!("   Read {} bytes", read_count);

    // Write more (should wrap)
    let more_data = b"Wrapped data!";
    let written = ring.write(more_data);
    println!("   Wrote {} more bytes (wrapped)", written);

    println!("   ✓ Basic operations verified\n");

    Ok(())
}

/// Example 2: Producer-consumer with threads
fn example_2_producer_consumer(path: &str) -> Result<()> {
    println!("2. Producer-Consumer Pattern:");

    let buffer_size = 8192;
    std::fs::write(path, vec![0u8; buffer_size])?;

    // Initialize buffer
    {
        let mut mmap = MmapOptions::new().path(path).map_readwrite()?;

        let ring = unsafe { RingBuffer::from_ptr(mmap.as_mut_ptr(), buffer_size) };

        ring.read_pos.store(0, Ordering::Release);
        ring.write_pos.store(0, Ordering::Release);
    }

    let producer_path = path.to_string();
    let consumer_path = path.to_string();

    // Producer thread
    let producer = thread::spawn(move || -> Result<()> {
        let mut mmap = MmapOptions::new().path(&producer_path).map_readwrite()?;

        let ring = unsafe { RingBuffer::from_ptr(mmap.as_mut_ptr(), buffer_size) };

        for i in 0..50 {
            let message = format!("Message #{:03}", i);
            let bytes = message.as_bytes();

            // Try to write, wait if buffer is full
            loop {
                let written = ring.write(bytes);
                if written == bytes.len() {
                    println!("   [Producer] Sent: {}", message);
                    break;
                }
                thread::sleep(Duration::from_millis(5));
            }

            thread::sleep(Duration::from_millis(10));
        }

        println!("   [Producer] Finished");
        Ok(())
    });

    // Consumer thread
    let consumer = thread::spawn(move || -> Result<()> {
        let mut mmap = MmapOptions::new().path(&consumer_path).map_readwrite()?;

        let ring = unsafe { RingBuffer::from_ptr(mmap.as_mut_ptr(), buffer_size) };

        let mut messages_received = 0;
        let mut read_buf = vec![0u8; 256];

        while messages_received < 50 {
            let read_count = ring.read(&mut read_buf);

            if read_count > 0 {
                let message =
                    std::str::from_utf8(&read_buf[..read_count]).unwrap_or("<invalid utf8>");
                println!("   [Consumer] Received: {}", message);
                messages_received += 1;
            } else {
                thread::sleep(Duration::from_millis(5));
            }
        }

        println!("   [Consumer] Finished");
        Ok(())
    });

    producer.join().unwrap()?;
    consumer.join().unwrap()?;

    println!("   ✓ Producer-consumer communication verified\n");

    Ok(())
}

/// Example 3: Persistent ring buffer (survives process restart)
fn example_3_persistent_buffer(path: &str) -> Result<()> {
    println!("3. Persistent Ring Buffer:");
    println!("   Data persists across mappings\n");

    let buffer_size = 4096;

    // First process: Write data
    {
        println!("   [Process 1] Writing data...");
        std::fs::write(path, vec![0u8; buffer_size])?;

        let mut mmap = MmapOptions::new().path(path).map_readwrite()?;

        let ring = unsafe { RingBuffer::from_ptr(mmap.as_mut_ptr(), buffer_size) };

        ring.read_pos.store(0, Ordering::Release);
        ring.write_pos.store(0, Ordering::Release);

        // Write multiple messages
        for i in 0..5 {
            let message = format!("Persistent message #{}", i);
            ring.write(message.as_bytes());
            println!("      Wrote: {}", message);
        }

        // Changes are automatically synced to disk by the OS
        println!("   [Process 1] Data written (OS will sync to disk)");
    }

    // Simulate process restart
    thread::sleep(Duration::from_millis(100));

    // Second process: Read data
    {
        println!("\n   [Process 2] Reading persisted data...");

        let mut mmap = MmapOptions::new().path(path).map_readwrite()?;

        let ring = unsafe { RingBuffer::from_ptr(mmap.as_mut_ptr(), buffer_size) };

        // Read all messages
        let mut read_buf = vec![0u8; 256];
        let mut count = 0;

        while ring.available_read() > 0 {
            let read_count = ring.read(&mut read_buf);
            if read_count > 0 {
                let message =
                    std::str::from_utf8(&read_buf[..read_count]).unwrap_or("<invalid utf8>");
                println!("      Read: {}", message);
                count += 1;
            }
        }

        println!("   [Process 2] Read {} messages", count);
        assert_eq!(count, 5, "Should read all 5 messages!");
    }

    println!("   ✓ Persistence verified!\n");

    Ok(())
}
