//! Paused-state view helper for snapshot/runtime reads.

use std::sync::{Arc, Mutex};

use trust_runtime::debug::{DebugControl, DebugSnapshot};
use trust_runtime::memory::VariableStorage;
use trust_runtime::Runtime;

/// Read-only view of runtime state, preferring snapshots when paused.
pub struct PausedStateView {
    snapshot: Option<DebugSnapshot>,
    runtime: Arc<Mutex<Runtime>>,
}

impl PausedStateView {
    pub fn new(control: DebugControl, runtime: Arc<Mutex<Runtime>>) -> Self {
        let snapshot = control.snapshot();
        Self { snapshot, runtime }
    }

    /// Access variable storage (snapshot if paused, runtime otherwise).
    pub fn with_storage<R>(&self, f: impl FnOnce(&VariableStorage) -> R) -> Option<R> {
        if let Some(snapshot) = self.snapshot.as_ref() {
            return Some(f(&snapshot.storage));
        }
        // Avoid blocking when runtime execution is paused while holding the runtime mutex.
        let guard = self.runtime.try_lock().ok()?;
        Some(f(guard.storage()))
    }

    /// Whether the view is based on a paused snapshot.
    pub fn is_paused(&self) -> bool {
        self.snapshot.is_some()
    }
}
