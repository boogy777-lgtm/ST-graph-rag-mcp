# @trust/wasm-analysis-client (Prototype)

Thin browser wrapper around the `trust-wasm-analysis` worker protocol.

Status:
- Prototype package for partner integration spikes.
- Intended for browser-hosted editors (for example OpenPLC-style web shells).

## Usage

```js
import { TrustWasmAnalysisClient } from "@trust/wasm-analysis-client";

const client = new TrustWasmAnalysisClient({ workerUrl: "/worker.js" });
await client.ready();

await client.applyDocuments([
  { uri: "memory:///main.st", text: "PROGRAM Main\nEND_PROGRAM\n" },
]);

const diagnostics = await client.diagnostics("memory:///main.st");
console.log(diagnostics);
```

## Worker Contract

The client expects a worker implementing these methods:
- `applyDocuments`
- `diagnostics`
- `hover`
- `completion`
- `status`
- `cancel` (by request id)

See:
- `docs/guides/BROWSER_ANALYSIS_WASM_INTEGRATION_BRIEF.md`
- `docs/guides/BROWSER_ANALYSIS_WASM_OPENPLC_EVENT_MAPPING.md`
