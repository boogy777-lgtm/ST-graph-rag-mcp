# Web IDE Full Checklist Evidence (2026-02-15)

Scope:
- `docs/internal/testing/checklists/web-ide-full-implementation-checklist.md`
- `docs/internal/runtime/trust-runtime-web-ide-full-specification.md`

Automated evidence sources:
- `cargo test -p trust-runtime --test web_ide_integration`
- `cargo test -p trust-runtime --lib web::ide::tests::`
- `cargo test -p trust-runtime --lib web::tests::`
- `python3 scripts/check_web_ide_frontend_contract.py`
- `just fmt`
- `just clippy`
- `just test`

Validation snapshot:
- `2026-02-15 20:01:41Z`
- `cargo test -p trust-runtime --test web_ide_integration` => `ok (12 passed; 0 failed)`
- `python3 scripts/check_web_ide_frontend_contract.py` => `web ide frontend contract passed`
- `just fmt` => `cargo fmt` (exit `0`)
- `just clippy` => finished in dev profile (exit `0`)
- `just test` => workspace test/doc-test suite completed (exit `0`)

## 0. Governance
- Spec/checklist source-of-truth files are versioned and linked.
- Every checklist section below maps to named automated checks in this document.

## 1. Workspace Explorer and File System
- `web_ide_tree_and_filesystem_endpoints_contract`
- `web_ide_security_and_path_traversal_contract`
- `web::ide::tests::fs_audit_log_tracks_mutating_operations`

## 2. Editor Core
- `python3 scripts/check_web_ide_frontend_contract.py` (tab bar, autosave, command palette, split, read-only surface markers)
- `web_ide_collaborative_conflict_contract`

## 3. Language Intelligence
- `web_ide_analysis_and_health_endpoints_contract`
- `web_ide_navigation_search_and_rename_endpoints_contract`
- `web::ide::tests::diagnostics_hover_and_completion_contracts_are_exposed`

## 4. Navigation and Search
- `web_ide_navigation_search_and_rename_endpoints_contract` (quick-open-backed tree/file nav + workspace/file symbols + include/exclude search)
- `web::ide::tests::workspace_search_respects_include_and_exclude_globs`

## 5. Build and Test Workflows in IDE
- `web_ide_build_test_and_validate_task_endpoints_contract`
- `web::tests::parse_task_location_line_extracts_st_coordinates`
- `web::tests::parse_task_locations_deduplicates_repeated_hits`

## 6. Reliability and Recovery
- `python3 scripts/check_web_ide_frontend_contract.py` (offline/online handlers, autosave, degraded analysis mode)
- `web_ide_collaborative_conflict_contract`
- `web_ide_viewer_sessions_are_read_only_and_editor_sessions_can_write`

## 7. Security and Access Modes
- `web_ide_security_and_path_traversal_contract`
- `web_ide_viewer_sessions_are_read_only_and_editor_sessions_can_write`
- `web::ide::tests::fs_audit_log_tracks_mutating_operations`

## 8. Accessibility and UX Quality
- `python3 scripts/check_web_ide_frontend_contract.py`
- Baseline report: `docs/internal/testing/evidence/web-ide-accessibility-validation-2026-02-15.md`

## 9. Performance Gates
- `web_ide_reference_performance_gates_contract`
- Gate summary: `docs/internal/testing/evidence/web-ide-performance-gates-2026-02-15.md`

## 10. Release Gates
- `just fmt`
- `just clippy`
- `just test`
