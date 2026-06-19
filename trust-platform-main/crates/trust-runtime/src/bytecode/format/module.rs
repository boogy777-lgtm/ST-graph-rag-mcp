/// Decoded bytecode module.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BytecodeModule {
    pub version: BytecodeVersion,
    pub flags: u32,
    pub sections: Vec<Section>,
}

impl BytecodeModule {
    #[must_use]
    pub fn new(version: BytecodeVersion) -> Self {
        let flags = if version.minor >= 1 {
            HEADER_FLAG_CRC32
        } else {
            0
        };
        Self {
            version,
            flags,
            sections: Vec::new(),
        }
    }

    #[must_use]
    pub fn section(&self, id: SectionId) -> Option<&SectionData> {
        self.sections
            .iter()
            .find(|section| section.id == id.as_raw())
            .map(|section| &section.data)
    }

    #[must_use]
    pub fn section_mut(&mut self, id: SectionId) -> Option<&mut SectionData> {
        self.sections
            .iter_mut()
            .find(|section| section.id == id.as_raw())
            .map(|section| &mut section.data)
    }
}
