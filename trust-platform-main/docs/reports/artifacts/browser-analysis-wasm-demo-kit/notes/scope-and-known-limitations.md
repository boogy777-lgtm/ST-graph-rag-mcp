# Scope and Known Limitations

## Scope shown in demo

- Browser worker + WASM static analysis for Structured Text:
  - diagnostics
  - hover
  - completion
- Request lifecycle:
  - request IDs
  - timeout behavior
  - cancellation envelope

## Explicit non-goals for this demo

- Runtime execution architecture comparison (bytecode vs native runtime).
- Browser runtime/debug stepping.
- Deploy/control operations.

## Current limitations

- Cancellation is cooperative (result suppression), not mid-analysis preemption.
- Host/editor provides document content directly (no browser filesystem walk).
- Full LSP parity surface is not part of this phase.

## Next-step timeline (pitch plan)

- 2026-02 to 2026-03:
  - stabilize OpenPLC-shell integration and collect partner UX feedback.
- 2026-03 to 2026-04:
  - add worker recovery policy and browser-host smoke gate in CI.
- 2026-04 to 2026-05:
  - expand editor surface toward full web-IDE UX (file tree, tabs, inline markers).
