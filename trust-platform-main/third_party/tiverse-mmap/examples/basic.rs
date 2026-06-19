//! Basic memory-mapped file example

use mmap_rs::{MmapOptions, Result};
use std::fs;
use std::io::Write;

fn main() -> Result<()> {
    // Create a test file
    let test_file = "test_mmap.dat";
    {
        let mut file = fs::File::create(test_file)?;
        file.write_all(b"Hello, memory-mapped world!")?;
    }

    // Read-only mapping
    println!("=== Read-only mapping ===");
    {
        let mmap = MmapOptions::new().path(test_file).map_readonly()?;

        println!("Mapped {} bytes", mmap.len());
        println!("Content: {}", std::str::from_utf8(&mmap).unwrap());
    }

    // Read-write mapping
    println!("\n=== Read-write mapping ===");
    {
        let mut mmap = MmapOptions::new().path(test_file).map_readwrite()?;

        println!(
            "Before modification: {}",
            std::str::from_utf8(&mmap).unwrap()
        );

        // Modify the mapped content
        mmap[0] = b'h'; // Change 'H' to 'h'

        println!(
            "After modification: {}",
            std::str::from_utf8(&mmap).unwrap()
        );
    }

    // Verify the change was persisted
    println!("\n=== Verifying persistence ===");
    {
        let mmap = MmapOptions::new().path(test_file).map_readonly()?;

        println!("File content: {}", std::str::from_utf8(&mmap).unwrap());
    }

    // Clean up
    fs::remove_file(test_file)?;
    println!("\n✓ Example completed successfully!");

    Ok(())
}
