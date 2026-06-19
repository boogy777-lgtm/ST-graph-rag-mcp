#![no_main]

use libfuzzer_sys::fuzz_target;
use trust_hir::db::{Database, FileId, SemanticDatabase, SourceDatabase};

const MAX_SOURCE_BYTES: usize = 4096;

fn decode_source(bytes: &[u8]) -> String {
    let capped = &bytes[..bytes.len().min(MAX_SOURCE_BYTES)];
    String::from_utf8_lossy(capped).into_owned()
}

fn source_offset(seed: u8, source: &str) -> u32 {
    if source.is_empty() {
        return 0;
    }
    (usize::from(seed) % source.len()) as u32
}

fn run_semantic_queries(db: &Database, file_id: FileId, source: &str, seed: u8) {
    let _ = db.file_symbols(file_id);
    let _ = db.diagnostics(file_id);
    let _ = db.analyze(file_id);

    let offset = source_offset(seed, source);
    if let Some(expr_id) = db.expr_id_at_offset(file_id, offset) {
        let _ = db.type_of(file_id, expr_id);
    }
}

fuzz_target!(|data: &[u8]| {
    if data.is_empty() {
        return;
    }

    let split_a = usize::from(data[0]) % (data.len() + 1);
    let split_b = usize::from(*data.get(1).unwrap_or(&0)) % (data.len() + 1);
    let (lo, hi) = if split_a <= split_b {
        (split_a, split_b)
    } else {
        (split_b, split_a)
    };
    let chunk_a = &data[..lo];
    let chunk_b = &data[lo..hi];
    let chunk_c = &data[hi..];

    let raw_a = decode_source(chunk_a);
    let raw_b = decode_source(chunk_b);
    let raw_c = decode_source(chunk_c);

    let mut db = Database::new();
    let mut sources = vec![
        (
            FileId(1),
            format!(
                "FUNCTION FuzzFn : DINT\nFuzzFn := {};\n{}\nEND_FUNCTION\n",
                (chunk_a.len() % 7) as i32,
                raw_a
            ),
        ),
        (
            FileId(2),
            format!(
                "PROGRAM Main\nVAR x : DINT; END_VAR\nx := FuzzFn();\n{}\nEND_PROGRAM\n",
                raw_b
            ),
        ),
        (
            FileId(3),
            if raw_c.is_empty() {
                "PROGRAM Aux\nEND_PROGRAM\n".to_string()
            } else {
                raw_c
            },
        ),
    ];

    for (file_id, source) in &sources {
        db.set_source_text(*file_id, source.clone());
    }

    for (idx, (file_id, source)) in sources.iter().enumerate() {
        let seed = *data.get(2 + idx).unwrap_or(&0);
        run_semantic_queries(&db, *file_id, source, seed);
    }

    // Edit -> invalidate -> requery cycle.
    let target_idx = usize::from(*data.get(5).unwrap_or(&0)) % sources.len();
    let mut edited_source = sources[target_idx].1.clone();
    let edit_payload = decode_source(&data[data.len() / 2..]);
    if edit_payload.is_empty() {
        edited_source.push_str("\n(* fuzz edit cycle *)\n");
    } else {
        edited_source.push('\n');
        edited_source.push_str(&edit_payload);
    }
    let target_file = sources[target_idx].0;
    db.set_source_text(target_file, edited_source.clone());
    sources[target_idx].1 = edited_source;

    let edited_seed = *data.get(6).unwrap_or(&0);
    run_semantic_queries(&db, target_file, &sources[target_idx].1, edited_seed);

    // Probe another file after edit to exercise cross-file query invalidation paths.
    let neighbor_idx = (target_idx + 1) % sources.len();
    let neighbor_seed = *data.get(7).unwrap_or(&0);
    run_semantic_queries(
        &db,
        sources[neighbor_idx].0,
        &sources[neighbor_idx].1,
        neighbor_seed,
    );

    // Remove and re-add one file to fuzz removal/re-add invalidation paths.
    let remove_idx = usize::from(*data.get(8).unwrap_or(&0)) % sources.len();
    let (removed_file, removed_source) = sources[remove_idx].clone();
    db.remove_source_text(removed_file);
    db.set_source_text(removed_file, removed_source.clone());
    let readd_seed = *data.get(9).unwrap_or(&0);
    run_semantic_queries(&db, removed_file, &removed_source, readd_seed);
});
