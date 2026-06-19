# Web IDE Full Implementation Checklist (Spec-Mapped)

Status: Complete (spec-mapped checklist fully implemented and validated)
Completed: 2026-02-15
Linked specification:
- `docs/internal/runtime/trust-runtime-web-ide-full-specification.md`

Legend:
- `[ ]` not implemented or not validated against the spec point
- `[~]` partially implemented but not yet at spec acceptance quality
- `[x]` implemented and validated with linked evidence

Evidence rule:
- No item may be marked `[x]` without command output and/or artifact evidence.
- No "full IDE" claim until every P0 and P1 item below is `[x]`.

Priority:
- `[P0]` required for first credible product demo
- `[P1]` required for release-quality full IDE
- `[P2]` follow-up hardening

## 0. Governance
- [x] [P0] G-001 Previous optimistic checklist replaced with truthful baseline. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] G-002 Every specification requirement is mapped 1:1 in this checklist. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] G-003 Every `[x]` item links to reproducible evidence. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

## 1. Objective Mapping (Spec Section 1)
- [x] [P0] OBJ-001 Browser IDE at `/ide` is product-grade, not spike-grade. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] OBJ-002 Users can browse real project folders/files. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] OBJ-003 Users can open and edit files directly in browser. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] OBJ-004 Mouse hover and inline completion work while typing. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] OBJ-005 Save/build/test workflows are usable without leaving browser. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

## 2. Reality Baseline Closure (Spec Section 2)
- [x] [P0] RB-001 Editor mode availability issue resolved (no unexpected read-only in valid authoring context). [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] RB-002 Directory-first workspace navigation complete. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] RB-003 Multi-file language behavior is consistent. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] RB-004 UI flow reaches investor-demo product quality. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

## 3. Scope Compliance (Spec Section 3)
- [x] [P0] SC-001 `/ide` product browser IDE scope delivered. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] SC-002 Project explorer with directory tree delivered. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] SC-003 Multi-tab authoring delivered. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] SC-004 ST diagnostics/hover/completion/symbol navigation delivered. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] SC-005 Save all/build/test/validate project actions delivered. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] SC-006 Reliability gates delivered. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] SC-007 Security gates delivered. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] SC-008 Accessibility/performance gates delivered. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P2] SC-009 Out-of-scope honored: no multi-user simultaneous editing in phase 1. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P2] SC-010 Out-of-scope honored: no cloud workspace hosting in phase 1. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P2] SC-011 Out-of-scope honored: no browser-only runtime execution scope in phase 1. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

## 4. Product Requirements (Spec Section 4)

### 4.1 Workspace and File System UX
- [x] [P0] PR-4.1-001 Render directory tree for project root. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.1-002 Expand/collapse directories. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.1-003 Open files from any visible directory. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.1-004 Create/rename/delete/move files and folders. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.1-005 Conflict-safe and visible file-operation errors. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.1-006 Hidden/system files are intentionally filtered or clearly marked. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 4.2 Editor UX
- [x] [P0] PR-4.2-001 Multi-tab editing. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.2-002 Dirty state/save state/unsaved warnings. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.2-003 Optional split editor (phase-1 stretch). [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.2-004 Cursor position, active file, and language status always visible. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.2-005 Keyboard-first workflow. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 4.3 Language Intelligence
- [x] [P0] PR-4.3-001 Diagnostics while typing with bounded debounce. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.3-002 Mouse hover on symbols with type/definition info. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.3-003 Completion while typing with in-scope ranking. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.3-004 Go to definition. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.3-005 Find references. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.3-006 Rename symbol. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.3-007 Cross-file analysis consistency for project symbols. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 4.4 Search and Navigation
- [x] [P0] PR-4.4-001 Quick Open (`Ctrl/Cmd+P`) fuzzy file open. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.4-002 Workspace text search with include/exclude globs. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.4-003 Symbol search (file + workspace). [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 4.5 Commands and Workflows
- [x] [P0] PR-4.5-001 Command palette. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.5-002 Save, Save All, Format Document, Build, and Test commands. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.5-003 Build/test output panel with timestamps and pass/fail summary. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.5-004 Build/test errors link back to source location. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 4.6 Session, Auth, and Modes
- [x] [P0] PR-4.6-001 Viewer vs editor mode explicit and understandable. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.6-002 Read-only mode never pretends to be editable. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.6-003 Session expiration preserves local unsaved drafts. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.6-004 Re-auth flow is non-destructive. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 4.7 Reliability and Recovery
- [x] [P0] PR-4.7-001 No indefinite loading state. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.7-002 Offline/server-loss state detected and surfaced. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.7-003 Local draft persistence protects unsaved edits. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.7-004 Reconnect recovery prevents silent overwrite. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.7-005 Multi-tab same-file collision warnings. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 4.8 Security Boundaries
- [x] [P0] PR-4.8-001 All file operations constrained to project root. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.8-002 Path traversal forbidden and tested. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.8-003 Sensitive runtime/deploy material policy explicit with audit trail. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.8-004 Write operations require authenticated editor session. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 4.9 Accessibility and UX Quality
- [x] [P1] PR-4.9-001 WCAG 2.1 AA baseline. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.9-002 Full keyboard workflow. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.9-003 Focus management and ARIA semantics. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.9-004 Light/dark mode parity. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] PR-4.9-005 Visual quality matches runtime product UI system. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 4.10 Performance Targets
- [x] [P0] PR-4.10-001 Reference hardware fixed: Raspberry Pi 5 (8GB), Chromium stable, local runtime host. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.10-002 Boot-to-interactive p95 <= 2.5s (medium project). [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.10-003 Completion visible p95 <= 150ms. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.10-004 Hover visible p95 <= 150ms. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.10-005 Diagnostics refresh p95 <= 300ms. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] PR-4.10-006 Workspace search (<= 40 ST files) p95 <= 400ms. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

## 5. Architecture Contract (Spec Section 5)

### 5.1 Frontend
- [x] [P0] AC-5.1-001 Frontend bundled and served locally from `/ide/assets/*` with no CDN dependency. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] AC-5.1-002 Editor engine fixed to Monaco for phase 1 and validated in runtime shell + asset route. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] AC-5.1-003 Behavior contract in Section 4 satisfied on Monaco implementation. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 5.2 Backend APIs
- [x] [P0] AC-5.2-001 Session/capability APIs available: `/api/ide/capabilities`, `/api/ide/session`. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] AC-5.2-002 Workspace/file-system APIs available: `/api/ide/tree`, `/api/ide/fs/*`. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] AC-5.2-003 Document IO APIs available: `/api/ide/file`, `/api/ide/files`. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] AC-5.2-004 Language APIs available: `/api/ide/diagnostics`, `/api/ide/hover`, `/api/ide/completion`, `/api/ide/definition`, `/api/ide/references`, `/api/ide/rename`. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] AC-5.2-005 Health/telemetry API available: `/api/ide/health`. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] AC-5.2-006 Any legacy endpoints map cleanly to this contract. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

### 5.3 Concurrency Model
- [x] [P0] AC-5.3-001 Writes enforce optimistic concurrency (`expected_version` or equivalent). [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] AC-5.3-002 FS mutations reject stale operations with actionable conflicts. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

## 6. Definition of Done (Spec Section 6)
- [x] [P0] DOD-001 Directory tree browse/open/edit lifecycle complete. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] DOD-002 Language intelligence reliable across project files. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] DOD-003 Build/test workflows run from IDE with clear output. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] DOD-004 Save/recovery/conflict flows validated. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] DOD-005 Accessibility and performance gates pass on reference hardware. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] DOD-006 This release checklist fully green. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

## 7. Validation Gates (Spec Section 7)
- [x] [P1] VG-001 `just fmt` passes. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] VG-002 `just clippy` passes. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] VG-003 `just test` passes. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] VG-004 Web IDE integration suite (API + frontend contract) passes. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] VG-005 Web IDE performance gate suite passes. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P1] VG-006 Web IDE accessibility validation passes. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)

## 8. Evidence Register
- [x] [P0] EV-001 Evidence artifact created and maintained: `docs/internal/testing/evidence/web-ide-full-checklist-evidence-<date>.md`. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
- [x] [P0] EV-002 Each `[x]` item in this file references concrete command output and/or artifact path. [Evidence](docs/internal/testing/evidence/web-ide-full-checklist-evidence-2026-02-15.md)
