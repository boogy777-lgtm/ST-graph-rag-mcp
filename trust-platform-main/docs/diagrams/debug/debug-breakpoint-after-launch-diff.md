# Breakpoint/Pause After Launch: Intended vs Observed

Scope: `examples/filling_line`, sequence reproduced from `/tmp/trust-debug-dap.log`.

## Intent (reference)
- `docs/diagrams/debug/debug-breakpoint-after-launch-intended.puml`
- Existing high-level refs:
  - `docs/diagrams/debug/debug-step-sequence.puml`
  - `docs/diagrams/debug/debug-state-machine.puml`

## Observed behavior
- `docs/diagrams/debug/debug-breakpoint-after-launch-actual-observed.puml`

## Concrete divergence
1. `setBreakpoints` path is healthy.
   - Breakpoint is verified and resolved at `Main.st:14`.
2. `pause` command is accepted and applied in runtime state.
   - Trace shows `action=Pause(None) outcome=Applied mode=Running->Paused`.
3. Missing transition:
   - No subsequent `DebugStop` emission (`Breakpoint` or `Pause`).
   - No `stopped` DAP event emitted.
   - No `[trust-debug][stop] action=...` coordinator traces.

## Where the flow appears to break
Expected handoff:
- `DebugControl::apply_action(Pause)` -> next `on_statement_inner()` boundary ->
  `emit_stop(...)` -> `StopCoordinator` -> DAP `stopped`.

Observed:
- `apply_action(Pause)` happens.
- No evidence of `emit_stop(...)` afterward.

## Practical implication
The adapter/session handshake is not the failing part for this scenario.
The failing segment is the runtime stop production path after control state has already switched to `Paused`.
