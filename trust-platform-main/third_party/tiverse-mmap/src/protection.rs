//! Memory protection flags for mapped regions.

use std::ops::{BitAnd, BitOr};

/// Memory protection flags controlling access permissions.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Protection(u32);

impl Protection {
    /// No access
    pub const NONE: Self = Self(0);

    /// Read access
    pub const READ: Self = Self(1 << 0);

    /// Write access
    pub const WRITE: Self = Self(1 << 1);

    /// Execute access
    pub const EXECUTE: Self = Self(1 << 2);

    /// Create a new protection flag
    pub const fn new(value: u32) -> Self {
        Self(value)
    }

    /// Get the raw value
    pub const fn bits(self) -> u32 {
        self.0
    }

    /// Check if read access is enabled
    pub const fn can_read(self) -> bool {
        self.0 & Self::READ.0 != 0
    }

    /// Check if write access is enabled
    pub const fn can_write(self) -> bool {
        self.0 & Self::WRITE.0 != 0
    }

    /// Check if execute access is enabled
    pub const fn can_execute(self) -> bool {
        self.0 & Self::EXECUTE.0 != 0
    }
}

impl BitOr for Protection {
    type Output = Self;

    fn bitor(self, rhs: Self) -> Self::Output {
        Self(self.0 | rhs.0)
    }
}

impl BitAnd for Protection {
    type Output = Self;

    fn bitand(self, rhs: Self) -> Self::Output {
        Self(self.0 & rhs.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protection_flags() {
        let prot = Protection::READ | Protection::WRITE;
        assert!(prot.can_read());
        assert!(prot.can_write());
        assert!(!prot.can_execute());
    }

    #[test]
    fn test_protection_none() {
        let prot = Protection::NONE;
        assert!(!prot.can_read());
        assert!(!prot.can_write());
        assert!(!prot.can_execute());
    }
}
