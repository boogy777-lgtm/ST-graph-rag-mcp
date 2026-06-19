# LD Runtime Right Pane Parity Validation (2026-02-27)

## Scope

Validate that Ladder runtime controls in the right pane match ST runtime panel behavior
for runtime control semantics and layout, while keeping Ladder editing tools available in
the same right-side area.

## Environment

- Repository: `/home/johannes/projects/trust-platform-merge-run`
- VS Code extension dev host
- Files reviewed:
  - `examples/ladder/simple-start-stop.ladder.json`
  - ST runtime panel implementation in `editors/vscode/src/visual/runtime/webview/StRuntimePanel.tsx`
  - Ladder embedding in `editors/vscode/src/ladder/webview/LadderEditor.tsx`

## Reproduction Command

```bash
code --new-window --extensionDevelopmentPath=editors/vscode . examples/ladder/simple-start-stop.ladder.json
```

## Validation Steps

1. Open ladder file using the Ladder Logic custom editor.
2. Confirm right-pane default view is `I/O`.
3. Compare `I/O` and `Settings` views against ST runtime panel behavior:
   - mode toggle (`Local`/`External`)
   - start/stop control
   - runtime status pill and status text
   - filter + I/O tree with write/force/release actions
   - settings form and save/close behavior
4. Confirm `Tools` tab exposes Ladder element/rung/edit actions without a top toolbar.
5. Resize right pane and confirm width persistence behavior.

## Evidence

- Shared ST runtime panel embed:
  - `editors/vscode/src/ladder/webview/LadderEditor.tsx` uses `StRuntimePanel` for `I/O` and `Settings`.
- Right pane tabs and default behavior:
  - `I/O`, `Settings`, `Tools` tabs in `LadderEditor.tsx`.
- Shared runtime contract and message schema:
  - `editors/vscode/src/visual/runtime/runtimeController.ts`
  - `editors/vscode/src/visual/runtime/runtimeMessages.ts`
  - `editors/vscode/src/visual/runtime/runtimePanelBridge.ts`
- Automated contract coverage:
  - `editors/vscode/src/test/suite/visual-runtime-controller.test.ts`
  - `editors/vscode/src/test/suite/visual-runtime-panel-bridge.test.ts`
  - `editors/vscode/src/test/suite/visual-right-pane-resize.test.ts`

## Result

- Parity status: **PASS**
- Runtime control semantics and right-pane runtime views match ST panel behavior.
- Ladder tools are accessible through the right-pane `Tools` view without reintroducing the removed top toolbar.

## Work Item

- ID: `LD-RIGHT-PANE-PARITY-2026-02-27`
- State: `Closed`
- Open parity gaps: `None`

If future parity drift is detected, reopen this work item and add a follow-up checklist entry.
