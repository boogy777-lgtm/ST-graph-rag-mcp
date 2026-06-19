# Conformance Suite MVP (Deliverable 1)

This directory defines the deterministic conformance suite contract for
`trust-platform` and external runtime/tool comparisons.

Week-1 scope in `docs/internal/community-request-roadmap.md` is implemented
here:

- conformance scope is defined
- MVP test categories are frozen
- pass/fail summary contract format is defined
- naming rules are defined

## Frozen MVP Categories

The Deliverable 1 MVP categories are fixed to:

1. `timers`
2. `edges`
3. `scan_cycle`
4. `init_reset`
5. `arithmetic`
6. `memory_map`

No additional category is added to MVP without updating this README and the
contract docs in the same change.

## Repository Layout

```text
conformance/
  README.md
  contract.md
  naming.md
  schemas/
    summary-v1.schema.json
  cases/
    <category>/
      <case_id>/
        program.st
        manifest.toml
  expected/
    <category>/
      <case_id>.json
  reports/
    <generated summaries>
```

## Determinism Contract (MVP)

- Case execution order is lexicographic by `case_id`.
- Inputs and expected outputs are versioned in-repo.
- A case only passes when observed results match expected artifacts exactly.
- Output summaries must comply with `conformance/schemas/summary-v1.schema.json`.

## Documents

- Contract: `conformance/contract.md`
- Naming rules: `conformance/naming.md`
- Summary schema: `conformance/schemas/summary-v1.schema.json`
- Failure taxonomy: `conformance/failure-taxonomy.md`
- External run guide: `conformance/external-run-guide.md`
- Known gaps: `conformance/known-gaps.md`
- External submission process: `conformance/submissions.md`

## Running The Suite

Generate or refresh expected artifacts:

```bash
trust-runtime conformance --suite-root conformance --update-expected
```

Run verification against versioned expected artifacts:

```bash
trust-runtime conformance --suite-root conformance
```

Optional output override:

```bash
trust-runtime conformance --suite-root conformance --output conformance/reports/local-summary.json
```

Runner exits non-zero when any case is `failed` or `error`.

CI gate uses repeated runs and normalized summary comparison to verify
deterministic ordering/status behavior.
