fn validate_section_entries(
    file_len: usize,
    entries: &[SectionEntry],
) -> Result<(), BytecodeError> {
    let mut sorted = entries.to_vec();
    sorted.sort_by_key(|entry| entry.offset);
    let mut last_end = 0usize;
    for entry in sorted {
        if entry.offset % 4 != 0 {
            return Err(BytecodeError::SectionAlignment);
        }
        let start = entry.offset as usize;
        let end = start + entry.length as usize;
        if end > file_len {
            return Err(BytecodeError::SectionOutOfBounds);
        }
        if start < last_end {
            return Err(BytecodeError::SectionOverlap);
        }
        last_end = end;
    }
    Ok(())
}
