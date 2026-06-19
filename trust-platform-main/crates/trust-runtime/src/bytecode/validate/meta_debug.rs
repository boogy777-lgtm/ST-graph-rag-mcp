fn validate_var_meta(
    strings: &StringTable,
    types: &TypeTable,
    const_pool: &ConstPool,
    ref_table: &RefTable,
    meta: &VarMeta,
) -> Result<(), BytecodeError> {
    for entry in &meta.entries {
        ensure_string_index(strings, entry.name_idx)?;
        ensure_type_index(types, entry.type_id)?;
        ensure_ref_index(ref_table, entry.ref_idx)?;
        if entry.retain > 3 {
            return Err(BytecodeError::InvalidSection(
                "invalid retain policy".into(),
            ));
        }
        if let Some(init_idx) = entry.init_const_idx {
            ensure_const_index(const_pool, init_idx)?;
        }
    }
    Ok(())
}

fn validate_retain_init(
    const_pool: &ConstPool,
    ref_table: &RefTable,
    retain: &RetainInit,
) -> Result<(), BytecodeError> {
    for entry in &retain.entries {
        ensure_ref_index(ref_table, entry.ref_idx)?;
        ensure_const_index(const_pool, entry.const_idx)?;
    }
    Ok(())
}

fn validate_debug_map(
    strings: &StringTable,
    pou_index: &PouIndex,
    map: &DebugMap,
) -> Result<(), BytecodeError> {
    for entry in &map.entries {
        let pou = pou_index
            .entries
            .iter()
            .find(|pou| pou.id == entry.pou_id)
            .ok_or(BytecodeError::InvalidPouId(entry.pou_id))?;
        let end = pou
            .code_offset
            .checked_add(pou.code_length)
            .ok_or_else(|| BytecodeError::InvalidSection("POU code range overflow".into()))?;
        if entry.code_offset < pou.code_offset || entry.code_offset > end {
            return Err(BytecodeError::InvalidSection(
                "debug map code offset out of bounds".into(),
            ));
        }
        ensure_string_index(strings, entry.file_idx)?;
    }
    Ok(())
}

fn ensure_string_index(strings: &StringTable, idx: u32) -> Result<(), BytecodeError> {
    if idx as usize >= strings.entries.len() {
        return Err(BytecodeError::InvalidIndex {
            kind: "string".into(),
            index: idx,
        });
    }
    Ok(())
}

fn ensure_type_index(types: &TypeTable, idx: u32) -> Result<(), BytecodeError> {
    if idx as usize >= types.entries.len() {
        return Err(BytecodeError::InvalidIndex {
            kind: "type".into(),
            index: idx,
        });
    }
    Ok(())
}

fn ensure_const_index(pool: &ConstPool, idx: u32) -> Result<(), BytecodeError> {
    if idx as usize >= pool.entries.len() {
        return Err(BytecodeError::InvalidIndex {
            kind: "const".into(),
            index: idx,
        });
    }
    Ok(())
}

fn ensure_ref_index(table: &RefTable, idx: u32) -> Result<(), BytecodeError> {
    if idx as usize >= table.entries.len() {
        return Err(BytecodeError::InvalidIndex {
            kind: "ref".into(),
            index: idx,
        });
    }
    Ok(())
}
