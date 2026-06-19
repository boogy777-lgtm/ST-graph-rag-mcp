//! Bytecode decoding.

#![allow(missing_docs)]

use smol_str::SmolStr;

use super::reader::BytecodeReader;
use super::util::align4;
use super::{
    BytecodeError, BytecodeModule, BytecodeVersion, ConstEntry, ConstPool, DebugEntry, DebugMap,
    EnumVariant, Field, InterfaceImpl, InterfaceMethod, IoBinding, IoMap, MethodEntry,
    PouClassMeta, PouEntry, PouIndex, PouKind, RefEntry, RefLocation, RefSegment, RefTable,
    ResourceEntry, ResourceMeta, RetainInit, RetainInitEntry, Section, SectionData, SectionEntry,
    SectionId, StringTable, TypeData, TypeEntry, TypeKind, TypeTable, VarMeta, VarMetaEntry,
    HEADER_FLAG_CRC32, HEADER_SIZE, MAGIC, SECTION_ENTRY_SIZE, SUPPORTED_MAJOR_VERSION,
};

include!("decode/module_decode.rs");
include!("decode/section_decode.rs");
include!("decode/string_type_decode.rs");
include!("decode/section_validate.rs");
