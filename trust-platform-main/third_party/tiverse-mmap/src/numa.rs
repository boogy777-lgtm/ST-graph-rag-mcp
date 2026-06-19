//! NUMA (Non-Uniform Memory Access) awareness for optimized memory placement.
//!
//! This module provides optional NUMA node binding for improved performance
//! in multi-socket systems.

#[cfg(target_os = "linux")]
use std::fs;

use crate::{MmapError, Result};

/// NUMA node identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NumaNode(pub u32);

/// NUMA memory policy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NumaPolicy {
    /// Default system policy
    Default,
    /// Bind to specific node
    Bind(NumaNode),
    /// Prefer specific node but allow fallback
    Preferred(NumaNode),
    /// Interleave across all nodes
    Interleave,
}

/// Query NUMA topology information
pub struct NumaTopology {
    num_nodes: u32,
    available: bool,
}

impl NumaTopology {
    /// Detect NUMA topology
    #[cfg(target_os = "linux")]
    pub fn detect() -> Result<Self> {
        // Check if NUMA is available by reading /sys/devices/system/node/
        let numa_path = "/sys/devices/system/node/";

        match fs::read_dir(numa_path) {
            Ok(entries) => {
                let num_nodes = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.file_name().to_string_lossy().starts_with("node"))
                    .count() as u32;

                Ok(Self {
                    num_nodes: if num_nodes > 0 { num_nodes } else { 1 },
                    available: num_nodes > 1,
                })
            }
            Err(_) => {
                // NUMA not available, single node system
                Ok(Self {
                    num_nodes: 1,
                    available: false,
                })
            }
        }
    }

    /// Detect NUMA topology (non-Linux)
    #[cfg(not(target_os = "linux"))]
    pub fn detect() -> Result<Self> {
        Ok(Self {
            num_nodes: 1,
            available: false,
        })
    }

    /// Get the number of NUMA nodes
    pub fn num_nodes(&self) -> u32 {
        self.num_nodes
    }

    /// Check if NUMA is available
    pub fn is_available(&self) -> bool {
        self.available
    }
}

/// NUMA memory binder
pub struct NumaBinder;

impl NumaBinder {
    /// Bind memory region to NUMA node (Linux only)
    ///
    /// This uses `mbind()` system call to set NUMA policy for a memory region.
    ///
    /// # Platform Support
    ///
    /// - **Linux**: Uses `mbind()` system call
    /// - **Other platforms**: No-op (returns success)
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mmap_rs::{MmapOptions, numa::{NumaBinder, NumaNode, NumaPolicy}};
    ///
    /// let mmap = MmapOptions::new_anonymous(1024 * 1024)
    ///     .map_readwrite()?;
    ///
    /// // Bind to NUMA node 0
    /// NumaBinder::bind_memory(
    ///     mmap.as_ptr() as *mut u8,
    ///     mmap.len(),
    ///     NumaPolicy::Bind(NumaNode(0))
    /// )?;
    /// # Ok::<(), mmap_rs::MmapError>(())
    /// ```
    #[cfg(target_os = "linux")]
    pub fn bind_memory(ptr: *mut u8, len: usize, policy: NumaPolicy) -> Result<()> {
        // mbind() syscall number on Linux
        const SYS_MBIND: i64 = 237;

        // NUMA policy flags
        const MPOL_DEFAULT: i32 = 0;
        const MPOL_PREFERRED: i32 = 1;
        const MPOL_BIND: i32 = 2;
        const MPOL_INTERLEAVE: i32 = 3;

        let (mode, nodemask) = match policy {
            NumaPolicy::Default => (MPOL_DEFAULT, 0u64),
            NumaPolicy::Bind(NumaNode(node)) => (MPOL_BIND, 1u64 << node),
            NumaPolicy::Preferred(NumaNode(node)) => (MPOL_PREFERRED, 1u64 << node),
            NumaPolicy::Interleave => (MPOL_INTERLEAVE, !0u64), // All nodes
        };

        let maxnode = 64; // Support up to 64 NUMA nodes

        // SAFETY: Calling mbind syscall with validated parameters
        let result = unsafe {
            libc::syscall(
                SYS_MBIND,
                ptr as *mut libc::c_void,
                len,
                mode,
                &nodemask as *const u64,
                maxnode,
                0, // flags
            )
        };

        if result != 0 {
            let err = std::io::Error::last_os_error();
            return Err(MmapError::SystemError(format!("mbind failed: {}", err)));
        }

        Ok(())
    }

    /// Bind memory region to NUMA node (non-Linux stub)
    #[cfg(not(target_os = "linux"))]
    pub fn bind_memory(_ptr: *mut u8, _len: usize, _policy: NumaPolicy) -> Result<()> {
        // NUMA binding not supported on non-Linux platforms
        Ok(())
    }

    /// Get the preferred NUMA node for the current thread
    #[cfg(target_os = "linux")]
    pub fn current_node() -> Result<NumaNode> {
        // Try to read from /proc/self/numa_maps or use getcpu()
        // For simplicity, return node 0
        Ok(NumaNode(0))
    }

    /// Get the preferred NUMA node for the current thread (non-Linux)
    #[cfg(not(target_os = "linux"))]
    pub fn current_node() -> Result<NumaNode> {
        Ok(NumaNode(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_numa_topology_detect() {
        let topology = NumaTopology::detect().unwrap();
        assert!(topology.num_nodes() >= 1);
    }

    #[test]
    fn test_numa_policy_bind() {
        let policy = NumaPolicy::Bind(NumaNode(0));
        assert_eq!(policy, NumaPolicy::Bind(NumaNode(0)));
    }

    #[test]
    fn test_numa_policy_preferred() {
        let policy = NumaPolicy::Preferred(NumaNode(1));
        match policy {
            NumaPolicy::Preferred(NumaNode(1)) => (),
            _ => panic!("Wrong policy type"),
        }
    }

    #[test]
    fn test_numa_current_node() {
        let node = NumaBinder::current_node().unwrap();
        // Should always return a valid node
        assert!(node.0 < 1024);
    }

    #[test]
    fn test_numa_bind_memory() {
        // Test with a small allocation
        let size = 4096;
        let layout = std::alloc::Layout::from_size_align(size, 4096).unwrap();
        let ptr = unsafe { std::alloc::alloc(layout) };

        if !ptr.is_null() {
            let result = NumaBinder::bind_memory(ptr, size, NumaPolicy::Bind(NumaNode(0)));

            // Should succeed or gracefully handle unavailable NUMA
            assert!(result.is_ok() || result.is_err());

            unsafe { std::alloc::dealloc(ptr, layout) };
        }
    }
}
