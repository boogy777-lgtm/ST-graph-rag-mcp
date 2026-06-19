#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

cargo test -p trust-wasm-analysis --test mp010_parity diagnostics_parity_matches_native_analysis
cargo test -p trust-wasm-analysis --test mp010_parity hover_and_completion_parity_matches_native_analysis
cargo test -p trust-wasm-analysis --test mp010_parity wasm_json_adapter_contract_is_stable
cargo test -p trust-wasm-analysis --test mp010_parity browser_host_smoke_apply_documents_then_diagnostics_round_trip
cargo test -p trust-wasm-analysis --test mp010_parity multi_document_incremental_update_flow_handles_realistic_edit_streams
cargo test -p trust-wasm-analysis --test mp010_parity representative_corpus_memory_budget_gate
cargo test -p trust-wasm-analysis --test mp010_parity browser_analysis_latency_budget_against_native_is_within_spike_limits -- --nocapture

if command -v rustup >/dev/null 2>&1 && rustup target list --installed | grep -q '^wasm32-unknown-unknown$'; then
  cargo build -p trust-wasm-analysis --target wasm32-unknown-unknown --features wasm
else
  echo "warning: skipped wasm32 build; target wasm32-unknown-unknown is not installed."
  echo "install: rustup target add wasm32-unknown-unknown"
fi

echo "MP-010 browser analysis spike check passed."
