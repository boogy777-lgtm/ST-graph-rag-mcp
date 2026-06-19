use smol_str::SmolStr;

use super::{BytecodeEncoder, BytecodeError};

impl<'a> BytecodeEncoder<'a> {
    pub(super) fn file_path_index(&mut self, file_id: u32) -> Result<u32, BytecodeError> {
        if let Some(idx) = self.file_path_indices.get(&file_id) {
            return Ok(*idx);
        }
        let label = if let Some(paths) = self.paths {
            let path = paths
                .get(file_id as usize)
                .ok_or_else(|| BytecodeError::InvalidSection("debug path missing".into()))?;
            SmolStr::new(*path)
        } else {
            SmolStr::new(format!("file_{}", file_id))
        };
        let idx = self.debug_strings.intern(label);
        self.file_path_indices.insert(file_id, idx);
        Ok(idx)
    }
}
