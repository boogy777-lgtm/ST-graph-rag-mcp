//! Runtime benchmark: bytecode generation from a large ST file.
//!
//! ## Measured performance (p50 / p99) — Windows, Ryzen 7, release LTO
//! - **Bytecode generation** (100k LOC → module + encode): p50 = 43.885ms, p99 = 59.321ms
//! - Throughput: ~2.3M lines/sec
//!
//! ## What we measure
//! Full compilation pipeline: source → HIR → bytecode module → serialized bytes.
//! This exercises symbol collection, type-checking, low-level IR lowering,
//! and binary encoding—the cold path of a deploy build.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use trust_runtime::harness::bytecode_bytes_from_source;

fn bench_runtime(c: &mut Criterion) {
    let source = include_str!("../tests/data/large_project.st");

    c.bench_function("runtime_bytecode_100k_loc", |b| {
        b.iter(|| {
            let result = bytecode_bytes_from_source(black_box(source));
            black_box(result)
        })
    });
}

criterion_group!(benches, bench_runtime);
criterion_main!(benches);
