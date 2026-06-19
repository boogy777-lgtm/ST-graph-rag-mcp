# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

**Note**: Only the latest 1.x release receives security updates. We strongly recommend staying up to date.

---

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in mmap-rs, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email us privately at:

**security@mmap-rs.example.com**

Or use GitHub's private vulnerability reporting:
- Go to https://github.com/TIVerse/mmap-rs/security/advisories
- Click "Report a vulnerability"

### What to Include

Please provide:

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Affected versions** (if known)
4. **Potential impact** assessment
5. **Suggested fix** (if you have one)
6. **Your contact information** for follow-up

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Fix timeline**: Depends on severity
  - Critical: 7-14 days
  - High: 14-30 days
  - Medium: 30-60 days
  - Low: Next regular release

### Disclosure Policy

- We follow **coordinated disclosure**
- Vulnerability details will be kept private until a fix is released
- We'll credit you in the security advisory (unless you prefer to remain anonymous)
- After patch release, we'll publish a security advisory

---

## Security Considerations

### General Safety

mmap-rs is designed with safety as a primary goal:

- **Zero `unsafe` in public API** - All unsafe code is isolated in platform modules
- **Type-safe access control** - Phantom types prevent misuse at compile time
- **Automatic resource management** - RAII prevents resource leaks
- **Thread-safety guarantees** - Clear `Send`/`Sync` bounds

### Known Limitations

#### 1. File Truncation (SIGBUS on Unix)

**Issue**: If the underlying file is truncated while mapped, accessing beyond the new file size may cause SIGBUS on Unix systems.

**Mitigation**: mmap-rs validates file size before mapping and provides truncation detection, but cannot prevent external truncation.

**Recommendation**:
- Use file locking (`FileLock`) when multiple processes access the same file
- Handle SIGBUS signals in your application if needed
- Consider using `.private()` for read-only mappings if the file may change

#### 2. File Permissions

**Issue**: Memory-mapped files respect OS-level permissions, but changes can be cached.

**Mitigation**: 
- Verify file permissions before mapping
- Use appropriate protection flags (`ReadOnly` vs `ReadWrite`)
- Consider using file locks for exclusive access

**Recommendation**:
- Always validate permissions at mapping time
- Don't rely on permission checks after mapping
- Use file locking for coordination

#### 3. Time-of-Check-Time-of-Use (TOCTOU)

**Issue**: File metadata (size, permissions) can change between check and use.

**Mitigation**: mmap-rs checks are as close to `mmap()` call as possible, but TOCTOU cannot be completely eliminated.

**Recommendation**:
- Use file locking for critical operations
- Validate data after mapping if untrusted
- Consider using `.private()` for isolation

#### 4. Multi-Process Synchronization

**Issue**: Multiple processes mapping the same file need synchronization.

**Mitigation**: mmap-rs provides `FileLock` for coordination.

**Recommendation**:
- Use `FileLock::Exclusive` for writers
- Use `FileLock::Shared` for readers
- Use atomic operations for lock-free patterns
- Document synchronization requirements

#### 5. Memory Exhaustion

**Issue**: Mapping very large files can exhaust virtual address space (especially on 32-bit systems).

**Mitigation**: mmap-rs returns clear errors when mapping fails.

**Recommendation**:
- Check available virtual memory before large mappings
- Consider using 64-bit systems for large files
- Map only required regions using offset/length

---

## Security Best Practices

### 1. Input Validation

Always validate inputs before mapping:

```rust
use mmap_rs::MmapOptions;

// Validate file size
let metadata = std::fs::metadata(path)?;
if metadata.len() > MAX_FILE_SIZE {
    return Err("File too large");
}

// Validate permissions
if metadata.permissions().readonly() && need_write {
    return Err("Insufficient permissions");
}

// Then map
let mmap = MmapOptions::new()
    .path(path)
    .map_readonly()?;
```

### 2. Use File Locking

Coordinate access across processes:

```rust
use mmap_rs::{MmapOptions, FileLock, LockType};

// Acquire lock first
let lock = FileLock::lock(path, LockType::Exclusive)?;

// Then map
let mut mmap = MmapOptions::new()
    .path(path)
    .map_readwrite()?;

// Modify safely
mmap[0] = 42;

// Lock released automatically on drop
```

### 3. Use Private Mappings for Untrusted Data

Isolate changes from the original file:

```rust
use mmap_rs::MmapOptions;

// Changes won't affect the file
let mut mmap = MmapOptions::new()
    .path(untrusted_file)
    .private()  // Copy-on-write
    .map_readwrite()?;

// Modify safely without affecting original
mmap[0] = 42;  // Only in memory
```

### 4. Validate Mapped Data

Don't trust file contents:

```rust
use mmap_rs::MmapOptions;

let mmap = MmapOptions::new()
    .path(path)
    .map_readonly()?;

// Validate structure
if mmap.len() < HEADER_SIZE {
    return Err("Invalid file format");
}

// Validate magic bytes
if &mmap[0..4] != MAGIC {
    return Err("Invalid file signature");
}

// Validate checksums
if !verify_checksum(&mmap) {
    return Err("Checksum mismatch");
}
```

### 5. Handle Errors Gracefully

Always check for mapping failures:

```rust
use mmap_rs::{MmapOptions, MmapError};

match MmapOptions::new().path(path).map_readonly() {
    Ok(mmap) => {
        // Use mmap safely
    }
    Err(MmapError::PermissionDenied { .. }) => {
        // Handle permission issues
    }
    Err(MmapError::InvalidOffset { .. }) => {
        // Handle invalid parameters
    }
    Err(e) => {
        // Handle other errors
    }
}
```

### 6. Minimize Privilege

Use minimum required permissions:

```rust
// Read-only when possible
let mmap = MmapOptions::new()
    .path(path)
    .map_readonly()?;  // Not map_readwrite()

// Use shared locks for readers
let lock = FileLock::lock(path, LockType::Shared)?;
```

### 7. Defense in Depth

Layer security measures:

1. **File permissions** - OS-level protection
2. **File locking** - Process coordination
3. **Input validation** - Data integrity
4. **Error handling** - Graceful failures
5. **Monitoring** - Detect anomalies

---

## Unsafe Code Audit

All `unsafe` code in mmap-rs has been reviewed and documented:

### Platform Modules

Unsafe code is isolated in:
- `src/platform/unix.rs` - Unix `mmap()`/`munmap()` calls
- `src/platform/windows.rs` - Windows `CreateFileMapping()`/`MapViewOfFile()` calls

Every unsafe block includes:
- **SAFETY comment** explaining invariants
- **Precondition checks** before unsafe operations
- **Postcondition validation** after unsafe operations

### Safety Invariants

1. **Memory validity**: All pointers are valid for their stated lifetime
2. **Alignment**: All mappings respect page alignment
3. **Size bounds**: Lengths are validated before use
4. **Thread safety**: Access is properly synchronized
5. **Resource cleanup**: Drop trait ensures unmapping

### Validation

- **Miri**: All tests pass under Miri on nightly Rust
- **Valgrind**: No memory leaks detected
- **Fuzzing**: Extensive fuzzing with no crashes

---

## Platform-Specific Security

### Unix/Linux

- **ASLR**: Address Space Layout Randomization is respected
- **SELinux/AppArmor**: Works with mandatory access control
- **Capabilities**: Doesn't require elevated privileges
- **Namespaces**: Compatible with containerization

### Windows

- **DEP**: Data Execution Prevention compatible
- **ASLR**: Address Space Layout Randomization supported
- **Integrity Levels**: Respects Windows integrity model
- **Sandboxing**: Works within sandboxed environments

### macOS

- **SIP**: System Integrity Protection compatible
- **Code signing**: No special signatures required
- **Sandboxing**: Works within App Sandbox
- **Hardened runtime**: Compatible with hardening

---

## Dependency Security

mmap-rs has minimal dependencies to reduce attack surface:

**Production dependencies**:
- `libc` - System calls (widely audited)
- `thiserror` - Error handling (safe)
- `tokio` (optional) - Async runtime
- `zerocopy`/`bytemuck` (optional) - Safe zero-copy

**Development dependencies**:
- `criterion` - Benchmarking
- `tempfile` - Test utilities

All dependencies are:
- Actively maintained
- Widely used in Rust ecosystem
- Regularly updated for security

---

## Security Checklist for Users

Before using mmap-rs in production:

- [ ] Review file permission requirements
- [ ] Implement file locking if multiple processes
- [ ] Validate all input files
- [ ] Handle mapping errors gracefully
- [ ] Test with malformed/corrupted files
- [ ] Monitor for SIGBUS signals (Unix)
- [ ] Use minimum required privileges
- [ ] Document security assumptions
- [ ] Plan for file truncation scenarios
- [ ] Test on target platforms

---

## Updates and Patches

### Staying Informed

- Watch this repository for security advisories
- Subscribe to release notifications
- Follow security mailing list (coming soon)
- Check CHANGELOG.md for security fixes

### Applying Updates

```toml
# Always use latest 1.x version
[dependencies]
mmap-rs = "1"  # Automatically gets 1.x updates

# Or pin specific version and update manually
mmap-rs = "=1.0.0"
```

**Recommendation**: Use `"1"` to automatically receive security patches.

---

## Acknowledgments

We thank the security researchers and contributors who help keep mmap-rs secure:

- [Your name here] - If you report a vulnerability, we'll credit you!

---

## Contact

- **Security issues**: security@mmap-rs.example.com
- **General questions**: GitHub Discussions
- **Bug reports**: GitHub Issues (non-security only)

---

## Disclaimer

While mmap-rs is designed with security in mind, memory-mapped I/O inherently involves OS-level operations that can have security implications. Users are responsible for:

- Understanding their security requirements
- Implementing appropriate access controls
- Testing in their specific environment
- Staying up to date with patches

This library is provided "AS IS" without warranty. See LICENSE for details.

---

**Last Updated**: 2025-10-31  
**Version**: 1.0.0
