#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT_DIR="$ROOT_DIR/docs/diagrams/generated"

mkdir -p "$OUT_DIR"

# Render all PlantUML diagrams to SVG using the official container.
mapfile -t DIAGRAMS < <(find "$ROOT_DIR/docs/diagrams" -name "*.puml" -print)
if [[ "${#DIAGRAMS[@]}" -eq 0 ]]; then
  echo "No diagram found"
  exit 1
fi

REL_DIAGRAMS=()
for path in "${DIAGRAMS[@]}"; do
  REL_DIAGRAMS+=("${path#$ROOT_DIR/}")
done

docker run --rm   -v "$ROOT_DIR":/workspace   -w /workspace   plantuml/plantuml:latest   -tsvg -o ../../diagrams/generated "${REL_DIAGRAMS[@]}"

python scripts/check_diagram_drift.py --update
