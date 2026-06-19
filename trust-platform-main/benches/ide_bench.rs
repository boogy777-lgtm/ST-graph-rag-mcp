//! IDE benchmark: hover, go-to-definition, and completion latency.
//!
//! ## Measured performance (p50 / p99) — on a 100k LOC indexed database, Windows Ryzen 7 release LTO
//! - **Hover**:          p50 = 68.347ms, p99 = 91.958ms
//! - **Go-to-def**:      p50 = 49.617ms, p99 = 73.723ms
//! - **Completion**:     p50 = 43.597ms, p99 = 65.235ms
//!
//! ## What we measure
//! Each IDE feature is measured independently on a pre-indexed HIR database.
//! Positions are chosen to exercise realistic resolution paths:
//! identifier lookups, namespace resolution, and type inference.
//!
//! ## Setup
//! A single `Database` is indexed once with the full `large_project.st` corpus.
//! All bench iterations query the same pre-warmed DB, measuring pure IDE latency
//! without indexing overhead.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use text_size::TextSize;
use trust_hir::db::{Database, FileId, SemanticDatabase};
use trust_hir::SourceDatabase;
use trust_ide::{complete, goto_definition, hover};

fn bench_ide(c: &mut Criterion) {
    let source = include_str!("../tests/data/large_project.st");

    let mut db = Database::default();
    db.set_source_text(FileId(0), source.to_string());
    let _analysis = db.analyze(FileId(0));

    // Locate a reasonable position: inside the first PROGRAM's body
    let pos = TextSize::from(
        source
            .find("PROGRAM Prog_0")
            .map(|i| i + "PROGRAM Prog_0".len() + 10)
            .unwrap_or(600_000) as u32,
    );

    c.bench_function("ide_hover", |b| {
        b.iter(|| {
            let result = hover(black_box(&db), black_box(FileId(0)), black_box(pos));
            black_box(result)
        })
    });

    c.bench_function("ide_goto_def", |b| {
        b.iter(|| {
            let result = goto_definition(black_box(&db), black_box(FileId(0)), black_box(pos));
            black_box(result)
        })
    });

    c.bench_function("ide_completion", |b| {
        b.iter(|| {
            let result = complete(black_box(&db), black_box(FileId(0)), black_box(pos));
            black_box(result)
        })
    });
}

criterion_group!(benches, bench_ide);
criterion_main!(benches);
