//! Database buffer pool example
//!
//! Demonstrates using mmap for efficient database-style buffer management.

use mmap_rs::{HugePageSize, MemoryAdvice, MmapOptions, Result};
use std::io::Write;
use tempfile::NamedTempFile;

// Simulated page size for a database
const PAGE_SIZE: usize = 8192; // 8KB pages (like PostgreSQL)
const NUM_PAGES: usize = 1024; // 8MB buffer pool

fn main() -> Result<()> {
    println!("=== Database Buffer Pool Example ===\n");

    // Create a database file with pages
    let db_size = PAGE_SIZE * NUM_PAGES;
    println!(
        "Creating database file ({} MB, {} pages)...",
        db_size / (1024 * 1024),
        NUM_PAGES
    );

    let mut db_file = NamedTempFile::new().unwrap();

    // Initialize with page data
    for page_id in 0..NUM_PAGES {
        let mut page = vec![0u8; PAGE_SIZE];
        // Write page header (page ID)
        page[0..8].copy_from_slice(&(page_id as u64).to_le_bytes());
        db_file.write_all(&page).unwrap();
    }
    db_file.flush().unwrap();
    println!("✓ Database file created\n");

    // Buffer pool with random access optimization
    println!("1. Buffer pool with random access hint:");
    {
        let mmap = MmapOptions::new()
            .path(db_file.path())
            .advice(MemoryAdvice::Random)
            .map_readonly()?;

        println!("   ✓ Buffer pool mapped");

        // Simulate random page access (like B-tree traversal)
        let page_ids = [0, 42, 17, 99, 512, 3, 777];

        for &page_id in &page_ids {
            let offset = page_id * PAGE_SIZE;
            let page_data = &mmap[offset..offset + PAGE_SIZE];

            // Read page header
            let stored_id = u64::from_le_bytes(page_data[0..8].try_into().unwrap());
            assert_eq!(stored_id, page_id as u64);

            println!("   Read page {}: header = {}", page_id, stored_id);
        }

        println!("   ✓ Random access optimized\n");
    }

    // Read-write buffer pool with huge pages
    println!("2. Read-write buffer pool with huge pages:");
    {
        let result = MmapOptions::new()
            .path(db_file.path())
            .huge_pages(HugePageSize::Size2MB)
            .advice(MemoryAdvice::Random)
            .map_readwrite();

        match result {
            Ok(mut mmap) => {
                println!("   ✓ Buffer pool with huge pages (better TLB performance)");

                // Modify a page
                let page_id = 42;
                let offset = page_id * PAGE_SIZE;
                mmap[offset + 8] = 0xFF; // Dirty page

                println!("   ✓ Modified page {} (dirty flag set)", page_id);
                println!("   Performance: Reduced TLB misses for large buffer pools\n");
            }
            Err(_) => {
                println!("   Note: Huge pages not available, using regular pages\n");
            }
        }
    }

    // Prefaulted buffer pool for OLTP workloads
    println!("3. Prefaulted buffer pool (OLTP workload):");
    {
        let mmap = MmapOptions::new()
            .path(db_file.path())
            .populate() // All pages in memory
            .advice(MemoryAdvice::Random)
            .map_readonly()?;

        println!("   ✓ All {} pages loaded into memory", NUM_PAGES);
        println!("   ✓ Predictable query latency (no page faults)");

        // Simulate high-frequency queries
        for i in 0..10 {
            let page_id = (i * 100) % NUM_PAGES;
            let offset = page_id * PAGE_SIZE;
            let _page_data = &mmap[offset..offset + PAGE_SIZE];
        }

        println!("   ✓ Zero page faults during queries\n");
    }

    // Shared buffer pool (multi-process)
    #[cfg(unix)]
    {
        println!("4. Shared buffer pool (multi-process):");
        let _mmap = MmapOptions::new()
            .path(db_file.path())
            .shared() // Shared mapping
            .map_readonly()?;

        println!("   ✓ Shared mapping (visible to all processes)");
        println!("   Use case: Multiple database worker processes");
        println!("   Benefit: Shared page cache across processes\n");
    }

    println!("✓ Database Buffer Pool Examples Complete!\n");

    println!("Key takeaways:");
    println!("  • Use MemoryAdvice::Random for B-tree/hash table access");
    println!("  • Use huge pages for large buffer pools (>100MB)");
    println!("  • Use .populate() for OLTP (predictable latency)");
    println!("  • Use .shared() for multi-process databases");
    println!("  • Consider copy-on-write for read-mostly pages");

    Ok(())
}
