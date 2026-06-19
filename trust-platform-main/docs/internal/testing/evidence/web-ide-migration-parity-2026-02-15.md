# Web IDE Migration Parity Evidence (2026-02-15)

Scope:
- Product `/ide` path in `trust-runtime`.
- Migration from CDN-loaded inline CodeMirror modules to local bundled assets.

## Baseline Behaviors (captured)
- File tree + source open flow (`/api/ide/files`, `/api/ide/file`)
- Tab switching + dirty markers
- Save + autosave with conflict-safe writes (`expected_version`)
- Diagnostics, hover, completion panels
- Keyboard shortcuts (`Ctrl/Cmd+S`, `Ctrl/Cmd+Shift+P`, tab cycling)
- Light/dark theme toggle
- Offline badge + local draft persistence

## Product Path Validation
- IDE shell references local bundled editor asset:
  - `/ide/assets/ide-codemirror.20260215.js`
- Runtime no longer requires `esm.sh` for core editor modules.
- Frontend contract check:
  - `python3 scripts/check_web_ide_frontend_contract.py`

## Automated Evidence
- `cargo test -p trust-runtime --test web_ide_integration web_ide_shell_serves_local_hashed_assets_without_cdn_dependency -- --exact`
- `cargo test -p trust-runtime --test web_ide_integration web_ide_analysis_and_health_endpoints_contract -- --exact`
- `cargo test -p trust-runtime --test web_ide_integration web_ide_collaborative_conflict_contract -- --exact`

Result:
- Parity gate passes for baseline authoring behaviors before legacy CDN path removal.
