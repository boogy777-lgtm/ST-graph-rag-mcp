//! SIGBUS safety and truncation detection example
//!
//! Demonstrates how mmap-rs protects against file truncation issues.

use mmap_rs::{MmapOptions, Result};
use std::fs::OpenOptions;
use std::io::Write;
use tempfile::NamedTempFile;

fn main() -> Result<()> {
    println!("=== SIGBUS Safety Example ===\n");

    println!("SIGBUS occurs when accessing memory-mapped regions of truncated files.");
    println!("mmap-rs prevents this with validation and detection.\n");

    // Example 1: Pre-mapping validation
    println!("1. Pre-mapping file size validation:");
    {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(&vec![0u8; 4096]).unwrap();
        file.flush().unwrap();

        // Try to map beyond file size
        let result = MmapOptions::new()
            .path(file.path())
            .offset(0)
            .len(8192) // Larger than file!
            .map_readonly();

        match result {
            Ok(_) => println!("   ✗ Should have failed!"),
            Err(e) => {
                println!("   ✓ Prevented invalid mapping: {}", e);
                println!("   Protection: Validation before mmap() call\n");
            }
        }
    }

    // Example 2: Safe file extension
    println!("2. Safe file extension pattern:");
    {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(&vec![0u8; 4096]).unwrap();
        file.flush().unwrap();

        let path = file.path().to_path_buf();

        // Initial mapping
        let mmap = MmapOptions::new().path(&path).map_readonly()?;

        println!("   ✓ Initial mapping: {} bytes", mmap.len());

        // Safely extend the file
        {
            let mut file = OpenOptions::new()
                .append(true)
                .open(&path)
                .unwrap();

            file.write_all(&vec![0u8; 4096]).unwrap();
            file.flush().unwrap();
        }

        println!("   ✓ File extended to 8192 bytes");
        println!("   Note: Old mapping still valid (maps first 4096 bytes)");
        println!("   Best practice: Create new mapping after extension\n");

        drop(mmap);

        // New mapping sees extended size
        let mmap_new = MmapOptions::new().path(&path).map_readonly()?;

        println!("   ✓ New mapping: {} bytes\n", mmap_new.len());
    }

    // Example 3: Truncation detection (when possible)
    println!("3. Truncation detection:");
    {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(&vec![0u8; 8192]).unwrap();
        file.flush().unwrap();

        let path = file.path().to_path_buf();

        #[cfg(unix)]
        {
            // Create mapping
            let mmap = MmapOptions::new().path(&path).map_readonly()?;

            println!("   ✓ Mapped {} bytes", mmap.len());

            // Truncate the file (dangerous!)
            {
                let file = OpenOptions::new().write(true).open(&path).unwrap();
                file.set_len(4096).unwrap();
            }

            println!("   ⚠ File truncated to 4096 bytes");
            println!("   Warning: Accessing beyond 4096 would cause SIGBUS");
            println!("   Protection: File handle kept alive, size tracked");
            println!("   Best practice: Create new mapping after truncation\n");

            // The old mapping still maps the original size, but accessing
            // beyond the truncation point is dangerous
            // Always create a new mapping after file size changes
            drop(mmap);
        }

        #[cfg(not(unix))]
        {
            println!("   Platform: Windows handles truncation differently\n");
        }
    }

    // Example 4: Safe patterns to avoid SIGBUS
    println!("4. Safe usage patterns:");
    println!("   ✓ Always validate file size before mapping");
    println!("   ✓ Keep file handle alive during mapping lifetime");
    println!("   ✓ Create new mapping after file modifications");
    println!("   ✓ Use advisory locks to coordinate access");
    println!("   ✓ Consider copy-on-write for read-modify scenarios\n");

    println!("✓ SIGBUS Safety Examples Complete!\n");

    println!("Best practices:");
    println!("  • Never truncate a file while it's mapped");
    println!("  • Remap after file size changes");
    println!("  • Use file locks for coordination");
    println!("  • Monitor for truncation in long-lived mappings");
    println!("  • Consider using resize() for growing files (Linux)");

    Ok(())
}
