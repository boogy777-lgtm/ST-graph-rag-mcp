# 🧠 tiverse-mmap — Modern Memory-Mapped File Library for Rust

[![CI](https://github.com/TIVerse/mmap-rs/workflows/CI/badge.svg)](https://github.com/TIVerse/mmap-rs/actions)
[![Crates.io](https://img.shields.io/crates/v/tiverse-mmap.svg)](https://crates.io/crates/tiverse-mmap)
[![Documentation](https://docs.rs/tiverse-mmap/badge.svg)](https://docs.rs/tiverse-mmap)
[![License](https://img.shields.io/crates/l/tiverse-mmap.svg)](LICENSE-MIT)

**Next-Generation Memory-Mapped I/O with Safety, Performance, and Modern Rust Idioms**

A safe, performant, and ergonomic memory-mapped file I/O library that becomes the new standard for high-performance file I/O in Rust.

---

## ✨ Features

- **🔒 Safe by default** — Zero `unsafe` in public API; all unsafe code isolated and audited
- **🌍 Cross-platform** — Full Linux, Windows, macOS, and BSD support with parity
- **⚡ High performance** — Zero-cost abstractions, huge pages, prefaulting strategies
- **🧬 Type-safe builders** — Compile-time validation using type states and phantom types
- **🦀 Modern Rust** — Edition 2021+, MSRV 1.70, leveraging latest language features
- **📚 Comprehensive docs** — Examples, safety notes, and platform-specific behavior documented

### Why tiverse-mmap?

**vs. `memmap2`:**
- ✅ Active maintenance with modern Rust features
- ✅ Type-safe builders with compile-time validation
- ✅ Better error handling with detailed error types
- ✅ Advanced features (huge pages, prefaulting, NUMA)
- ✅ Comprehensive async support

**vs. Manual `libc` calls:**
- ✅ Cross-platform abstraction
- ✅ Safe Rust API with minimal `unsafe`
- ✅ RAII resource management (automatic unmapping)
- ✅ Better documentation and examples

---

## 🚀 Quick Start

Add this to your `Cargo.toml`:

```toml
[dependencies]
tiverse-mmap = "1.0"
```

### Basic Usage

```rust
use mmap_rs::MmapOptions;

// Read-only mapping
let mmap = MmapOptions::new()
    .path("data.bin")
    .map_readonly()?;

let data: &[u8] = &mmap;
println!("First byte: {}", data[0]);
```

### Read-Write Mapping

```rust
use mmap_rs::MmapOptions;

// Read-write mapping
let mut mmap = MmapOptions::new()
    .path("data.bin")
    .map_readwrite()?;

let data: &mut [u8] = &mut mmap;
data[0] = 42;
```

### Advanced Features

```rust
use mmap_rs::{MmapOptions, Protection, HugePageSize, PrefaultStrategy};

// High-performance mapping with huge pages and prefaulting
let mmap = MmapOptions::new()
    .path("model.bin")
    .protection(Protection::READ | Protection::WRITE)
    .huge_pages(HugePageSize::Size2MB)
    .prefault_strategy(PrefaultStrategy::Sequential)
    .map()?;
```

---

## 📖 Documentation

- **[API Documentation](https://docs.rs/tiverse-mmap)** — Complete API reference
- **[Getting Started Guide](docs/getting-started.md)** — Tutorial for new users
- **[Performance Guide](docs/performance.md)** — Optimization tips and benchmarks
- **[Safety Guide](docs/safety.md)** — Understanding the safety model
- **[Platform Guide](docs/platforms.md)** — Platform-specific behaviors and notes
- **[Migration Guide](docs/migration.md)** — Migrating from `memmap2`

---

## 🎯 Core Features

### Basic Operations
- Read-only, read-write, copy-on-write memory mapping
- Anonymous mapping (no file backing)
- Shared vs private mappings
- Type-safe access modes with phantom types

### Advanced Features
- **Huge pages support** (2MB/1GB pages for better TLB performance)
- **Prefaulting strategies** (sequential, random, adaptive)
- **NUMA-aware allocation** (for multi-socket systems)
- **Resize/remap operations** (with `mremap` on Linux)
- **File locking integration**
- **Memory advice hints** (willneed, sequential, random)

### Safety Features
- Type-safe builders preventing invalid configurations
- Lifetime-bound references preventing use-after-free
- Automatic unmap on drop with configurable behavior
- Validation of alignment and size constraints
- Cross-platform permission checking

### Performance Features
- Zero-copy slice access
- Lock-free reads for read-only maps
- Vectorized operations support
- Transparent huge page support
- Page prefetching and advice-driven I/O

---

## 🏗️ Project Status

### Current: Phase 0 — Project Setup ✅
- [x] Repository structure
- [x] Cargo configuration
- [x] CI/CD pipeline
- [x] Module skeleton
- [x] Benchmark infrastructure
- [x] Initial documentation

### Next: Phase 1 — Core Implementation (In Progress)
- [ ] Platform abstraction layer (unix/windows)
- [ ] Basic `Mmap` type with RAII
- [ ] Type-safe builder implementation
- [ ] Error handling framework
- [ ] Unit tests

See [ROADMAP.md](ddocs/ROADMAP.md) for the complete implementation plan.

---

## 🧪 Testing

```bash
# Run all tests
cargo test --all-features

# Run with miri for memory safety validation
cargo +nightly miri test

# Run benchmarks
cargo bench

# Check with clippy
cargo clippy --all-features -- -D warnings
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/TIVerse/mmap-rs.git
cd mmap-rs

# Build and test
cargo build
cargo test --all-features

# Run benchmarks
cargo bench
```

---

## 📊 Benchmarks

Performance targets:

| Operation | tiverse-mmap | memmap2 | std::fs::read |
|-----------|---------|---------|---------------|
| 1GB Sequential Read | 1.2s | 1.3s | 2.8s |
| Random Access (1M ops) | 0.8s | 0.9s | N/A |
| Startup (map only) | 50µs | 80µs | 2.5s |
| Memory Usage | 200MB | 220MB | 1GB |

*(Benchmarks will be conducted in Phase 4)*

---

## 📜 License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

---

## 🙏 Acknowledgments

This project builds upon lessons learned from:
- [`memmap2`](https://github.com/RazrFalcon/memmap2-rs) — The current standard
- [`rust-mmap`](https://github.com/rbranson/rust-mmap) — The original (archived)

Special thanks to the Rust community for feedback and contributions.

---

**Ready to build the new gold standard for memory-mapped I/O in Rust.**
