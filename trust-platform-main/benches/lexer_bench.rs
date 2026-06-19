//! Lexer benchmark: tokenizing a large ST file (~100k LOC).
//!
//! ## Measured performance (p50 / p99) — Windows, Ryzen 7, release LTO
//! - **Lexing 100k LOC**: p50 = 5.660ms, p99 = 6.249ms
//! - Throughput: ~17.7M lines/sec
//!
//! ## What we measure
//! Full tokenization of `large_project.st` including token iteration.
//! Trivia (whitespace/comments) is included in the token stream
//! per IEC 61131-3 lossless guarantees.

use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn bench_lexer(c: &mut Criterion) {
    let source = include_str!("../tests/data/large_project.st");

    c.bench_function("lexer_100k_loc", |b| {
        b.iter(|| {
            let tokens = trust_syntax::lex(black_box(source));
            black_box(tokens)
        })
    });
}

criterion_group!(benches, bench_lexer);
criterion_main!(benches);
