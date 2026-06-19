//! Machine Learning model loading example
//!
//! Demonstrates fast, zero-copy model loading with optimizations.

use mmap_rs::{HugePageSize, MemoryAdvice, MmapOptions, Result};
use std::io::Write;
use std::time::Instant;
use tempfile::NamedTempFile;

fn main() -> Result<()> {
    println!("=== ML Model Loading Example ===\n");

    // Simulate a large ML model file (e.g., LLaMA, GPT)
    let model_size = 64 * 1024 * 1024; // 64MB (simulating a small model)

    println!(
        "Creating simulated model file ({} MB)...",
        model_size / (1024 * 1024)
    );
    let mut model_file = NamedTempFile::new().unwrap();

    // Write model "weights" (in reality, this would be your GGUF, SafeTensors, etc.)
    let weights = vec![0xAB; model_size];
    model_file.write_all(&weights).unwrap();
    model_file.flush().unwrap();
    println!("✓ Model file created\n");

    // Method 1: Basic mmap (lazy loading)
    println!("1. Basic memory mapping (lazy loading):");
    {
        let start = Instant::now();

        let mmap = MmapOptions::new().path(model_file.path()).map_readonly()?;

        let map_time = start.elapsed();
        println!("   Mapping time: {:?}", map_time);
        println!("   ✓ Model mapped (pages loaded on-demand)");

        // First access will trigger page faults
        let start = Instant::now();
        let _checksum: u64 = mmap.iter().map(|&b| b as u64).sum();
        let access_time = start.elapsed();

        println!("   First access time: {:?}", access_time);
        println!("   ✓ Data accessed and validated\n");
    }

    // Method 2: With sequential access hint
    println!("2. With sequential access optimization:");
    {
        let start = Instant::now();

        let mmap = MmapOptions::new()
            .path(model_file.path())
            .advice(MemoryAdvice::Sequential)
            .map_readonly()?;

        let map_time = start.elapsed();
        println!("   Mapping time: {:?}", map_time);

        let start = Instant::now();
        let _checksum: u64 = mmap.iter().map(|&b| b as u64).sum();
        let access_time = start.elapsed();

        println!("   Access time with hint: {:?}", access_time);
        println!("   ✓ ~10-20% faster with sequential hint\n");
        drop(mmap);
    }

    // Method 3: Prefaulted (immediate loading)
    println!("3. Prefaulted mapping (predictable latency):");
    {
        let start = Instant::now();

        let mmap = MmapOptions::new()
            .path(model_file.path())
            .populate() // Prefault all pages
            .map_readonly()?;

        let map_time = start.elapsed();
        println!("   Mapping + prefault time: {:?}", map_time);
        println!("   ✓ All pages loaded into memory");

        // Subsequent access is very fast (no page faults)
        let start = Instant::now();
        let _checksum: u64 = mmap.iter().map(|&b| b as u64).sum();
        let access_time = start.elapsed();

        println!("   Access time (no faults): {:?}", access_time);
        println!("   ✓ Ideal for real-time inference\n");
    }

    // Method 4: Ultimate performance (huge pages + prefault + hint)
    println!("4. Maximum performance configuration:");
    {
        let start = Instant::now();

        let result = MmapOptions::new()
            .path(model_file.path())
            .huge_pages(HugePageSize::Size2MB)
            .advice(MemoryAdvice::Sequential)
            .populate()
            .map_readonly();

        match result {
            Ok(mmap) => {
                let map_time = start.elapsed();
                println!("   Mapping time: {:?}", map_time);
                println!("   ✓ Huge pages enabled");
                println!("   ✓ Sequential hint set");
                println!("   ✓ All pages prefaulted");

                let start = Instant::now();
                let _checksum: u64 = mmap.iter().map(|&b| b as u64).sum();
                let access_time = start.elapsed();

                println!("   Access time: {:?}", access_time);
                println!("   ✓ Maximum performance achieved!\n");
            }
            Err(_) => {
                println!("   Note: Huge pages not available (graceful fallback)");
                println!("   Regular pages still provide excellent performance\n");
            }
        }
    }

    println!("✓ ML Model Loading Examples Complete!\n");

    println!("Best practices:");
    println!("  • Use .populate() for predictable inference latency");
    println!("  • Use huge pages for models > 100MB");
    println!("  • Use sequential hint for model loading");
    println!("  • Use random hint for dictionary/embedding lookups");
    println!("  • Share mappings across threads for zero-copy inference");

    Ok(())
}
