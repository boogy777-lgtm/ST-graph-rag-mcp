#!/usr/bin/env bash
set -euo pipefail

export ST_LSP_PERF_EDIT_LOOP_ITERS="${ST_LSP_PERF_EDIT_LOOP_ITERS:-120}"
export ST_LSP_PERF_EDIT_LOOP_AVG_MS="${ST_LSP_PERF_EDIT_LOOP_AVG_MS:-80}"
export ST_LSP_PERF_EDIT_LOOP_P95_MS="${ST_LSP_PERF_EDIT_LOOP_P95_MS:-140}"
export ST_LSP_PERF_EDIT_LOOP_CPU_MS="${ST_LSP_PERF_EDIT_LOOP_CPU_MS:-70}"
export SALSA_SPIKE_SAMPLES="${SALSA_SPIKE_SAMPLES:-3}"

echo "[salsa-spike-gate] behavior-lock tests"
cargo test -p trust-hir file_symbols_reuses_unchanged_file_across_unrelated_edit -- --nocapture
cargo test -p trust-hir file_symbols_recomputes_when_its_file_changes -- --nocapture

echo "[salsa-spike-gate] perf gate (edit-loop latency + CPU, salsa-only)"
perf_log="$(mktemp)"
cleanup() {
  rm -f "$perf_log"
}
trap cleanup EXIT

if ! [[ "$SALSA_SPIKE_SAMPLES" =~ ^[1-9][0-9]*$ ]]; then
  echo "[salsa-spike-gate] FAIL: SALSA_SPIKE_SAMPLES must be a positive integer"
  exit 1
fi

: > "$perf_log"
for sample in $(seq 1 "$SALSA_SPIKE_SAMPLES"); do
  echo "[salsa-spike-gate] perf sample ${sample}/${SALSA_SPIKE_SAMPLES} backend=salsa"
  cargo test -p trust-lsp perf_edit_loop_budget -- --ignored --nocapture | tee -a "$perf_log"
done

extract_metric_series() {
  local file="$1"
  local key="$2"
  grep -Eo "${key}=[0-9]+(\\.[0-9]+)?" "$file" | cut -d '=' -f 2
}

metric_median() {
  local file="$1"
  local key="$2"
  extract_metric_series "$file" "$key" | sort -n | awk '
    { values[++n] = $1 }
    END {
      if (n == 0) {
        exit 2
      }
      if (n % 2 == 1) {
        print values[(n + 1) / 2]
      } else {
        printf "%.2f\n", (values[n / 2] + values[n / 2 + 1]) / 2
      }
    }
  '
}

metric_list() {
  local file="$1"
  local key="$2"
  extract_metric_series "$file" "$key" | paste -sd',' -
}

avg_median="$(metric_median "$perf_log" "avg_ms")"
p95_median="$(metric_median "$perf_log" "p95_ms")"
cpu_median="$(metric_median "$perf_log" "cpu_ms_per_iter")"

avg_samples="$(metric_list "$perf_log" "avg_ms")"
p95_samples="$(metric_list "$perf_log" "p95_ms")"
cpu_samples="$(metric_list "$perf_log" "cpu_ms_per_iter")"

echo "[salsa-spike-gate] salsa avg_samples=[${avg_samples}] p95_samples=[${p95_samples}] cpu_samples=[${cpu_samples}]"
echo "[salsa-spike-gate] salsa medians avg=${avg_median}ms p95=${p95_median}ms cpu=${cpu_median}ms/op"

echo "[salsa-spike-gate] PASS"
