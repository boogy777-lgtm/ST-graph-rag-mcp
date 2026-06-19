//! Dynamic heap for IEC 61131-3 `__NEW` / `__DELETE` allocations.
//!
//! ADR-21: heap value storage uses a simple bump-allocator backed by
//! `Vec<u8>`. Pointers are opaque `HeapPtr` handles.

#![allow(missing_docs)]

use crate::value::Value;

pub mod encoding;

use encoding::{decode_value, encode_value};

/// Opaque handle into the heap arena.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct HeapPtr {
    pub id: u32,
    pub offset: u32,
}

impl HeapPtr {
    /// Sentinel for a failed allocation.
    pub const NULL: Self = Self { id: 0, offset: 0 };
}

/// Elementary IEC 61131-3 type tags used for byte-level encoding.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IecType {
    Bool,
    SInt,
    Int,
    DInt,
    LInt,
    USInt,
    UInt,
    UDInt,
    ULInt,
    Real,
    LReal,
    Byte,
    Word,
    DWord,
    LWord,
    Time,
    LTime,
    Date,
    LDate,
    Tod,
    LTod,
    Dt,
    Ldt,
    String { max_len: u64 },
    WString { max_len: u64 },
    Char,
    WChar,
}

/// Simple bump-allocator heap.
pub struct Heap {
    memory: Vec<u8>,
    next_id: u32,
}

impl Heap {
    pub fn new() -> Self {
        Self {
            memory: Vec::new(),
            next_id: 1,
        }
    }

    /// Allocate `size` bytes. Returns `None` on OOM.
    pub fn alloc(&mut self, size: usize) -> Option<HeapPtr> {
        let size_ok = u32::try_from(size).ok()?;
        if size_ok == 0 {
            return None;
        }
        let offset = u32::try_from(self.memory.len()).ok()?;
        self.memory.resize(self.memory.len() + size, 0);
        let id = self.next_id;
        self.next_id = self.next_id.wrapping_add(1);
        Some(HeapPtr { id, offset })
    }

    /// Free a previously allocated block.
    pub fn free(&mut self, _ptr: HeapPtr) {
        // ADR-21: free-list coalescing deferred beyond Phase 9.
    }

    /// Read a typed value from the heap at the given offset.
    pub fn read(&self, ptr: HeapPtr, offset: usize, ty: IecType) -> Option<Value> {
        let base = ptr.offset as usize;
        let start = base.checked_add(offset)?;
        let bytes = self.memory.get(start..)?;
        decode_value(bytes, ty)
    }

    /// Write a typed value into the heap at the given offset.
    pub fn write(&mut self, ptr: HeapPtr, offset: usize, value: &Value) {
        let base = ptr.offset as usize;
        let start = base.saturating_add(offset);
        let encoded = encode_value(value);
        if start + encoded.len() <= self.memory.len() {
            self.memory[start..start + encoded.len()].copy_from_slice(&encoded);
        }
    }
}

impl Default for Heap {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value::Value;

    #[test]
    fn test_heap_alloc_free() {
        let mut heap = Heap::new();

        let ptr = heap.alloc(16).expect("allocation should succeed");
        assert_ne!(ptr, HeapPtr::NULL);

        heap.write(ptr, 0, &Value::DInt(42i32));
        let read: Option<Value> = heap.read(ptr, 0, IecType::DInt);
        assert_eq!(read, Some(Value::DInt(42i32)));

        heap.free(ptr);

        let ptr2 = heap.alloc(16).expect("re-allocation should succeed after free");
        heap.write(ptr2, 0, &Value::Bool(true));
        let read2: Option<Value> = heap.read(ptr2, 0, IecType::Bool);
        assert_eq!(read2, Some(Value::Bool(true)));
    }

    #[test]
    fn test_heap_alloc_zero_returns_none() {
        let mut heap = Heap::new();
        assert!(heap.alloc(0).is_none(), "zero-sized allocation should return None");
    }

    #[test]
    fn test_heap_alloc_failure_returns_null_like() {
        let mut heap = Heap::new();
        let ptr = heap.alloc(4).expect("small alloc");
        assert_ne!(ptr, HeapPtr::NULL);

        heap.free(ptr);
    }
}
