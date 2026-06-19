#!/usr/bin/env bash
set -euo pipefail

ALLOWLIST=(
  "db::queries::database::tests::set_source_text_same_content_keeps_source_revision"
  "db::queries::database::tests::remove_missing_source_keeps_source_revision"
  "db::queries::database::tests::expr_id_at_offset_returns_none_for_missing_file"
)

DENYLIST=(
  "db::queries::database::tests::concurrent_edit_and_query_loops_do_not_panic"
  "db::queries::database::tests::cancellation_requests_keep_queries_stable"
)

# NOTE:
# Parser-touching trust-hir tests currently trip a Miri UB signal inside
# rowan 0.15 internals on this toolchain. Keep the default allowlist focused
# on Salsa state ownership/revision invariants until upstream parser-path UB
# coverage is explicitly unblocked.

if [[ -n "${SALSA_MIRI_ALLOWLIST:-}" ]]; then
  IFS=',' read -r -a ALLOWLIST <<< "${SALSA_MIRI_ALLOWLIST}"
fi
if [[ -n "${SALSA_MIRI_DENYLIST:-}" ]]; then
  IFS=',' read -r -a DENYLIST <<< "${SALSA_MIRI_DENYLIST}"
fi

if ! command -v cargo >/dev/null; then
  echo "[salsa-miri] FAIL: cargo not found"
  exit 1
fi

echo "[salsa-miri] allowlist (${#ALLOWLIST[@]}):"
for test_name in "${ALLOWLIST[@]}"; do
  echo "  - ${test_name}"
done

echo "[salsa-miri] denylist (${#DENYLIST[@]}):"
for test_name in "${DENYLIST[@]}"; do
  echo "  - ${test_name}"
done

if ! cargo +nightly miri --version >/dev/null 2>&1; then
  echo "[salsa-miri] FAIL: miri component not available (run 'rustup component add miri --toolchain nightly')"
  exit 1
fi

echo "[salsa-miri] setting up sysroot"
cargo +nightly miri setup >/dev/null

is_denylisted() {
  local candidate="$1"
  local entry
  for entry in "${DENYLIST[@]}"; do
    entry="$(echo "$entry" | xargs)"
    if [[ -n "$entry" && "$entry" == "$candidate" ]]; then
      return 0
    fi
  done
  return 1
}

for test_name in "${ALLOWLIST[@]}"; do
  test_name="$(echo "$test_name" | xargs)"
  if [[ -z "$test_name" ]]; then
    continue
  fi
  if is_denylisted "$test_name"; then
    echo "[salsa-miri] skip denylisted test ${test_name}"
    continue
  fi
  echo "[salsa-miri] running ${test_name}"
  cargo +nightly miri test -p trust-hir --lib -- "${test_name}"
done

echo "[salsa-miri] PASS"
