#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE="$ROOT/docs/internal/testing/bundles/sample-runtime"
DO_BUILD=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build)
      DO_BUILD=0
      shift
      ;;
    --bundle|--project)
      BUNDLE="$2"
      shift 2
      ;;
    *)
      BUNDLE="$1"
      shift
      ;;
  esac
done

if [[ "$DO_BUILD" -eq 1 ]]; then
  cargo build -p trust-runtime >/dev/null
fi
cargo run -q -p trust-runtime --bin trust-bundle-gen -- --bundle "$BUNDLE"
