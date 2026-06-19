//! Copy-on-Write (COW) mapping example
//!
//! Demonstrates private mappings where writes don't affect the original file.

use mmap_rs::{MmapOptions, Result};
use std::io::Write;
use tempfile::NamedTempFile;

fn main() -> Result<()> {
    println!("=== Copy-on-Write (COW) Mapping Example ===\n");

    // Create a test file
    let mut file = NamedTempFile::new().unwrap();
    let original_data = b"Original file content - should not change!";
    file.write_all(original_data).unwrap();
    file.flush().unwrap();

    println!(
        "Original file content: {:?}",
        std::str::from_utf8(original_data).unwrap()
    );

    #[cfg(unix)]
    {
        // Create a private (COW) mapping
        let mut mmap = MmapOptions::new()
            .path(file.path())
            .private() // Enable copy-on-write
            .map_readwrite()?;

        println!("\nCreated private (COW) mapping");
        println!(
            "Initial mapping content: {:?}",
            std::str::from_utf8(&mmap[..original_data.len()]).unwrap()
        );

        // Modify the mapping - this creates a private copy
        let new_data = b"Modified in memory!!!";
        mmap[..new_data.len()].copy_from_slice(new_data);

        println!(
            "\nModified mapping content: {:?}",
            std::str::from_utf8(&mmap[..new_data.len()]).unwrap()
        );

        // Drop the mapping
        drop(mmap);

        // Read the file again - it should be unchanged!
        let mmap_verify = MmapOptions::new().path(file.path()).map_readonly()?;

        println!(
            "\nFile content after COW write: {:?}",
            std::str::from_utf8(&mmap_verify[..original_data.len()]).unwrap()
        );

        // Verify the file wasn't modified
        assert_eq!(&mmap_verify[..original_data.len()], original_data);
        println!("\n✓ File was NOT modified (COW worked correctly!)");
    }

    #[cfg(not(unix))]
    {
        println!("\nCOW mapping control is Unix-specific.");
        println!("On Windows, use shared mappings or file-backed sections.");
    }

    Ok(())
}
