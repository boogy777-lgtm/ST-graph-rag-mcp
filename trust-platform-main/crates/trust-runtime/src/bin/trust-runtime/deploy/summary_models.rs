struct SourceDiff {
    added: Vec<String>,
    removed: Vec<String>,
    modified: Vec<String>,
}

impl SourceDiff {
    fn is_empty(&self) -> bool {
        self.added.is_empty() && self.removed.is_empty() && self.modified.is_empty()
    }
}

struct BundleChangeSummary {
    previous_path: Option<PathBuf>,
    runtime_changes: Vec<String>,
    io_changes: Vec<String>,
    bytecode_changed: bool,
    source_diff: SourceDiff,
}

impl BundleChangeSummary {
    fn new(previous: Option<&RuntimeBundle>, next: &RuntimeBundle) -> Self {
        let runtime_changes = diff_runtime(previous.map(|b| &b.runtime), &next.runtime);
        let io_changes = diff_io(previous.map(|b| &b.io), &next.io);
        let bytecode_changed = previous
            .map(|b| b.bytecode != next.bytecode)
            .unwrap_or(true);
        let source_diff = diff_sources(previous.map(|b| b.root.as_path()), next.root.as_path());
        Self {
            previous_path: previous.map(|b| b.root.clone()),
            runtime_changes,
            io_changes,
            bytecode_changed,
            source_diff,
        }
    }

    fn print(&self) {
        println!("Deployment summary:");
        if let Some(path) = &self.previous_path {
            println!("previous project version: {}", path.display());
        } else {
            println!("previous project version: none");
        }
        if self.runtime_changes.is_empty() {
            println!("runtime.toml: unchanged");
        } else {
            println!("runtime.toml changes:");
            for change in &self.runtime_changes {
                println!("  - {change}");
            }
        }
        if self.io_changes.is_empty() {
            println!("io.toml: unchanged");
        } else {
            println!("io.toml changes:");
            for change in &self.io_changes {
                println!("  - {change}");
            }
        }
        if self.bytecode_changed {
            println!("program.stbc: updated");
        } else {
            println!("program.stbc: unchanged");
        }
        if self.source_diff.is_empty() {
            println!("sources: unchanged");
        } else {
            if !self.source_diff.added.is_empty() {
                println!("sources added: {}", self.source_diff.added.join(", "));
            }
            if !self.source_diff.removed.is_empty() {
                println!("sources removed: {}", self.source_diff.removed.join(", "));
            }
            if !self.source_diff.modified.is_empty() {
                println!("sources modified: {}", self.source_diff.modified.join(", "));
            }
        }
    }

    fn render(&self) -> String {
        let mut lines = Vec::new();
        lines.push("Deployment summary".to_string());
        if let Some(path) = &self.previous_path {
            lines.push(format!("previous project version: {}", path.display()));
        } else {
            lines.push("previous project version: none".to_string());
        }
        if self.runtime_changes.is_empty() {
            lines.push("runtime.toml: unchanged".to_string());
        } else {
            lines.push("runtime.toml changes:".to_string());
            for change in &self.runtime_changes {
                lines.push(format!("  - {change}"));
            }
        }
        if self.io_changes.is_empty() {
            lines.push("io.toml: unchanged".to_string());
        } else {
            lines.push("io.toml changes:".to_string());
            for change in &self.io_changes {
                lines.push(format!("  - {change}"));
            }
        }
        lines.push(format!(
            "program.stbc: {}",
            if self.bytecode_changed {
                "updated"
            } else {
                "unchanged"
            }
        ));
        if self.source_diff.is_empty() {
            lines.push("sources: unchanged".to_string());
        } else {
            if !self.source_diff.added.is_empty() {
                lines.push(format!(
                    "sources added: {}",
                    self.source_diff.added.join(", ")
                ));
            }
            if !self.source_diff.removed.is_empty() {
                lines.push(format!(
                    "sources removed: {}",
                    self.source_diff.removed.join(", ")
                ));
            }
            if !self.source_diff.modified.is_empty() {
                lines.push(format!(
                    "sources modified: {}",
                    self.source_diff.modified.join(", ")
                ));
            }
        }
        lines.join("\n")
    }
}
