use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
struct TableMap {
    table: Vec<TableEntry>,
}

#[derive(Debug, Deserialize)]
struct TableEntry {
    id: String,
    spec: Option<String>,
    tests: Vec<String>,
}

#[test]
fn iec_table_coverage_report() {
    let repo_root = repo_root();
    let map_path = repo_root.join("docs/specs/coverage/iec-table-test-map.toml");
    let map = fs::read_to_string(&map_path).expect("read IEC table map");
    let map: TableMap = toml::from_str(&map).expect("parse IEC table map");

    let test_names = collect_test_names(&repo_root);
    let mut missing = Vec::new();
    let mut report = String::new();

    for entry in map.table {
        let spec = entry.spec.as_deref().unwrap_or("-");
        report.push_str(&format!("{} ({})\n", entry.id, spec));
        for test_name in entry.tests {
            let status = if let Some(paths) = test_names.get(&test_name) {
                let mut shown = paths
                    .iter()
                    .map(|path| display_path(path, &repo_root))
                    .collect::<Vec<_>>();
                shown.sort();
                format!("ok [{}]", shown.join(", "))
            } else {
                missing.push(test_name.clone());
                "MISSING".to_string()
            };
            report.push_str(&format!("  - {test_name}: {status}\n"));
        }
        report.push('\n');
    }

    insta::assert_snapshot!(report);
    assert!(
        missing.is_empty(),
        "missing IEC table tests: {}",
        missing.join(", ")
    );
}

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .expect("repo root")
        .to_path_buf()
}

fn collect_test_names(repo_root: &Path) -> BTreeMap<String, Vec<PathBuf>> {
    let mut names: BTreeMap<String, Vec<PathBuf>> = BTreeMap::new();
    let mut dirs = vec![repo_root.join("crates"), repo_root.join("tests")];

    while let Some(dir) = dirs.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if should_skip(&path) {
                continue;
            }
            if path.is_dir() {
                dirs.push(path);
            } else if path.extension().and_then(|ext| ext.to_str()) == Some("rs") {
                let Ok(contents) = fs::read_to_string(&path) else {
                    continue;
                };
                for test_name in parse_test_names(&contents) {
                    names.entry(test_name).or_default().push(path.clone());
                }
            }
        }
    }

    names
}

fn parse_test_names(source: &str) -> BTreeSet<String> {
    let mut names = BTreeSet::new();
    let mut pending = false;
    for line in source.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("#[test]") || trimmed.starts_with("#[tokio::test]") {
            pending = true;
            continue;
        }
        if pending && trimmed.starts_with("#[") {
            continue;
        }
        if pending {
            if let Some(name) = parse_fn_name(trimmed) {
                names.insert(name);
                pending = false;
            }
        }
    }
    names
}

fn parse_fn_name(line: &str) -> Option<String> {
    let line = line.trim_start();
    let line = line
        .strip_prefix("pub fn ")
        .or_else(|| line.strip_prefix("pub(crate) fn "))
        .or_else(|| line.strip_prefix("fn "))
        .or_else(|| line.strip_prefix("async fn "))
        .or_else(|| line.strip_prefix("pub async fn "))
        .or_else(|| line.strip_prefix("pub(crate) async fn "))?;
    let name = line
        .split(|ch: char| !ch.is_ascii_alphanumeric() && ch != '_')
        .next()
        .filter(|name| !name.is_empty())?;
    Some(name.to_string())
}

fn should_skip(path: &Path) -> bool {
    path.components().any(|component| {
        let name = component.as_os_str().to_string_lossy();
        name == "target" || name == ".git" || name == "node_modules"
    })
}

fn display_path(path: &Path, repo_root: &Path) -> String {
    let display = path
        .strip_prefix(repo_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();
    display.replace('\\', "/")
}
