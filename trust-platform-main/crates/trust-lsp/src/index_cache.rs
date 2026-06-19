//! Persistent workspace index cache.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::hash::Hasher;
use std::path::Path;
use std::time::UNIX_EPOCH;

const CACHE_VERSION: u32 = 1;
const CACHE_FILE: &str = "index.json";

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct IndexCache {
    version: u32,
    entries: HashMap<String, CacheEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CacheEntry {
    hash: u64,
    size: u64,
    mtime: Option<u64>,
    content: String,
}

impl Default for IndexCache {
    fn default() -> Self {
        Self {
            version: CACHE_VERSION,
            entries: HashMap::new(),
        }
    }
}

impl IndexCache {
    pub(crate) fn load_or_default(dir: &Path) -> Self {
        let path = dir.join(CACHE_FILE);
        let Ok(contents) = fs::read_to_string(&path) else {
            return Self::default();
        };
        let Ok(mut cache) = serde_json::from_str::<IndexCache>(&contents) else {
            return Self::default();
        };
        if cache.version != CACHE_VERSION {
            cache.version = CACHE_VERSION;
            cache.entries.clear();
        }
        cache
    }

    pub(crate) fn save(&self, dir: &Path) -> std::io::Result<()> {
        fs::create_dir_all(dir)?;
        let path = dir.join(CACHE_FILE);
        let payload = serde_json::to_string_pretty(self).unwrap_or_else(|_| "{}".to_string());
        fs::write(path, payload)
    }

    pub(crate) fn content_for_path(&self, path: &Path) -> Option<&str> {
        let key = cache_key(path);
        let entry = self.entries.get(&key)?;
        if entry.matches_metadata(path) {
            Some(entry.content.as_str())
        } else {
            None
        }
    }

    pub(crate) fn update_from_content(&mut self, path: &Path, content: String) -> u64 {
        let (size, mtime) = metadata_signature(path).unwrap_or((content.len() as u64, None));
        let hash = hash_content(&content);
        let key = cache_key(path);
        if let Some(entry) = self.entries.get_mut(&key) {
            if entry.hash == hash {
                entry.size = size;
                entry.mtime = mtime;
                return hash;
            }
        }
        let entry = CacheEntry {
            hash,
            size,
            mtime,
            content,
        };
        self.entries.insert(key, entry);
        hash
    }

    pub(crate) fn remove_path(&mut self, path: &Path) {
        self.entries.remove(&cache_key(path));
    }

    pub(crate) fn retain_paths(&mut self, paths: &[std::path::PathBuf]) {
        let mut keep = HashSet::with_capacity(paths.len());
        for path in paths {
            keep.insert(cache_key(path));
        }
        self.entries.retain(|key, _| keep.contains(key));
    }
}

impl CacheEntry {
    fn matches_metadata(&self, path: &Path) -> bool {
        let Some((size, mtime)) = metadata_signature(path) else {
            return false;
        };
        self.size == size && self.mtime == mtime
    }
}

fn cache_key(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn metadata_signature(path: &Path) -> Option<(u64, Option<u64>)> {
    let meta = fs::metadata(path).ok()?;
    let size = meta.len();
    let mtime = meta
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs());
    Some((size, mtime))
}

fn hash_content(content: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    std::hash::Hash::hash(content, &mut hasher);
    hasher.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(prefix: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let dir = std::env::temp_dir().join(format!("{prefix}-{stamp}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn cache_round_trip_and_invalidate_on_change() {
        let root = temp_dir("trustlsp-index-cache");
        let cache_dir = root.join(".trust-lsp/index-cache");
        let file_path = root.join("main.st");
        fs::write(&file_path, "PROGRAM Test\nEND_PROGRAM\n").expect("write file");

        let mut cache = IndexCache::load_or_default(&cache_dir);
        assert!(cache.content_for_path(&file_path).is_none());

        let content = fs::read_to_string(&file_path).expect("read file");
        cache.update_from_content(&file_path, content.clone());
        cache.save(&cache_dir).expect("save cache");

        let cache = IndexCache::load_or_default(&cache_dir);
        let cached = cache.content_for_path(&file_path).expect("cached content");
        assert_eq!(cached, content);

        fs::write(
            &file_path,
            "PROGRAM Test\nVAR x : INT; END_VAR\nEND_PROGRAM\n",
        )
        .expect("write update");

        let cache = IndexCache::load_or_default(&cache_dir);
        assert!(cache.content_for_path(&file_path).is_none());

        fs::remove_dir_all(root).ok();
    }
}
