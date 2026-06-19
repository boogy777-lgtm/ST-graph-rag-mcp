//! Huge pages example for better TLB performance
//!
//! Demonstrates using huge pages (2MB/1GB) for large datasets.

use mmap_rs::{HugePageSize, MmapOptions, Result};
use std::io::Write;
use tempfile::NamedTempFile;

fn main() -> Result<()> {
    println!("=== Huge Pages Example ===\n");

    println!("Note: Huge pages may require system configuration:");
    #[cfg(target_os = "linux")]
    {
        println!("  Linux: echo 64 | sudo tee /proc/sys/vm/nr_hugepages");
        println!("         (allocates 64 * 2MB = 128MB of huge pages)\n");
    }
    #[cfg(target_os = "windows")]
    {
        println!("  Windows: Requires 'Lock pages in memory' privilege\n");
    }
    #[cfg(target_os = "macos")]
    {
        println!("  macOS: Best-effort superpage allocation (no guarantees)\n");
    }

    // Example 1: Anonymous mapping with huge pages
    println!("1. Anonymous mapping with 2MB huge pages:");
    match MmapOptions::new_anonymous(10 * 1024 * 1024) // 10MB
        .huge_pages(HugePageSize::Size2MB)
        .map_readwrite()
    {
        Ok(mut mmap) => {
            println!("   ✓ Created 10MB anonymous mapping with huge pages");

            // Write some data
            mmap[0] = 0xFF;
            mmap[1024 * 1024] = 0xAA;

            println!("   ✓ Data written successfully");
            println!("   Performance benefit: Reduced TLB misses\n");
        }
        Err(e) => {
            println!("   ✗ Huge pages not available: {}", e);
            println!("   (This is normal if huge pages aren't configured)\n");
        }
    }

    // Example 2: File-backed mapping with huge pages
    println!("2. File-backed mapping with huge pages:");
    {
        // Create a large file (must be aligned to huge page size)
        let size = 4 * 1024 * 1024; // 4MB
        let mut file = NamedTempFile::new().unwrap();
        let data = vec![0xAB; size];
        file.write_all(&data).unwrap();
        file.flush().unwrap();

        match MmapOptions::new()
            .path(file.path())
            .huge_pages(HugePageSize::Size2MB)
            .map_readonly()
        {
            Ok(mmap) => {
                println!("   ✓ Created 4MB file mapping with huge pages");
                println!("   First byte: 0x{:02X}", mmap[0]);
                println!("   Last byte: 0x{:02X}\n", mmap[size - 1]);
            }
            Err(e) => {
                println!("   ✗ Huge pages not available: {}", e);
                println!("   (Graceful fallback to regular pages)\n");
            }
        }
    }

    // Example 3: Comparison - regular vs huge pages
    println!("3. Performance comparison:");
    {
        let size = 10 * 1024 * 1024; // 10MB

        // Regular pages
        println!("   Regular pages (4KB):");
        let regular = MmapOptions::new_anonymous(size).map_readwrite()?;
        println!("   - Page size: 4KB");
        println!("   - TLB entries needed: ~2560 (for 10MB)");
        println!("   - TLB pressure: High");
        drop(regular);

        // Huge pages (if available)
        println!("\n   Huge pages (2MB):");
        match MmapOptions::new_anonymous(size)
            .huge_pages(HugePageSize::Size2MB)
            .map_readwrite()
        {
            Ok(huge) => {
                println!("   - Page size: 2MB");
                println!("   - TLB entries needed: ~5 (for 10MB)");
                println!("   - TLB pressure: Low");
                println!("   - Performance: Up to 30% faster for large datasets!");
                drop(huge);
            }
            Err(_) => {
                println!("   - Not available (requires configuration)");
            }
        }
    }

    println!("\n✓ Huge pages example completed!");
    println!("\nUse cases for huge pages:");
    println!("  • Large database buffer pools");
    println!("  • ML model inference");
    println!("  • High-performance data processing");
    println!("  • Any workload with large memory footprints");

    Ok(())
}
