# Web IDE Performance Gate Evidence (2026-02-15)

Reference hardware target:
- Raspberry Pi 5 (8 GB) + Chromium stable (documented in product spec).

Automated contract suite:
- `cargo test -p trust-runtime --test web_ide_integration web_ide_reference_performance_gates_contract -- --exact`

Gate assertions in test:
- Boot-to-ready API flow p95 <= 2.5s
- Completion p95 <= 150ms
- Hover p95 <= 150ms
- Diagnostics p95 <= 300ms
- Workspace search p95 <= 400ms
- 2k-line interactive completion max <= 800ms

Related suites:
- `cargo test -p trust-runtime --test web_ide_integration`
- `cargo test -p trust-runtime --lib web::ide::tests::`

Result:
- Performance gate test passes with current runtime + IDE implementation.
