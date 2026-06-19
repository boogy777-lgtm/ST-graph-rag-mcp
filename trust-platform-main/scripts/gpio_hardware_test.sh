#!/usr/bin/env bash
set -euo pipefail

ST_RUNTIME="${ST_RUNTIME:-trust-runtime}"
PROJECT="${1:-docs/internal/testing/bundles/pi-gpio}"
CHECK_INPUT="${CHECK_INPUT:-false}"
INTERVAL_SEC="${INTERVAL_SEC:-1}"
OUT="${OUT:-gpio-hardware-$(date +%Y%m%d_%H%M%S).log}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this test. Install jq and retry."
  exit 1
fi

echo "Starting runtime for GPIO test..."
"$ST_RUNTIME" play --project "$PROJECT" >"${OUT}.runtime.log" 2>&1 &
PID=$!

cleanup() {
  "$ST_RUNTIME" ctl --project "$PROJECT" shutdown >/dev/null 2>&1 || true
  kill "$PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Waiting for runtime..."
for _ in {1..20}; do
  if "$ST_RUNTIME" ctl --project "$PROJECT" status >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

read_value() {
  local area="$1"
  local address="$2"
  "$ST_RUNTIME" ctl --project "$PROJECT" io-read \
    | jq -r --arg addr "$address" ".result.snapshot.${area}[] | select(.address==\$addr) | .value" \
    | head -n1
}

is_true() { [[ "${1,,}" == *"true"* ]]; }
is_false() { [[ "${1,,}" == *"false"* ]]; }

echo "Writing output TRUE..."
"$ST_RUNTIME" ctl --project "$PROJECT" io-write "%QX0.0" TRUE >/dev/null
sleep "$INTERVAL_SEC"
out_val="$(read_value outputs "%QX0.0")"
echo "Output value: $out_val"
if ! is_true "$out_val"; then
  echo "Expected output TRUE. Got: $out_val"
  exit 1
fi
if [[ "$CHECK_INPUT" == "true" ]]; then
  in_val="$(read_value inputs "%IX0.0")"
  echo "Input value: $in_val"
  if ! is_true "$in_val"; then
    echo "Expected input TRUE (check wiring between GPIO27 and GPIO17)."
    exit 1
  fi
fi

echo "Writing output FALSE..."
"$ST_RUNTIME" ctl --project "$PROJECT" io-write "%QX0.0" FALSE >/dev/null
sleep "$INTERVAL_SEC"
out_val="$(read_value outputs "%QX0.0")"
echo "Output value: $out_val"
if ! is_false "$out_val"; then
  echo "Expected output FALSE. Got: $out_val"
  exit 1
fi
if [[ "$CHECK_INPUT" == "true" ]]; then
  in_val="$(read_value inputs "%IX0.0")"
  echo "Input value: $in_val"
  if ! is_false "$in_val"; then
    echo "Expected input FALSE (check wiring between GPIO27 and GPIO17)."
    exit 1
  fi
fi

echo "GPIO hardware test complete. Logs: $OUT"
