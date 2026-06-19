# PLCopen Export Adapters v1 (Deliverable 7)

This guide defines the Deliverable 7 adapter baseline for generating
vendor-targeted PLCopen interchange artifacts from one ST source project.

## Command Surface

```bash
trust-runtime plcopen export --project <project-dir> --target <generic|ab|siemens|schneider>
trust-runtime plcopen export --project <project-dir> --target <target> --json
```

- `generic`: existing ST-complete PLCopen export behavior.
- `ab`: Allen-Bradley / Studio 5000 migration adapter.
- `siemens`: Siemens TIA Portal migration adapter.
- `schneider`: Schneider EcoStruxure migration adapter.

## Generated Artifacts

For vendor targets (`ab`, `siemens`, `schneider`), export writes:

- Target XML:
  - `interop/plcopen.ab.xml`
  - `interop/plcopen.siemens.xml`
  - `interop/plcopen.schneider.xml`
- Source map sidecar:
  - `<output>.source-map.json`
- Adapter report sidecar:
  - `<output>.adapter-report.json`
- Siemens target only (`--target siemens`):
  - Siemens SCL source bundle directory:
    - `<output>.scl/`
  - Includes generated `.scl` source files ready for TIA External source import.

JSON report fields (export):

- `target`
- `adapter_report_path`
- `siemens_scl_bundle_dir` (Siemens target only)
- `siemens_scl_files[]` (Siemens target only)
- `adapter_diagnostics[]`
- `adapter_manual_steps[]`
- `adapter_limitations[]`

## Target Validation Diagnostics

Adapter diagnostics are deterministic migration guidance checks, including:

- Scheduling model checks (`CONFIGURATION` / `RESOURCE` / `TASK` / `PROGRAM` bindings).
- Direct address marker checks (`%I`, `%Q`, `%M`).
- Retentive-state usage checks (`RETAIN`).
- Cross-vendor alias checks where detected.

These diagnostics are advisory migration evidence, not semantic-equivalence proof.

## Manual Steps by Target

### Allen-Bradley (`ab`)

1. Import PLCopen artifact through your AB migration toolchain.
2. Recreate task classes and bind routines in Studio 5000.
3. Rebind `%I/%Q/%M` markers to controller tags/I/O aliases.
4. Verify retentive and startup behavior on target hardware.

### Siemens (`siemens`)

1. Import generated `.scl` sources from `<output>.scl/` via TIA Portal:
   External source files -> Add new external file.
2. Generate blocks from imported source files.
3. Map tasks/program instances to OB scheduling in TIA Portal.
4. Reconcile marker/address mapping with hardware configuration.
5. Validate migrated behavior with runtime/conformance tests.

### Schneider (`schneider`)

1. Import PLCopen artifact through EcoStruxure/CODESYS interchange tooling.
2. Rebuild task scheduling and program assignment explicitly.
3. Rebind address markers and persistence settings.
4. Validate migrated behavior with runtime/conformance tests.

## Explicit Limitations (v1)

- No native vendor package generation (`.L5X`, TIA project archives, EcoStruxure archives).
- No automatic import of hardware topology/device trees/safety metadata.
- No semantic equivalence guarantees for vendor AOI/library internals.
- ST-only contract remains in effect (no FBD/LD/SFC semantics).

## Siemens Tutorial

For a full step-by-step Siemens flow (command + TIA UI path), see:

- `docs/guides/SIEMENS_TIA_SCL_IMPORT_TUTORIAL.md`
