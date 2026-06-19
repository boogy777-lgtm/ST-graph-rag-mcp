# Browser Analysis WASM Demo Artifact Pack

Use this folder as the shareable partner/demo package for browser analysis.

## Required contents

- `screenshots/`
  - `01-live-hover.png`
  - `02-theme-toggle.png`
  - `03-live-diagnostics.png`
  - `04-live-completion.png`
  - `05-openplc-shell-integration.png`
- `recording/`
  - `browser-analysis-demo.mp4` (2-5 minutes)
- `notes/`
  - `scope-and-known-limitations.md`
  - `demo-environment.md` (OS, browser version, commit hash)

## Capture commands

Build + run:

```bash
cd /home/johannes/projects/trust-platform
scripts/run_browser_analysis_wasm_spike_demo.sh
```

Open:

```text
http://127.0.0.1:4173/web/
```

OpenPLC integration view:

```text
http://127.0.0.1:4173/web/openplc-shell.html
```

Demo script:

```text
docs/guides/BROWSER_ANALYSIS_WASM_DEMO_SCRIPT.md
```

Stamp environment metadata before capture:

```bash
scripts/update_browser_analysis_demo_artifact_metadata.sh
```

## Notes template (`notes/scope-and-known-limitations.md`)

- In scope:
  - diagnostics/hover/completion in browser worker (WASM).
- Out of scope:
  - runtime execution architecture changes.
  - browser debug adapter/runtime stepping.
- Current constraints:
  - cooperative cancellation.
  - host-provided documents (no filesystem walk).
