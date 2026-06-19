#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUTPUT_PATH=""
MAX_WIDTH=1600

usage() {
  cat <<'EOF'
Capture an interactive screenshot region and save it to a target file.

Usage:
  scripts/capture-screenshot.sh --output <path> [--max-width <px>] [--no-resize]

Options:
  -o, --output     Output PNG path (absolute or repo-relative).
      --max-width  Resize image to this max width (default: 1600, no upscaling).
      --no-resize  Keep original captured size.
  -h, --help       Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)
      OUTPUT_PATH="${2:-}"
      shift 2
      ;;
    --max-width)
      MAX_WIDTH="${2:-}"
      shift 2
      ;;
    --no-resize)
      MAX_WIDTH=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$OUTPUT_PATH" ]]; then
  echo "--output is required." >&2
  usage >&2
  exit 1
fi

if ! [[ "$MAX_WIDTH" =~ ^[0-9]+$ ]]; then
  echo "--max-width must be an integer." >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but not installed." >&2
  exit 1
fi

if [[ "$OUTPUT_PATH" != /* ]]; then
  OUTPUT_PATH="$ROOT_DIR/$OUTPUT_PATH"
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

TMP_RAW=$(mktemp --suffix=.png)
TMP_PROCESSED=""
cleanup() {
  rm -f "$TMP_RAW"
  if [[ -n "$TMP_PROCESSED" ]]; then
    rm -f "$TMP_PROCESSED"
  fi
}
trap cleanup EXIT

capture_with_grim() {
  local region
  echo "Select a screenshot region..."
  region=$(slurp)
  [[ -n "$region" ]]
  grim -g "$region" "$TMP_RAW"
}

capture_with_scrot() {
  echo "Select a screenshot region..."
  scrot -s "$TMP_RAW"
}

capture_with_flameshot() {
  echo "Select a screenshot region..."
  flameshot gui -p "$TMP_RAW"
}

if command -v grim >/dev/null 2>&1 && command -v slurp >/dev/null 2>&1 && [[ -n "${WAYLAND_DISPLAY:-}" ]]; then
  capture_with_grim || {
    echo "Screenshot canceled." >&2
    exit 1
  }
elif command -v scrot >/dev/null 2>&1 && [[ -n "${DISPLAY:-}" ]]; then
  capture_with_scrot || {
    echo "Screenshot canceled." >&2
    exit 1
  }
elif command -v flameshot >/dev/null 2>&1; then
  capture_with_flameshot || {
    echo "Screenshot canceled." >&2
    exit 1
  }
else
  echo "No supported screenshot tool found. Install grim+slurp (Wayland), scrot (X11), or flameshot." >&2
  exit 1
fi

if [[ ! -s "$TMP_RAW" ]]; then
  echo "Capture failed or produced an empty image." >&2
  exit 1
fi

if (( MAX_WIDTH > 0 )); then
  TMP_PROCESSED=$(mktemp --suffix=.png)
  ffmpeg -hide_banner -loglevel error -y \
    -i "$TMP_RAW" \
    -vf "scale='min(${MAX_WIDTH},iw)':-2:flags=lanczos" \
    -frames:v 1 \
    -c:v png \
    -compression_level 9 \
    "$TMP_PROCESSED"
  mv "$TMP_PROCESSED" "$OUTPUT_PATH"
  TMP_PROCESSED=""
else
  mv "$TMP_RAW" "$OUTPUT_PATH"
fi

BYTES=$(stat -c%s "$OUTPUT_PATH")
echo "Saved $OUTPUT_PATH (${BYTES} bytes)"
