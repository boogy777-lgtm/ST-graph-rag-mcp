#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ASSET_DIR="$ROOT_DIR/editors/vscode/assets"
PNG_MAX_WIDTH=1600
GIF_MAX_WIDTH=1200
GIF_FPS=12

usage() {
  cat <<'EOF'
Normalize and compress README media assets (PNG/GIF) using ffmpeg.

Usage:
  scripts/prepare-readme-media.sh [--dir <path>] [--png-max-width <px>] [--gif-max-width <px>] [--gif-fps <n>]

Options:
      --dir            Asset directory (default: editors/vscode/assets)
      --png-max-width  Max width for PNGs (default: 1600)
      --gif-max-width  Max width for GIFs (default: 1200)
      --gif-fps        GIF output FPS (default: 12)
  -h, --help           Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      ASSET_DIR="${2:-}"
      shift 2
      ;;
    --png-max-width)
      PNG_MAX_WIDTH="${2:-}"
      shift 2
      ;;
    --gif-max-width)
      GIF_MAX_WIDTH="${2:-}"
      shift 2
      ;;
    --gif-fps)
      GIF_FPS="${2:-}"
      shift 2
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

for value in "$PNG_MAX_WIDTH" "$GIF_MAX_WIDTH" "$GIF_FPS"; do
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "Width/FPS values must be integers." >&2
    exit 1
  fi
done

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  echo "ffmpeg and ffprobe are required but not installed." >&2
  exit 1
fi

if [[ "$ASSET_DIR" != /* ]]; then
  ASSET_DIR="$ROOT_DIR/$ASSET_DIR"
fi

if [[ ! -d "$ASSET_DIR" ]]; then
  echo "Asset directory does not exist: $ASSET_DIR" >&2
  exit 1
fi

tmp_files=()
cleanup() {
  if [[ "${#tmp_files[@]}" -gt 0 ]]; then
    rm -f "${tmp_files[@]}"
  fi
}
trap cleanup EXIT

human_bytes() {
  local size="$1"
  awk -v sum="$size" 'function human(x){s="B KB MB GB TB";split(s,a);for(i=1;x>=1024&&i<5;i++)x/=1024;return sprintf("%.1f %s",x,a[i])} BEGIN{print human(sum)}'
}

process_png() {
  local file="$1"
  local tmp
  local before after dims

  tmp=$(mktemp --suffix=.png)
  tmp_files+=("$tmp")

  before=$(stat -c%s "$file")
  dims=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$file")

  ffmpeg -hide_banner -loglevel error -y \
    -i "$file" \
    -vf "scale='min(${PNG_MAX_WIDTH},iw)':-2:flags=lanczos" \
    -frames:v 1 \
    -c:v png \
    -compression_level 9 \
    "$tmp"

  mv "$tmp" "$file"
  after=$(stat -c%s "$file")
  echo "PNG  $file  $dims  $(human_bytes "$before") -> $(human_bytes "$after")"
}

process_gif() {
  local file="$1"
  local palette tmp before after dims

  palette=$(mktemp --suffix=.png)
  tmp=$(mktemp --suffix=.gif)
  tmp_files+=("$palette" "$tmp")

  before=$(stat -c%s "$file")
  dims=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$file")

  ffmpeg -hide_banner -loglevel error -y \
    -i "$file" \
    -vf "fps=${GIF_FPS},scale='min(${GIF_MAX_WIDTH},iw)':-2:flags=lanczos,palettegen=stats_mode=diff" \
    "$palette"

  ffmpeg -hide_banner -loglevel error -y \
    -i "$file" \
    -i "$palette" \
    -lavfi "fps=${GIF_FPS},scale='min(${GIF_MAX_WIDTH},iw)':-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    "$tmp"

  mv "$tmp" "$file"
  after=$(stat -c%s "$file")
  echo "GIF  $file  $dims  $(human_bytes "$before") -> $(human_bytes "$after")"
}

shopt -s nullglob
png_files=("$ASSET_DIR"/*.png)
gif_files=("$ASSET_DIR"/*.gif)

if [[ "${#png_files[@]}" -eq 0 && "${#gif_files[@]}" -eq 0 ]]; then
  echo "No PNG/GIF assets found in $ASSET_DIR"
  exit 0
fi

for file in "${png_files[@]}"; do
  process_png "$file"
done

for file in "${gif_files[@]}"; do
  process_gif "$file"
done

echo "Done. Processed ${#png_files[@]} PNG and ${#gif_files[@]} GIF file(s)."
