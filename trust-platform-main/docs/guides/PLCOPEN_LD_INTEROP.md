# PLCopen LD Interop Guide (Schema v2)

This guide documents the Ladder Diagram (LD) PLCopen interop profile implemented for
schema v2 ladder programs.

## Scope

Implemented profile:

- Import PLCopen LD network bodies into `.ladder.json` schema v2 (`networks[]`, `nodes[]`, `edges[]`).
- Export schema v2 ladder networks back into PLCopen LD network bodies.
- Deterministic diagnostics for unsupported or malformed constructs.

Implementation entry points:

- `editors/vscode/src/ladder/plcopenLdInterop.ts`
  - `importPlcopenLdToSchemaV2(xml)`
  - `exportSchemaV2ToPlcopenLd(program, pouName?)`

## Supported Node Constructs

- `contact` (`NO`, `NC`)
- `coil` (`NORMAL`, `SET`, `RESET`, `NEGATED`)
- `timer` (`TON`, `TOF`, `TP`)
- `counter` (`CTU`, `CTD`, `CTUD` profile)
- `compare` (`GT`, `LT`, `EQ`)
- `math` (`ADD`, `SUB`, `MUL`, `DIV`)
- Topology nodes: `branchSplit`, `branchMerge`, `junction`
- `edge` links with optional routed `points`

## Diagnostics Contract

Import diagnostics are deterministic and include:

- Unsupported constructs (for example unknown graphical tags)
- Malformed nodes (missing required attributes)
- Malformed edges (`from`/`to` missing)
- Empty LD payload (`No <network> LD bodies found...`)

Unsupported constructs are skipped, not silently accepted.

## Validation Coverage

Automated tests:

- `editors/vscode/src/test/suite/plcopen-ld-interop.test.ts`
  - Export/import roundtrip coverage
  - Unsupported construct diagnostics
  - Malformed payload diagnostics

## Notes

- This is a supported LD interop subset for schema v2 workflows.
- Vendor-specific graphical metadata outside this subset is currently reported as unsupported.
- Known profile constraints are tracked in `docs/IEC_DEVIATIONS.md`.
