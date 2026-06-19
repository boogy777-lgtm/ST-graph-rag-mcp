#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

cargo test -p trust-wasm-analysis --test mp010_parity browser_host_smoke_apply_documents_then_diagnostics_round_trip

echo "Browser analysis host smoke passed."
