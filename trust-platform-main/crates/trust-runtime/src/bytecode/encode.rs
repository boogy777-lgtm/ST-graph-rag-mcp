//! Bytecode encoding.

#![allow(missing_docs)]

use super::util::{align4, pad_to};
use super::{
    BytecodeError, BytecodeModule, BytecodeVersion, SectionData, SectionEntry, TypeData, TypeEntry,
    TypeTable, HEADER_FLAG_CRC32, HEADER_SIZE, MAGIC, SECTION_ENTRY_SIZE,
};

impl BytecodeModule {
    pub fn encode(&self) -> Result<Vec<u8>, BytecodeError> {
        let mut payloads = Vec::new();
        for section in &self.sections {
            let data = encode_section_data(self.version, &section.data)?;
            payloads.push((section.id, section.flags, data));
        }

        let section_table_off = HEADER_SIZE as usize;
        let section_table_len = payloads.len() * SECTION_ENTRY_SIZE;
        let mut offset = align4(section_table_off + section_table_len);
        let mut entries = Vec::with_capacity(payloads.len());
        for (id, flags, data) in &payloads {
            let entry = SectionEntry {
                id: *id,
                flags: *flags,
                offset: offset as u32,
                length: data.len() as u32,
            };
            entries.push(entry);
            offset = align4(offset + data.len());
        }

        let mut bytes = Vec::with_capacity(offset);
        bytes.extend_from_slice(&MAGIC);
        bytes.extend_from_slice(&self.version.major.to_le_bytes());
        bytes.extend_from_slice(&self.version.minor.to_le_bytes());
        bytes.extend_from_slice(&self.flags.to_le_bytes());
        bytes.extend_from_slice(&HEADER_SIZE.to_le_bytes());
        let section_count = u16::try_from(entries.len())
            .map_err(|_| BytecodeError::InvalidHeader("section count overflow".into()))?;
        bytes.extend_from_slice(&section_count.to_le_bytes());
        bytes.extend_from_slice(&(section_table_off as u32).to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes());

        for entry in entries {
            bytes.extend_from_slice(&entry.id.to_le_bytes());
            bytes.extend_from_slice(&entry.flags.to_le_bytes());
            bytes.extend_from_slice(&entry.offset.to_le_bytes());
            bytes.extend_from_slice(&entry.length.to_le_bytes());
        }

        let target = align4(bytes.len());
        pad_to(&mut bytes, target);

        for (_, _, data) in payloads {
            bytes.extend_from_slice(&data);
            let target = align4(bytes.len());
            pad_to(&mut bytes, target);
        }
        if self.flags & HEADER_FLAG_CRC32 != 0 {
            let checksum = crc32fast::hash(&bytes[section_table_off..]);
            bytes[20..24].copy_from_slice(&checksum.to_le_bytes());
        }

        Ok(bytes)
    }
}

fn encode_section_data(
    version: BytecodeVersion,
    data: &SectionData,
) -> Result<Vec<u8>, BytecodeError> {
    let mut out = Vec::new();
    match data {
        SectionData::StringTable(table) | SectionData::DebugStringTable(table) => {
            out.extend_from_slice(&(table.entries.len() as u32).to_le_bytes());
            for entry in &table.entries {
                let bytes = entry.as_bytes();
                out.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
                out.extend_from_slice(bytes);
                if version.minor >= 1 {
                    let entry_len = 4usize + bytes.len();
                    let padded = align4(entry_len);
                    let target = out.len() + padded - entry_len;
                    pad_to(&mut out, target);
                }
            }
        }
        SectionData::TypeTable(table) => {
            out = encode_type_table(version, table)?;
        }
        SectionData::ConstPool(pool) => {
            out.extend_from_slice(&(pool.entries.len() as u32).to_le_bytes());
            for entry in &pool.entries {
                out.extend_from_slice(&entry.type_id.to_le_bytes());
                out.extend_from_slice(&(entry.payload.len() as u32).to_le_bytes());
                out.extend_from_slice(&entry.payload);
            }
        }
        SectionData::RefTable(table) => {
            out.extend_from_slice(&(table.entries.len() as u32).to_le_bytes());
            for entry in &table.entries {
                out.push(entry.location as u8);
                out.push(0);
                out.extend_from_slice(&0u16.to_le_bytes());
                out.extend_from_slice(&entry.owner_id.to_le_bytes());
                out.extend_from_slice(&entry.offset.to_le_bytes());
                out.extend_from_slice(&(entry.segments.len() as u32).to_le_bytes());
                for segment in &entry.segments {
                    match segment {
                        super::RefSegment::Index(indices) => {
                            out.push(0);
                            out.extend_from_slice(&[0u8; 3]);
                            out.extend_from_slice(&(indices.len() as u32).to_le_bytes());
                            for index in indices {
                                out.extend_from_slice(&index.to_le_bytes());
                            }
                        }
                        super::RefSegment::Field { name_idx } => {
                            out.push(1);
                            out.extend_from_slice(&[0u8; 3]);
                            out.extend_from_slice(&name_idx.to_le_bytes());
                        }
                    }
                }
            }
        }
        SectionData::PouIndex(index) => {
            out.extend_from_slice(&(index.entries.len() as u32).to_le_bytes());
            for entry in &index.entries {
                out.extend_from_slice(&entry.id.to_le_bytes());
                out.extend_from_slice(&entry.name_idx.to_le_bytes());
                out.push(entry.kind as u8);
                out.push(0);
                out.extend_from_slice(&0u16.to_le_bytes());
                out.extend_from_slice(&entry.code_offset.to_le_bytes());
                out.extend_from_slice(&entry.code_length.to_le_bytes());
                out.extend_from_slice(&entry.local_ref_start.to_le_bytes());
                out.extend_from_slice(&entry.local_ref_count.to_le_bytes());
                out.extend_from_slice(&entry.return_type_id.unwrap_or(u32::MAX).to_le_bytes());
                out.extend_from_slice(&entry.owner_pou_id.unwrap_or(u32::MAX).to_le_bytes());
                out.extend_from_slice(&(entry.params.len() as u32).to_le_bytes());
                for param in &entry.params {
                    out.extend_from_slice(&param.name_idx.to_le_bytes());
                    out.extend_from_slice(&param.type_id.to_le_bytes());
                    out.push(param.direction);
                    out.push(0);
                    out.extend_from_slice(&0u16.to_le_bytes());
                    if version.minor >= 1 {
                        out.extend_from_slice(
                            &param.default_const_idx.unwrap_or(u32::MAX).to_le_bytes(),
                        );
                    }
                }
                if let Some(meta) = &entry.class_meta {
                    out.extend_from_slice(&meta.parent_pou_id.unwrap_or(u32::MAX).to_le_bytes());
                    out.extend_from_slice(&(meta.interfaces.len() as u32).to_le_bytes());
                    for interface in &meta.interfaces {
                        out.extend_from_slice(&interface.interface_type_id.to_le_bytes());
                        out.extend_from_slice(&(interface.vtable_slots.len() as u32).to_le_bytes());
                        for slot in &interface.vtable_slots {
                            out.extend_from_slice(&slot.to_le_bytes());
                        }
                    }
                    out.extend_from_slice(&(meta.methods.len() as u32).to_le_bytes());
                    for method in &meta.methods {
                        out.extend_from_slice(&method.name_idx.to_le_bytes());
                        out.extend_from_slice(&method.pou_id.to_le_bytes());
                        out.extend_from_slice(&method.vtable_slot.to_le_bytes());
                        out.push(method.access);
                        out.push(method.flags);
                        out.extend_from_slice(&0u16.to_le_bytes());
                    }
                } else if entry.kind.is_class_like() {
                    out.extend_from_slice(&u32::MAX.to_le_bytes());
                    out.extend_from_slice(&0u32.to_le_bytes());
                    out.extend_from_slice(&0u32.to_le_bytes());
                }
            }
        }
        SectionData::PouBodies(bodies) => out.extend_from_slice(bodies),
        SectionData::ResourceMeta(meta) => {
            out.extend_from_slice(&(meta.resources.len() as u32).to_le_bytes());
            for resource in &meta.resources {
                out.extend_from_slice(&resource.name_idx.to_le_bytes());
                out.extend_from_slice(&resource.inputs_size.to_le_bytes());
                out.extend_from_slice(&resource.outputs_size.to_le_bytes());
                out.extend_from_slice(&resource.memory_size.to_le_bytes());
                out.extend_from_slice(&(resource.tasks.len() as u32).to_le_bytes());
                for task in &resource.tasks {
                    out.extend_from_slice(&task.name_idx.to_le_bytes());
                    out.extend_from_slice(&task.priority.to_le_bytes());
                    out.extend_from_slice(&task.interval_nanos.to_le_bytes());
                    out.extend_from_slice(&task.single_name_idx.unwrap_or(u32::MAX).to_le_bytes());
                    out.extend_from_slice(&(task.program_name_idx.len() as u32).to_le_bytes());
                    for idx in &task.program_name_idx {
                        out.extend_from_slice(&idx.to_le_bytes());
                    }
                    out.extend_from_slice(&(task.fb_ref_idx.len() as u32).to_le_bytes());
                    for idx in &task.fb_ref_idx {
                        out.extend_from_slice(&idx.to_le_bytes());
                    }
                }
            }
        }
        SectionData::IoMap(map) => {
            out.extend_from_slice(&(map.bindings.len() as u32).to_le_bytes());
            for binding in &map.bindings {
                out.extend_from_slice(&binding.address_str_idx.to_le_bytes());
                out.extend_from_slice(&binding.ref_idx.to_le_bytes());
                out.extend_from_slice(&binding.type_id.unwrap_or(u32::MAX).to_le_bytes());
            }
        }
        SectionData::DebugMap(map) => {
            out.extend_from_slice(&(map.entries.len() as u32).to_le_bytes());
            for entry in &map.entries {
                out.extend_from_slice(&entry.pou_id.to_le_bytes());
                out.extend_from_slice(&entry.code_offset.to_le_bytes());
                out.extend_from_slice(&entry.file_idx.to_le_bytes());
                out.extend_from_slice(&entry.line.to_le_bytes());
                out.extend_from_slice(&entry.column.to_le_bytes());
                out.push(entry.kind);
                out.extend_from_slice(&[0u8; 3]);
            }
        }
        SectionData::VarMeta(meta) => {
            out.extend_from_slice(&(meta.entries.len() as u32).to_le_bytes());
            for entry in &meta.entries {
                out.extend_from_slice(&entry.name_idx.to_le_bytes());
                out.extend_from_slice(&entry.type_id.to_le_bytes());
                out.extend_from_slice(&entry.ref_idx.to_le_bytes());
                out.push(entry.retain);
                out.push(0);
                out.extend_from_slice(&0u16.to_le_bytes());
                out.extend_from_slice(&entry.init_const_idx.unwrap_or(u32::MAX).to_le_bytes());
            }
        }
        SectionData::RetainInit(retain) => {
            out.extend_from_slice(&(retain.entries.len() as u32).to_le_bytes());
            for entry in &retain.entries {
                out.extend_from_slice(&entry.ref_idx.to_le_bytes());
                out.extend_from_slice(&entry.const_idx.to_le_bytes());
            }
        }
        SectionData::Raw(raw) => out.extend_from_slice(raw),
    }
    Ok(out)
}

fn encode_type_table(
    version: BytecodeVersion,
    table: &TypeTable,
) -> Result<Vec<u8>, BytecodeError> {
    let mut out = Vec::new();
    out.extend_from_slice(&(table.entries.len() as u32).to_le_bytes());
    if version.minor >= 1 {
        let entry_buffers: Vec<Vec<u8>> = table
            .entries
            .iter()
            .map(|entry| {
                let mut buf = Vec::new();
                encode_type_entry(entry, &mut buf);
                buf
            })
            .collect();
        let offsets = compute_type_offsets(&entry_buffers);
        for offset in &offsets {
            out.extend_from_slice(&offset.to_le_bytes());
        }
        for buf in entry_buffers {
            out.extend_from_slice(&buf);
        }
    } else {
        for entry in &table.entries {
            encode_type_entry(entry, &mut out);
        }
    }
    Ok(out)
}

fn encode_type_entry(entry: &TypeEntry, out: &mut Vec<u8>) {
    out.push(entry.kind as u8);
    out.push(0);
    out.extend_from_slice(&0u16.to_le_bytes());
    let name_idx = entry.name_idx.unwrap_or(u32::MAX);
    out.extend_from_slice(&name_idx.to_le_bytes());
    match &entry.data {
        TypeData::Primitive {
            prim_id,
            max_length,
        } => {
            out.extend_from_slice(&prim_id.to_le_bytes());
            out.extend_from_slice(&max_length.to_le_bytes());
        }
        TypeData::Array { elem_type_id, dims } => {
            out.extend_from_slice(&elem_type_id.to_le_bytes());
            out.extend_from_slice(&(dims.len() as u32).to_le_bytes());
            for (lower, upper) in dims {
                out.extend_from_slice(&lower.to_le_bytes());
                out.extend_from_slice(&upper.to_le_bytes());
            }
        }
        TypeData::Struct { fields } | TypeData::Union { fields } => {
            out.extend_from_slice(&(fields.len() as u32).to_le_bytes());
            for field in fields {
                out.extend_from_slice(&field.name_idx.to_le_bytes());
                out.extend_from_slice(&field.type_id.to_le_bytes());
            }
        }
        TypeData::Enum {
            base_type_id,
            variants,
        } => {
            out.extend_from_slice(&base_type_id.to_le_bytes());
            out.extend_from_slice(&(variants.len() as u32).to_le_bytes());
            for variant in variants {
                out.extend_from_slice(&variant.name_idx.to_le_bytes());
                out.extend_from_slice(&variant.value.to_le_bytes());
            }
        }
        TypeData::Alias { target_type_id } => {
            out.extend_from_slice(&target_type_id.to_le_bytes());
        }
        TypeData::Subrange {
            base_type_id,
            lower,
            upper,
        } => {
            out.extend_from_slice(&base_type_id.to_le_bytes());
            out.extend_from_slice(&lower.to_le_bytes());
            out.extend_from_slice(&upper.to_le_bytes());
        }
        TypeData::Reference { target_type_id } => {
            out.extend_from_slice(&target_type_id.to_le_bytes());
        }
        TypeData::Pou { pou_id } => {
            out.extend_from_slice(&pou_id.to_le_bytes());
        }
        TypeData::Interface { methods } => {
            out.extend_from_slice(&(methods.len() as u32).to_le_bytes());
            for method in methods {
                out.extend_from_slice(&method.name_idx.to_le_bytes());
                out.extend_from_slice(&method.slot.to_le_bytes());
            }
        }
    }
}

fn compute_type_offsets(entry_buffers: &[Vec<u8>]) -> Vec<u32> {
    let mut offsets = Vec::with_capacity(entry_buffers.len());
    let mut cursor = 4u32 + (entry_buffers.len() as u32 * 4);
    for buf in entry_buffers {
        offsets.push(cursor);
        cursor = cursor.saturating_add(buf.len() as u32);
    }
    offsets
}

pub(crate) fn compute_type_offsets_for_entries(entries: &[TypeEntry]) -> Vec<u32> {
    let entry_buffers: Vec<Vec<u8>> = entries
        .iter()
        .map(|entry| {
            let mut buf = Vec::new();
            encode_type_entry(entry, &mut buf);
            buf
        })
        .collect();
    compute_type_offsets(&entry_buffers)
}
