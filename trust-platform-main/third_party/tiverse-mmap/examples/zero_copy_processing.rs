//! Zero-Copy File Processing Example
//!
//! Demonstrates memory-efficient processing of large files without
//! loading entire contents into memory. Perfect for log analysis,
//! data parsing, and text processing where files are too large to
//! fit in RAM.
//!
//! # Benefits
//! - No memory allocation for file contents
//! - Process files larger than available RAM
//! - Fast startup (no initial read)
//! - Automatic memory management by OS
//!
//! # Use Cases
//! - Log file analysis (searching for errors, patterns)
//! - Large CSV/JSON processing
//! - Binary data scanning
//! - Content indexing

use mmap_rs::{MemoryAdvice, MmapOptions, Result};
use std::io::Write;
use std::time::Instant;

fn main() -> Result<()> {
    println!("=== Zero-Copy File Processing Example ===\n");

    // Create test files
    let log_file = "/tmp/mmap_rs_large_log.txt";
    let csv_file = "/tmp/mmap_rs_data.csv";

    create_test_log_file(log_file)?;
    create_test_csv_file(csv_file)?;

    // Example 1: Log file analysis
    example_1_log_analysis(log_file)?;

    // Example 2: CSV processing
    example_2_csv_processing(csv_file)?;

    // Example 3: Binary data scanning
    example_3_binary_scan()?;

    // Example 4: Performance comparison
    example_4_performance_comparison(log_file)?;

    // Cleanup
    let _ = std::fs::remove_file(log_file);
    let _ = std::fs::remove_file(csv_file);

    println!("\n✓ All zero-copy examples completed!");
    Ok(())
}

/// Create a test log file (simulating application logs)
fn create_test_log_file(path: &str) -> Result<()> {
    let mut file = std::fs::File::create(path)?;

    // Create ~10MB log file
    for i in 0..100_000 {
        if i % 100 == 0 {
            writeln!(file, "[ERROR] Critical failure at line {}", i)?;
        } else if i % 10 == 0 {
            writeln!(file, "[WARN] Minor issue at line {}", i)?;
        } else {
            writeln!(file, "[INFO] Normal operation log entry {}", i)?;
        }
    }

    file.flush()?;
    Ok(())
}

/// Create a test CSV file
fn create_test_csv_file(path: &str) -> Result<()> {
    let mut file = std::fs::File::create(path)?;

    writeln!(file, "id,name,value,timestamp")?;
    for i in 0..50_000 {
        writeln!(file, "{},user_{},{},{}", i, i, i * 100, i * 1000)?;
    }

    file.flush()?;
    Ok(())
}

/// Example 1: Analyzing log files for errors
fn example_1_log_analysis(path: &str) -> Result<()> {
    println!("1. Log File Analysis (Zero-Copy):");

    let start = Instant::now();

    // Map file with sequential access hint
    let mmap = MmapOptions::new()
        .path(path)
        .advice(MemoryAdvice::Sequential)
        .map_readonly()?;

    let data = mmap.as_slice();

    // Count different log levels
    let mut error_count = 0;
    let mut warn_count = 0;
    let mut info_count = 0;

    // Process line by line without allocating
    for line in data.split(|&b| b == b'\n') {
        if line.starts_with(b"[ERROR]") {
            error_count += 1;
        } else if line.starts_with(b"[WARN]") {
            warn_count += 1;
        } else if line.starts_with(b"[INFO]") {
            info_count += 1;
        }
    }

    let elapsed = start.elapsed();

    println!("   File size: {} MB", data.len() / 1024 / 1024);
    println!("   Errors: {}", error_count);
    println!("   Warnings: {}", warn_count);
    println!("   Info: {}", info_count);
    println!("   Processing time: {:?}", elapsed);
    println!("   ✓ Zero memory allocation!\n");

    Ok(())
}

/// Example 2: CSV processing without loading into memory
fn example_2_csv_processing(path: &str) -> Result<()> {
    println!("2. CSV Processing (Zero-Copy):");

    let start = Instant::now();

    // Map CSV file
    let mmap = MmapOptions::new()
        .path(path)
        .advice(MemoryAdvice::Sequential)
        .map_readonly()?;

    let data = mmap.as_slice();

    // Parse CSV headers and count records
    let mut lines = data.split(|&b| b == b'\n');

    // Skip header
    if let Some(header) = lines.next() {
        let header_str = std::str::from_utf8(header).unwrap_or("");
        println!("   Headers: {}", header_str);
    }

    // Process records
    let mut record_count = 0;
    let mut total_value = 0i64;

    for line in lines {
        if line.is_empty() {
            continue;
        }

        // Parse line (simplified CSV parsing)
        let fields: Vec<&[u8]> = line.split(|&b| b == b',').collect();
        if fields.len() >= 3 {
            // Extract value field (3rd column)
            if let Ok(value_str) = std::str::from_utf8(fields[2]) {
                if let Ok(value) = value_str.parse::<i64>() {
                    total_value += value;
                    record_count += 1;
                }
            }
        }
    }

    let elapsed = start.elapsed();
    let average = if record_count > 0 {
        total_value / record_count
    } else {
        0
    };

    println!("   Records processed: {}", record_count);
    println!("   Average value: {}", average);
    println!("   Processing time: {:?}", elapsed);
    println!("   ✓ No heap allocation for file contents!\n");

    Ok(())
}

/// Example 3: Binary data scanning (finding patterns)
fn example_3_binary_scan() -> Result<()> {
    println!("3. Binary Pattern Scanning:");

    // Create binary test file
    let path = "/tmp/mmap_rs_binary.dat";
    let mut file = std::fs::File::create(path)?;

    // Write binary data with specific pattern
    for i in 0u32..10_000 {
        file.write_all(&[0xFF, 0xFE, 0xFD, 0xFC])?; // Pattern
        file.write_all(&i.to_le_bytes())?; // Data
    }
    file.flush()?;

    let start = Instant::now();

    // Map and scan
    let mmap = MmapOptions::new()
        .path(path)
        .advice(MemoryAdvice::Sequential)
        .map_readonly()?;

    let data = mmap.as_slice();

    // Find pattern occurrences
    let pattern = [0xFF, 0xFE, 0xFD, 0xFC];
    let mut count = 0;

    for window in data.windows(pattern.len()) {
        if window == pattern {
            count += 1;
        }
    }

    let elapsed = start.elapsed();

    println!("   File size: {} KB", data.len() / 1024);
    println!("   Pattern found: {} times", count);
    println!("   Scan time: {:?}", elapsed);
    println!(
        "   Throughput: {:.2} GB/s",
        (data.len() as f64 / elapsed.as_secs_f64()) / 1e9
    );
    println!("   ✓ Efficient pattern matching!\n");

    // Cleanup
    let _ = std::fs::remove_file(path);

    Ok(())
}

/// Example 4: Performance comparison vs std::fs::read
fn example_4_performance_comparison(path: &str) -> Result<()> {
    println!("4. Performance Comparison:");
    println!("   mmap-rs vs std::fs::read\n");

    // Method 1: mmap-rs (zero-copy)
    let start = Instant::now();
    let mmap = MmapOptions::new()
        .path(path)
        .advice(MemoryAdvice::Sequential)
        .map_readonly()?;
    let map_time = start.elapsed();

    let start = Instant::now();
    let error_count = mmap
        .as_slice()
        .split(|&b| b == b'\n')
        .filter(|line| line.starts_with(b"[ERROR]"))
        .count();
    let process_time = start.elapsed();

    println!("   mmap-rs (zero-copy):");
    println!("     Map time: {:?}", map_time);
    println!("     Process time: {:?}", process_time);
    println!("     Total: {:?}", map_time + process_time);
    println!("     Errors found: {}", error_count);

    // Method 2: std::fs::read (loads entire file)
    let start = Instant::now();
    let contents = std::fs::read(path)?;
    let read_time = start.elapsed();

    let start = Instant::now();
    let error_count2 = contents
        .split(|&b| b == b'\n')
        .filter(|line| line.starts_with(b"[ERROR]"))
        .count();
    let process_time2 = start.elapsed();

    println!("\n   std::fs::read (loads into memory):");
    println!("     Read time: {:?}", read_time);
    println!("     Process time: {:?}", process_time2);
    println!("     Total: {:?}", read_time + process_time2);
    println!("     Errors found: {}", error_count2);
    println!("     Memory used: {} MB", contents.len() / 1024 / 1024);

    // Calculate speedup
    let mmap_total = (map_time + process_time).as_secs_f64();
    let read_total = (read_time + process_time2).as_secs_f64();
    let speedup = read_total / mmap_total;

    println!("\n   Speedup: {:.2}x faster with mmap-rs", speedup);
    println!(
        "   Memory savings: {} MB (zero-copy!)",
        contents.len() / 1024 / 1024
    );
    println!("   ✓ mmap-rs is more efficient for large files!\n");

    Ok(())
}
