#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/target/browser-analysis-wasm"
PORT="${PORT:-4173}"
BUILD=true

usage() {
  cat <<EOF
Usage: $(basename "$0") [--port <port>] [--no-build] [--build-only]

Builds and serves the browser WASM analysis demo.

Options:
  --port <port>   HTTP port (default: 4173)
  --no-build      Skip build step and serve existing artifacts
  --build-only    Build artifacts and exit
  -h, --help      Show this help message

Example:
  scripts/run_browser_analysis_wasm_spike_demo.sh --port 4173
EOF
}

BUILD_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --no-build)
      BUILD=false
      shift
      ;;
    --build-only)
      BUILD_ONLY=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument '$1'"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${PORT}" ]]; then
  echo "error: --port requires a value"
  exit 1
fi

if [[ "${BUILD}" == true ]]; then
  "${ROOT_DIR}/scripts/build_browser_analysis_wasm_spike.sh"
fi

if [[ "${BUILD_ONLY}" == true ]]; then
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required to serve demo assets."
  exit 1
fi

if [[ ! -f "${OUT_DIR}/web/index.html" || ! -f "${OUT_DIR}/web/openplc-shell.html" || ! -f "${OUT_DIR}/pkg/trust_wasm_analysis.js" ]]; then
  echo "error: demo artifacts are missing. Run without --no-build first."
  exit 1
fi

echo "Serving browser WASM analysis demo..."
echo "URL: http://127.0.0.1:${PORT}/web/"
echo "OpenPLC shell demo: http://127.0.0.1:${PORT}/web/openplc-shell.html"
echo "Press Ctrl+C to stop."
python3 -m http.server "${PORT}" --directory "${OUT_DIR}"
