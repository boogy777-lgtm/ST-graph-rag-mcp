//! HIR benchmark: type-checking and semantic analysis (~100k LOC).
//!
//! ## Measured performance (p50 / p99) — Windows, Ryzen 7, release LTO
//! - **Cold index** (full analysis, first pass): p50 = 995.125ms, p99 = 1093.102ms
//! - **Warm cache** (re-query, salsa-cached): p50 = 287ns, p99 ≈ 290ns
//!
//! ## What we measure
//! - **Cold**: `Database::new()` + `set_source_text()` + `analyze()` — full HIR from scratch.
//! - **Warm**: Re-query `file_symbols()` and `diagnostics()` on the same DB — Salsa cache hit.
//! - These are separated into distinct bench groups to isolate cold-start from incremental.
//!
//! ## Cache separation
//! Salsa incremental computation caches intermediate query results.
//! The "cold" benchmark constructs a fresh database per iteration.
//! The "warm" benchmark reuses a pre-populated database, measuring query latency.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use trust_hir::db::{Database, FileId, SemanticDatabase};
use trust_hir::SourceDatabase;

fn bench_hir_cold(c: &mut Criterion) {
    let source = include_str!("../tests/data/large_project.st");

    c.bench_function("hir_cold_100k_loc", |b| {
        b.iter(|| {
            let mut db = Database::default();
            db.set_source_text(FileId(0), source.to_string());
            let analysis = db.analyze(FileId(0));
            black_box(analysis)
        })
    });
}

fn bench_hir_warm(c: &mut Criterion) {
    let source = include_str!("../tests/data/large_project.st");

    let mut db = Database::default();
    db.set_source_text(FileId(0), source.to_string());
    let _ = db.analyze(FileId(0));

    c.bench_function("hir_warm_100k_loc", |b| {
        b.iter(|| {
            let symbols = db.file_symbols(FileId(0));
            let diags = db.diagnostics(FileId(0));
            black_box((symbols, diags))
        })
    });
}

criterion_group!(benches, bench_hir_cold, bench_hir_warm);
criterion_main!(benches);
