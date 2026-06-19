//! Async I/O support for memory-mapped files.
//!
//! This module provides async-friendly wrappers for memory-mapped files,
//! allowing integration with tokio and other async runtimes.

use crate::{Mmap, MmapOptions, ReadOnly, ReadWrite, Result};
use std::io;
use std::path::Path;
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};

/// Async wrapper for memory-mapped files
///
/// This provides async I/O operations over memory-mapped regions,
/// allowing efficient integration with tokio and async/await patterns.
///
/// # Examples
///
/// ```ignore
/// use mmap_rs::AsyncMmap;
/// use tokio::io::AsyncReadExt;
///
/// #[tokio::main]
/// async fn main() -> Result<(), Box<dyn std::error::Error>> {
///     let mut mmap = AsyncMmap::open("data.bin").await?;
///     
///     let mut buffer = vec![0u8; 1024];
///     mmap.read_exact(&mut buffer).await?;
///     
///     Ok(())
/// }
/// ```
pub struct AsyncMmap<Mode = ReadOnly> {
    mmap: Mmap<Mode>,
    position: usize,
}

impl AsyncMmap<ReadOnly> {
    /// Open a file for async read-only access
    ///
    /// # Examples
    ///
    /// ```ignore
    /// let mmap = AsyncMmap::open("data.bin").await?;
    /// ```
    pub async fn open(path: impl AsRef<Path>) -> Result<Self> {
        // Open file on blocking thread pool
        let path = path.as_ref().to_path_buf();
        let mmap =
            tokio::task::spawn_blocking(move || MmapOptions::new().path(path).map_readonly())
                .await
                .map_err(|e| crate::MmapError::SystemError(format!("Task join error: {}", e)))??;

        Ok(Self { mmap, position: 0 })
    }

    /// Create from an existing read-only mmap
    pub fn from_mmap(mmap: Mmap<ReadOnly>) -> Self {
        Self { mmap, position: 0 }
    }
}

impl AsyncMmap<ReadWrite> {
    /// Open a file for async read-write access
    ///
    /// # Examples
    ///
    /// ```ignore
    /// let mut mmap = AsyncMmap::open_rw("data.bin").await?;
    /// ```
    pub async fn open_rw(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref().to_path_buf();
        let mmap =
            tokio::task::spawn_blocking(move || MmapOptions::new().path(path).map_readwrite())
                .await
                .map_err(|e| crate::MmapError::SystemError(format!("Task join error: {}", e)))??;

        Ok(Self { mmap, position: 0 })
    }

    /// Create from an existing read-write mmap
    pub fn from_mmap(mmap: Mmap<ReadWrite>) -> Self {
        Self { mmap, position: 0 }
    }
}

impl<Mode> AsyncMmap<Mode> {
    /// Get the current position
    pub fn position(&self) -> usize {
        self.position
    }

    /// Set the position
    pub fn set_position(&mut self, pos: usize) {
        self.position = pos.min(self.mmap.len());
    }

    /// Get the total length
    pub fn len(&self) -> usize {
        self.mmap.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.mmap.is_empty()
    }

    /// Get remaining bytes from current position
    pub fn remaining(&self) -> usize {
        self.mmap.len().saturating_sub(self.position)
    }

    /// Get a reference to the underlying mmap
    pub fn inner(&self) -> &Mmap<Mode> {
        &self.mmap
    }
}

impl AsyncRead for AsyncMmap<ReadOnly> {
    fn poll_read(
        mut self: Pin<&mut Self>,
        _cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        let remaining = self.remaining();
        if remaining == 0 {
            return Poll::Ready(Ok(()));
        }

        let to_read = buf.remaining().min(remaining);
        let data = &self.mmap[self.position..self.position + to_read];
        buf.put_slice(data);
        self.position += to_read;

        Poll::Ready(Ok(()))
    }
}

impl AsyncRead for AsyncMmap<ReadWrite> {
    fn poll_read(
        mut self: Pin<&mut Self>,
        _cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        let remaining = self.remaining();
        if remaining == 0 {
            return Poll::Ready(Ok(()));
        }

        let to_read = buf.remaining().min(remaining);
        let data = &self.mmap[self.position..self.position + to_read];
        buf.put_slice(data);
        self.position += to_read;

        Poll::Ready(Ok(()))
    }
}

impl AsyncWrite for AsyncMmap<ReadWrite> {
    fn poll_write(
        mut self: Pin<&mut Self>,
        _cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        let remaining = self.remaining();
        if remaining == 0 {
            return Poll::Ready(Err(io::Error::new(
                io::ErrorKind::WriteZero,
                "No space remaining",
            )));
        }

        let to_write = buf.len().min(remaining);
        let start = self.position;
        let end = start + to_write;
        self.mmap[start..end].copy_from_slice(&buf[..to_write]);
        self.position = end;

        Poll::Ready(Ok(to_write))
    }

    fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        // Memory-mapped files are automatically flushed by the OS
        Poll::Ready(Ok(()))
    }

    fn poll_shutdown(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        // No shutdown needed for mmap
        Poll::Ready(Ok(()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    fn create_test_file(data: &[u8]) -> NamedTempFile {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(data).unwrap();
        file.flush().unwrap();
        file
    }

    #[tokio::test]
    async fn test_async_read() {
        let data = b"Hello, async mmap!";
        let file = create_test_file(data);

        let mut mmap = AsyncMmap::open(file.path()).await.unwrap();

        let mut buffer = vec![0u8; data.len()];
        mmap.read_exact(&mut buffer).await.unwrap();

        assert_eq!(&buffer, data);
    }

    #[tokio::test]
    async fn test_async_write() {
        let file = create_test_file(&vec![0u8; 1024]);

        let mut mmap = AsyncMmap::open_rw(file.path()).await.unwrap();

        let data = b"Written asynchronously!";
        mmap.write_all(data).await.unwrap();

        // Reset position and read back
        mmap.set_position(0);
        let mut buffer = vec![0u8; data.len()];
        mmap.read_exact(&mut buffer).await.unwrap();

        assert_eq!(&buffer, data);
    }

    #[tokio::test]
    async fn test_async_position() {
        let data = b"0123456789";
        let file = create_test_file(data);

        let mut mmap = AsyncMmap::open(file.path()).await.unwrap();

        assert_eq!(mmap.position(), 0);
        assert_eq!(mmap.remaining(), data.len());

        let mut buffer = [0u8; 5];
        mmap.read_exact(&mut buffer).await.unwrap();

        assert_eq!(mmap.position(), 5);
        assert_eq!(mmap.remaining(), 5);
    }

    #[tokio::test]
    async fn test_async_partial_read() {
        let data = b"Hello, World!";
        let file = create_test_file(data);

        let mut mmap = AsyncMmap::open(file.path()).await.unwrap();

        let mut buffer = [0u8; 5];
        mmap.read_exact(&mut buffer).await.unwrap();

        assert_eq!(&buffer, b"Hello");
        assert_eq!(mmap.position(), 5);
    }

    #[tokio::test]
    async fn test_async_len() {
        let data = vec![0u8; 4096];
        let file = create_test_file(&data);

        let mmap = AsyncMmap::open(file.path()).await.unwrap();

        assert_eq!(mmap.len(), 4096);
        assert!(!mmap.is_empty());
    }
}
