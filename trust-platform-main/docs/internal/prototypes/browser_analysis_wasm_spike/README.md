# Browser Analysis WASM Spike (Internal Prototype)

This directory contains prototype browser host assets for Deliverable 10.

It is intentionally kept outside `examples/` because it targets internal spike
validation, not end-user tutorial workflows.

Current host shell is aligned to runtime web UI styling (logo, palette, sidebar/topbar structure, and dark/light toggle) while wiring browser-only WASM analysis interactions.

## Files

- `web/index.html`
- `web/main.js`
- `web/worker.js`
- `web/analysis-client.js`
- `web/openplc-shell.html`
- `web/openplc-shell.js`
- `npm/trust-wasm-analysis-client/` (prototype publishable wrapper package)

## Build and Run

```bash
scripts/run_browser_analysis_wasm_spike_demo.sh
```

Open `http://127.0.0.1:4173/web/`.
OpenPLC shell integration mock:
`http://127.0.0.1:4173/web/openplc-shell.html`.
