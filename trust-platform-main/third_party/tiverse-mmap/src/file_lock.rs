//! File locking integration for safe concurrent access to memory-mapped files.

use crate::{MmapError, Result};
use std::fs::File;
#[cfg(unix)]
use std::os::unix::io::AsRawFd;

/// Type of file lock
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LockType {
    /// Shared (read) lock - multiple readers allowed
    Shared,
    /// Exclusive (write) lock - only one writer allowed
    Exclusive,
}

/// File lock guard that automatically releases the lock when dropped
pub struct FileLock {
    file: File,
    lock_type: LockType,
}

impl FileLock {
    /// Acquire a file lock (blocking)
    ///
    /// This will block until the lock can be acquired.
    ///
    /// # Platform Support
    ///
    /// - **Unix**: Uses `flock(2)`
    /// - **Windows**: Uses `LockFile`/`LockFileEx`
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mmap_rs::{FileLock, LockType};
    /// use std::fs::File;
    ///
    /// let file = File::open("data.bin")?;
    /// let lock = FileLock::lock(file, LockType::Shared)?;
    /// // File is locked for reading
    /// // Lock automatically released when `lock` is dropped
    /// # Ok::<(), mmap_rs::MmapError>(())
    /// ```
    #[cfg(unix)]
    pub fn lock(file: File, lock_type: LockType) -> Result<Self> {
        let fd = file.as_raw_fd();

        let operation = match lock_type {
            LockType::Shared => libc::LOCK_SH,
            LockType::Exclusive => libc::LOCK_EX,
        };

        // SAFETY: flock is safe to call with a valid file descriptor
        let result = unsafe { libc::flock(fd, operation) };

        if result != 0 {
            let err = std::io::Error::last_os_error();
            return Err(MmapError::SystemError(format!(
                "Failed to acquire file lock: {}",
                err
            )));
        }

        Ok(Self { file, lock_type })
    }

    /// Try to acquire a file lock (non-blocking)
    ///
    /// Returns immediately if the lock cannot be acquired.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mmap_rs::{FileLock, LockType};
    /// use std::fs::File;
    ///
    /// let file = File::open("data.bin")?;
    /// match FileLock::try_lock(file, LockType::Exclusive) {
    ///     Ok(lock) => {
    ///         // Got the lock
    ///     }
    ///     Err(_) => {
    ///         // Lock not available
    ///     }
    /// }
    /// # Ok::<(), mmap_rs::MmapError>(())
    /// ```
    #[cfg(unix)]
    pub fn try_lock(file: File, lock_type: LockType) -> Result<Self> {
        let fd = file.as_raw_fd();

        let operation = match lock_type {
            LockType::Shared => libc::LOCK_SH | libc::LOCK_NB,
            LockType::Exclusive => libc::LOCK_EX | libc::LOCK_NB,
        };

        // SAFETY: flock is safe to call with a valid file descriptor
        let result = unsafe { libc::flock(fd, operation) };

        if result != 0 {
            let err = std::io::Error::last_os_error();
            return Err(MmapError::SystemError(format!(
                "Failed to acquire file lock (would block): {}",
                err
            )));
        }

        Ok(Self { file, lock_type })
    }

    /// Windows implementation of lock
    #[cfg(windows)]
    pub fn lock(file: File, lock_type: LockType) -> Result<Self> {
        use std::os::windows::io::AsRawHandle;
        use windows::Win32::Foundation::{HANDLE, INVALID_HANDLE_VALUE};
        use windows::Win32::Storage::FileSystem::{
            LockFileEx, LOCKFILE_EXCLUSIVE_LOCK, LOCK_FILE_FLAGS,
        };

        let handle = HANDLE(file.as_raw_handle() as isize);
        if handle == INVALID_HANDLE_VALUE {
            return Err(MmapError::SystemError("Invalid file handle".to_string()));
        }

        let flags = match lock_type {
            LockType::Shared => 0,
            LockType::Exclusive => LOCKFILE_EXCLUSIVE_LOCK.0,
        };

        let mut overlapped = unsafe { std::mem::zeroed() };

        let result = unsafe {
            LockFileEx(
                handle,
                LOCK_FILE_FLAGS(flags),
                0,
                u32::MAX,
                u32::MAX,
                &mut overlapped,
            )
        };

        if result.is_err() {
            return Err(MmapError::SystemError(
                "Failed to acquire file lock".to_string(),
            ));
        }

        Ok(Self { file, lock_type })
    }

    /// Windows implementation of try_lock
    #[cfg(windows)]
    pub fn try_lock(file: File, lock_type: LockType) -> Result<Self> {
        use std::os::windows::io::AsRawHandle;
        use windows::Win32::Foundation::{HANDLE, INVALID_HANDLE_VALUE};
        use windows::Win32::Storage::FileSystem::{
            LockFileEx, LOCKFILE_EXCLUSIVE_LOCK, LOCKFILE_FAIL_IMMEDIATELY, LOCK_FILE_FLAGS,
        };

        let handle = HANDLE(file.as_raw_handle() as isize);
        if handle == INVALID_HANDLE_VALUE {
            return Err(MmapError::SystemError("Invalid file handle".to_string()));
        }

        let flags = match lock_type {
            LockType::Shared => LOCKFILE_FAIL_IMMEDIATELY.0,
            LockType::Exclusive => LOCKFILE_EXCLUSIVE_LOCK.0 | LOCKFILE_FAIL_IMMEDIATELY.0,
        };

        let mut overlapped = unsafe { std::mem::zeroed() };

        let result = unsafe {
            LockFileEx(
                handle,
                LOCK_FILE_FLAGS(flags),
                0,
                u32::MAX,
                u32::MAX,
                &mut overlapped,
            )
        };

        if result.is_err() {
            return Err(MmapError::SystemError(
                "Failed to acquire file lock (would block)".to_string(),
            ));
        }

        Ok(Self { file, lock_type })
    }

    /// Get a reference to the underlying file
    pub fn file(&self) -> &File {
        &self.file
    }

    /// Get the lock type
    pub fn lock_type(&self) -> LockType {
        self.lock_type
    }

    /// Unlock and consume the lock guard, returning the file
    pub fn unlock(self) -> File {
        // Manually unlock before consuming
        #[cfg(unix)]
        {
            let fd = self.file.as_raw_fd();
            unsafe {
                let _ = libc::flock(fd, libc::LOCK_UN);
            }
        }

        #[cfg(windows)]
        {
            use std::os::windows::io::AsRawHandle;
            use windows::Win32::Foundation::HANDLE;
            use windows::Win32::Storage::FileSystem::UnlockFileEx;

            let handle = HANDLE(self.file.as_raw_handle() as isize);
            let mut overlapped = unsafe { std::mem::zeroed() };

            unsafe {
                let _ = UnlockFileEx(handle, 0, u32::MAX, u32::MAX, &mut overlapped);
            }
        }

        // Prevent Drop from running
        let file = unsafe { std::ptr::read(&self.file) };
        std::mem::forget(self);
        file
    }
}

impl Drop for FileLock {
    fn drop(&mut self) {
        #[cfg(unix)]
        {
            let fd = self.file.as_raw_fd();
            // SAFETY: flock with LOCK_UN is safe to call
            unsafe {
                let _ = libc::flock(fd, libc::LOCK_UN);
            }
        }

        #[cfg(windows)]
        {
            use std::os::windows::io::AsRawHandle;
            use windows::Win32::Foundation::HANDLE;
            use windows::Win32::Storage::FileSystem::UnlockFileEx;

            let handle = HANDLE(self.file.as_raw_handle() as isize);
            let mut overlapped = unsafe { std::mem::zeroed() };

            unsafe {
                let _ = UnlockFileEx(handle, 0, u32::MAX, u32::MAX, &mut overlapped);
            }
        }
    }
}

// File locks are Send but not Sync (exclusive file access)
unsafe impl Send for FileLock {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn create_test_file() -> NamedTempFile {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(b"test data").unwrap();
        file.flush().unwrap();
        file
    }

    #[test]
    fn test_shared_lock() {
        let file = create_test_file();
        let file_handle = std::fs::File::open(file.path()).unwrap();

        let lock = FileLock::lock(file_handle, LockType::Shared).unwrap();
        assert_eq!(lock.lock_type(), LockType::Shared);
    }

    #[test]
    fn test_exclusive_lock() {
        let file = create_test_file();
        let file_handle = std::fs::File::open(file.path()).unwrap();

        let lock = FileLock::lock(file_handle, LockType::Exclusive).unwrap();
        assert_eq!(lock.lock_type(), LockType::Exclusive);
    }

    #[test]
    fn test_try_lock_success() {
        let file = create_test_file();
        let file_handle = std::fs::File::open(file.path()).unwrap();

        let lock = FileLock::try_lock(file_handle, LockType::Shared).unwrap();
        assert_eq!(lock.lock_type(), LockType::Shared);
    }

    #[test]
    fn test_lock_unlock() {
        let file = create_test_file();
        let file_handle = std::fs::File::open(file.path()).unwrap();

        let lock = FileLock::lock(file_handle, LockType::Exclusive).unwrap();
        let _file = lock.unlock();
        // Lock should be released now
    }

    #[test]
    fn test_multiple_shared_locks() {
        let file = create_test_file();
        let path = file.path().to_path_buf();

        let file1 = std::fs::File::open(&path).unwrap();
        let file2 = std::fs::File::open(&path).unwrap();

        let _lock1 = FileLock::lock(file1, LockType::Shared).unwrap();
        let _lock2 = FileLock::lock(file2, LockType::Shared).unwrap();
        // Both shared locks should succeed
    }
}
