#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/docs/reports/artifacts/browser-analysis-wasm-demo-kit"
NOTES_DIR="${ARTIFACT_DIR}/notes"
OUTPUT_FILE="${NOTES_DIR}/demo-environment.md"

BROWSER="${1:-Chromium (set exact version after capture)}"
CPU_DEVICE="${2:-Raspberry Pi (set exact model after capture)}"
DATE_UTC="$(date -u +"%Y-%m-%d %H:%M:%SZ")"
COMMIT_HASH="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
OS_INFO="$(uname -srmo)"

cat > "${OUTPUT_FILE}" <<EOT
# Demo Environment

- Date: ${DATE_UTC}
- Commit: ${COMMIT_HASH}
- OS: ${OS_INFO}
- Browser: ${BROWSER}
- CPU/Device: ${CPU_DEVICE}

## Commands used

\`\`\`bash
cd /home/johannes/projects/trust-platform
scripts/run_browser_analysis_wasm_spike_demo.sh
\`\`\`

## URLs

\`\`\`text
http://127.0.0.1:4173/web/
http://127.0.0.1:4173/web/openplc-shell.html
\`\`\`
EOT

echo "updated: ${OUTPUT_FILE}"
