# Web IDE Frontend Bundle Workspace

Purpose:
- Build local editor runtime assets for `/ide/assets/*`.

Current output:
- `crates/trust-runtime/src/web/ui/assets/ide-codemirror.20260215.js`
- `crates/trust-runtime/src/web/ui/assets/ide-monaco.20260215.js`
- `crates/trust-runtime/src/web/ui/assets/ide-monaco.20260215.css`

Build:
```bash
cd crates/trust-runtime/web/ide-frontend
npm install
npm run build
npm run build:monaco
```

Notes:
- This workspace bundles editor assets for runtime-local delivery (CodeMirror legacy + Monaco product path).
- `/ide` must not depend on external CDN module hosts.
