//! Parser benchmark: parsing a large ST file (~100k LOC).
//!
//! ## Measured performance (p50 / p99) — Windows, Ryzen 7, release LTO
//! - **Parsing 100k LOC**: p50 = 40.110ms, p99 = 58.488ms
//! - Throughput: ~2.5M lines/sec
//!
//! ## What we measure
//! Full recursive-descent parsing including CST construction.
//! Includes error-tolerant syntax tree building via `rowan`.

use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn bench_parser(c: &mut Criterion) {
    let source = include_str!("../tests/data/large_project.st");

    c.bench_function("parser_100k_loc", |b| {
        b.iter(|| {
            let parse = trust_syntax::parser::parse(black_box(source));
            black_box(parse)
        })
    });
}

criterion_group!(benches, bench_parser);
criterion_main!(benches);
