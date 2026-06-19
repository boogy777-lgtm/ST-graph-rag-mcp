#!/usr/bin/env bash
set -euo pipefail

MODE="nightly"
CONTINUE_ON_FAIL=0
DRY_RUN=0
RUN_CLIPPY=1
RUN_TESTS=1
RECORD_IF_MISSING_BASELINES=1
LOG_DIR=""
NIGHTLY_FUZZ_EXTENDED_SECONDS_DEFAULT=28800

usage() {
  cat <<'EOF'
Usage: scripts/salsa_overnight_hardening.sh [options]

Runs Salsa hardening gates sequentially and writes per-step logs + summary.

Options:
  --mode nightly|smoke        Run profile (default: nightly)
  --continue-on-fail          Run all steps and report failures at the end
  --fail-fast                 Stop at first failure (default)
  --skip-clippy               Skip clippy step
  --skip-tests                Skip test steps
  --record-if-missing         Record perf/memory baselines when missing (default)
  --no-record-if-missing      Do not auto-record missing baselines
  --log-dir <dir>             Log directory (default: logs/salsa-overnight-<timestamp>)
  --dry-run                   Print commands without executing them
  -h, --help                  Show this help

Environment variables used by underlying gates:
  SALSA_HARDENING_BASELINE_FILE
  SALSA_MEMORY_BASELINE_FILE
  SALSA_FUZZ_SMOKE_SECONDS
  SALSA_FUZZ_EXTENDED_SECONDS
  SALSA_FUZZ_RSS_LIMIT_MB

Notes:
  In --mode nightly, fuzz extended defaults to 8h (28800s) unless
  SALSA_FUZZ_EXTENDED_SECONDS is explicitly set.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --continue-on-fail)
      CONTINUE_ON_FAIL=1
      shift
      ;;
    --fail-fast)
      CONTINUE_ON_FAIL=0
      shift
      ;;
    --skip-clippy)
      RUN_CLIPPY=0
      shift
      ;;
    --skip-tests)
      RUN_TESTS=0
      shift
      ;;
    --record-if-missing)
      RECORD_IF_MISSING_BASELINES=1
      shift
      ;;
    --no-record-if-missing)
      RECORD_IF_MISSING_BASELINES=0
      shift
      ;;
    --log-dir)
      LOG_DIR="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 2
      ;;
  esac
done

if [[ "$MODE" != "nightly" && "$MODE" != "smoke" ]]; then
  echo "Invalid --mode '${MODE}', expected nightly|smoke"
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "$LOG_DIR" ]]; then
  LOG_DIR="logs/salsa-overnight-$(date -u +%Y%m%dT%H%M%SZ)"
fi
mkdir -p "$LOG_DIR"
SUMMARY_FILE="${LOG_DIR}/summary.log"

PERF_BASELINE_FILE="${SALSA_HARDENING_BASELINE_FILE:-docs/reports/salsa-hardening-perf-baseline.env}"
MEM_BASELINE_FILE="${SALSA_MEMORY_BASELINE_FILE:-docs/reports/salsa-memory-baseline.env}"
NIGHTLY_FUZZ_EXTENDED_SECONDS="${SALSA_FUZZ_EXTENDED_SECONDS:-$NIGHTLY_FUZZ_EXTENDED_SECONDS_DEFAULT}"

declare -a STEP_NAMES=()
declare -a STEP_CMDS=()
declare -a STEP_STATUS=()
declare -a STEP_DURATION=()

add_step() {
  STEP_NAMES+=("$1")
  STEP_CMDS+=("$2")
}

log() {
  local line="$1"
  echo "$line" | tee -a "$SUMMARY_FILE"
}

safe_name() {
  echo "$1" | tr '[:space:]/:' '___' | sed -E 's/[^A-Za-z0-9_.-]+//g'
}

run_step() {
  local idx="$1"
  local name="${STEP_NAMES[$idx]}"
  local cmd="${STEP_CMDS[$idx]}"
  local log_file="${LOG_DIR}/$(printf "%02d" "$((idx + 1))")-$(safe_name "$name").log"
  local start_ts end_ts duration status

  log ""
  log "=== STEP $((idx + 1))/${#STEP_NAMES[@]}: ${name} ==="
  log "CMD: ${cmd}"
  log "LOG: ${log_file}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    STEP_STATUS[$idx]=0
    STEP_DURATION[$idx]=0
    log "RESULT: DRY-RUN"
    return 0
  fi

  start_ts="$(date +%s)"
  set +e
  /usr/bin/env bash -lc "$cmd" > >(tee "$log_file") 2>&1
  status=$?
  set -e
  end_ts="$(date +%s)"
  duration=$((end_ts - start_ts))

  STEP_STATUS[$idx]="$status"
  STEP_DURATION[$idx]="$duration"

  if [[ "$status" -eq 0 ]]; then
    log "RESULT: PASS (${duration}s)"
    return 0
  fi

  log "RESULT: FAIL (${duration}s, exit=${status})"
  return "$status"
}

add_step "Rust fmt check" "cargo fmt --all --check"
if [[ "$RUN_CLIPPY" -eq 1 ]]; then
  add_step "Clippy deny warnings (trust-hir + trust-lsp)" "cargo clippy -p trust-hir -p trust-lsp -- -D warnings"
fi
if [[ "$RUN_TESTS" -eq 1 ]]; then
  add_step "trust-hir tests" "cargo test -p trust-hir"
  add_step "trust-lsp tests" "cargo test -p trust-lsp --tests"
fi

if [[ "$RECORD_IF_MISSING_BASELINES" -eq 1 && ! -f "$PERF_BASELINE_FILE" ]]; then
  add_step "Record missing perf baseline" "./scripts/salsa_hardening_perf_gate.sh record"
fi
add_step "Perf gate compare" "./scripts/salsa_hardening_perf_gate.sh compare"

if [[ "$RECORD_IF_MISSING_BASELINES" -eq 1 && ! -f "$MEM_BASELINE_FILE" ]]; then
  add_step "Record missing memory baseline" "./scripts/salsa_memory_gate.sh record"
fi
add_step "Memory gate compare" "./scripts/salsa_memory_gate.sh compare"

add_step "Miri gate" "./scripts/salsa_miri_gate.sh"
add_step "Fuzz smoke gate" "./scripts/salsa_fuzz_gate.sh smoke"
if [[ "$MODE" == "nightly" ]]; then
  add_step \
    "Fuzz extended gate (${NIGHTLY_FUZZ_EXTENDED_SECONDS}s)" \
    "SALSA_FUZZ_EXTENDED_SECONDS=${NIGHTLY_FUZZ_EXTENDED_SECONDS} ./scripts/salsa_fuzz_gate.sh extended"
fi

log "Salsa overnight hardening run started at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "Mode=${MODE} continue_on_fail=${CONTINUE_ON_FAIL} dry_run=${DRY_RUN} log_dir=${LOG_DIR}"
log "Perf baseline=${PERF_BASELINE_FILE} Memory baseline=${MEM_BASELINE_FILE}"
if [[ "$MODE" == "nightly" ]]; then
  log "Nightly fuzz extended seconds=${NIGHTLY_FUZZ_EXTENDED_SECONDS}"
fi

failed=0
for i in "${!STEP_NAMES[@]}"; do
  if ! run_step "$i"; then
    failed=1
    if [[ "$CONTINUE_ON_FAIL" -eq 0 ]]; then
      break
    fi
  fi
done

log ""
log "=== SUMMARY ==="
for i in "${!STEP_NAMES[@]}"; do
  status="${STEP_STATUS[$i]:-125}"
  duration="${STEP_DURATION[$i]:-0}"
  if [[ "$status" -eq 0 ]]; then
    log "[PASS] ${STEP_NAMES[$i]} (${duration}s)"
  else
    log "[FAIL] ${STEP_NAMES[$i]} (${duration}s, exit=${status})"
  fi
done

if [[ "$failed" -ne 0 ]]; then
  log "OVERALL: FAIL"
  exit 1
fi

log "OVERALL: PASS"
