//! Runtime mesh helpers (snapshot/apply).

#![allow(missing_docs)]

use indexmap::IndexMap;
use smol_str::SmolStr;

use crate::value::Value;

use super::core::Runtime;

impl Runtime {
    /// Snapshot global values for mesh publishing.
    pub fn snapshot_globals(&self, names: &[SmolStr]) -> IndexMap<SmolStr, Value> {
        let mut out = IndexMap::new();
        for name in names {
            if let Some(value) = self.storage().get_global(name.as_str()) {
                out.insert(name.clone(), value.clone());
            }
        }
        out
    }

    /// Apply mesh updates to globals (skips unknown names).
    pub fn apply_mesh_updates(&mut self, updates: &IndexMap<SmolStr, Value>) {
        for (name, value) in updates {
            if self.storage().get_global(name.as_str()).is_some() {
                self.storage_mut().set_global(name.as_str(), value.clone());
            }
        }
    }
}
