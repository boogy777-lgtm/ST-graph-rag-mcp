fn validate_resource_meta(
    strings: &StringTable,
    ref_table: &RefTable,
    pou_index: &PouIndex,
    meta: &ResourceMeta,
) -> Result<(), BytecodeError> {
    let mut program_names = HashSet::new();
    for entry in &pou_index.entries {
        if entry.kind == PouKind::Program {
            let name = strings
                .entries
                .get(entry.name_idx as usize)
                .ok_or_else(|| BytecodeError::InvalidIndex {
                    kind: "string".into(),
                    index: entry.name_idx,
                })?;
            program_names.insert(name.to_ascii_uppercase());
        }
    }

    for resource in &meta.resources {
        ensure_string_index(strings, resource.name_idx)?;
        for task in &resource.tasks {
            ensure_string_index(strings, task.name_idx)?;
            if let Some(single_idx) = task.single_name_idx {
                ensure_string_index(strings, single_idx)?;
            }
            for idx in &task.program_name_idx {
                ensure_string_index(strings, *idx)?;
                let name = strings.entries.get(*idx as usize).ok_or_else(|| {
                    BytecodeError::InvalidIndex {
                        kind: "string".into(),
                        index: *idx,
                    }
                })?;
                if !program_names.contains(&name.to_ascii_uppercase()) {
                    return Err(BytecodeError::InvalidSection(
                        format!("task references unknown program '{}'", name).into(),
                    ));
                }
            }
            for idx in &task.fb_ref_idx {
                if *idx as usize >= ref_table.entries.len() {
                    return Err(BytecodeError::InvalidIndex {
                        kind: "ref".into(),
                        index: *idx,
                    });
                }
            }
        }
    }
    Ok(())
}

fn validate_io_map(
    strings: &StringTable,
    types: &TypeTable,
    ref_table: &RefTable,
    map: &IoMap,
) -> Result<(), BytecodeError> {
    for binding in &map.bindings {
        ensure_string_index(strings, binding.address_str_idx)?;
        if binding.ref_idx as usize >= ref_table.entries.len() {
            return Err(BytecodeError::InvalidIndex {
                kind: "ref".into(),
                index: binding.ref_idx,
            });
        }
        if let Some(type_id) = binding.type_id {
            ensure_type_index(types, type_id)?;
        }
    }
    Ok(())
}
