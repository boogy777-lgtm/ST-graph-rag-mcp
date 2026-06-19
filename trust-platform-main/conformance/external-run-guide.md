# External Conformance Run Guide

This guide describes how to run the same conformance suite against another
runtime/tool and submit comparable results.

## What To Reuse

Use these versioned artifacts directly:

- `conformance/cases/`
- `conformance/naming.md`
- `conformance/contract.md`
- `conformance/schemas/summary-v1.schema.json`

Expected artifacts in `conformance/expected/` define `trust-runtime` baseline
behavior for this suite revision.

## Adapter Workflow

1. Implement an adapter that can:
   - read each `manifest.toml` and `program.st`
   - execute cycles and restart directives deterministically
   - capture watched globals/direct addresses per cycle
2. Emit per-case actual artifacts compatible with conformance contract.
3. Emit one summary JSON file compatible with
   `conformance/schemas/summary-v1.schema.json`.

## Minimum Output Contract

Your summary JSON must include:

- `version = 1`
- `profile = "trust-conformance-v1"`
- deterministic `results` ordering by `case_id` ascending
- `status` per case (`passed`, `failed`, `error`, `skipped`)
- failure `reason.code` from taxonomy in `conformance/failure-taxonomy.md`

## Comparison Strategy

- Compare your per-case artifacts to the baseline expected artifacts:
  `conformance/expected/<category>/<case_id>.json`
- Record mismatches as `failed`.
- Record adapter/runtime execution failures as `error`.

## Validation

Validate your summary against the schema:

```bash
jq empty your-summary.json
```

Use any JSON Schema validator to verify
`conformance/schemas/summary-v1.schema.json` compatibility.

## Submit Results

Follow `conformance/submissions.md`.
