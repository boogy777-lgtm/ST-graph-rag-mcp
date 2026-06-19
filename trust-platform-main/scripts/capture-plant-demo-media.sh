#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WORKSPACE_DIR="$ROOT_DIR/examples/plant_demo"
ASSET_DIR="$ROOT_DIR/editors/vscode/assets"
EXTENSION_DEV_PATH="$ROOT_DIR/editors/vscode"
USER_DATA_DIR="/tmp/trust-plant-demo-vscode-user-data"
EXTENSIONS_DIR="$USER_DATA_DIR/extensions"
DISPLAY_OUTPUT="${TRUST_SCREEN_OUTPUT:-}"
WINDOW_SETTLE_SECS="${TRUST_WINDOW_SETTLE_SECS:-7}"
GIF_WIDTH=1200
GIF_FPS=10

usage() {
  cat <<'EOF'
Capture screenshots and GIFs from the real examples/plant_demo project.

Usage:
  scripts/capture-plant-demo-media.sh [options]

Options:
      --workspace <path>          Workspace to open (default: examples/plant_demo)
      --assets-dir <path>         Asset output dir (default: editors/vscode/assets)
      --extension-dev-path <path> Extension development path (default: editors/vscode)
      --output <display-name>     Wayland output for grim (default: first from wlr-randr)
      --gif-width <px>            GIF max width before encoding (default: 1200)
      --gif-fps <n>               GIF target FPS (default: 10)
      --no-gifs                   Skip GIF generation
      --no-optimize               Skip post-process optimization
      --no-build-extension        Skip npm compile for extension
  -h, --help                      Show this help
EOF
}

DO_GIFS=1
DO_OPTIMIZE=1
DO_BUILD_EXTENSION=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace)
      WORKSPACE_DIR="${2:-}"
      shift 2
      ;;
    --assets-dir)
      ASSET_DIR="${2:-}"
      shift 2
      ;;
    --extension-dev-path)
      EXTENSION_DEV_PATH="${2:-}"
      shift 2
      ;;
    --output)
      DISPLAY_OUTPUT="${2:-}"
      shift 2
      ;;
    --gif-width)
      GIF_WIDTH="${2:-}"
      shift 2
      ;;
    --gif-fps)
      GIF_FPS="${2:-}"
      shift 2
      ;;
    --no-gifs)
      DO_GIFS=0
      shift
      ;;
    --no-optimize)
      DO_OPTIMIZE=0
      shift
      ;;
    --no-build-extension)
      DO_BUILD_EXTENSION=0
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

if [[ "$WORKSPACE_DIR" != /* ]]; then
  WORKSPACE_DIR="$ROOT_DIR/$WORKSPACE_DIR"
fi
if [[ "$ASSET_DIR" != /* ]]; then
  ASSET_DIR="$ROOT_DIR/$ASSET_DIR"
fi
if [[ "$EXTENSION_DEV_PATH" != /* ]]; then
  EXTENSION_DEV_PATH="$ROOT_DIR/$EXTENSION_DEV_PATH"
fi

for value in "$GIF_WIDTH" "$GIF_FPS"; do
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "GIF width/fps must be integer values." >&2
    exit 1
  fi
done

mkdir -p "$ASSET_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd code
require_cmd ydotool
require_cmd wtype
require_cmd grim
require_cmd ffmpeg
require_cmd wlr-randr
require_cmd wlrctl
require_cmd npm

if [[ -z "$DISPLAY_OUTPUT" ]]; then
  DISPLAY_OUTPUT=$(wlr-randr | awk 'NR==1 {print $1; exit}')
fi
if [[ -z "$DISPLAY_OUTPUT" ]]; then
  echo "Could not detect a Wayland output for grim capture." >&2
  exit 1
fi

if [[ ! -d "$WORKSPACE_DIR" ]]; then
  echo "Workspace path does not exist: $WORKSPACE_DIR" >&2
  exit 1
fi

if [[ ! -d "$EXTENSION_DEV_PATH" ]]; then
  echo "Extension development path does not exist: $EXTENSION_DEV_PATH" >&2
  exit 1
fi

key() {
  ydotool key "$@"
}

type_text() {
  local text="$1"
  # wtype injects exact text and avoids keyboard-layout keycode mismatches.
  wtype "$text"
  sleep 0.12
}

dismiss_toasts() {
  # Escape clears command widgets and most transient UI notifications.
  key 1:1 1:0
  sleep 0.15
  key 1:1 1:0
  sleep 0.15
}

hide_secondary_sidebars() {
  # Close right sidebar / panel noise for cleaner captures.
  key 29:1 55:1 55:0 29:0
  sleep 0.25
  key 29:1 74:1 74:0 29:0
  sleep 0.25
}

prepare_profile() {
  rm -rf "$USER_DATA_DIR"
  mkdir -p "$USER_DATA_DIR/User" "$EXTENSIONS_DIR"
  cat >"$USER_DATA_DIR/User/settings.json" <<'JSON'
{
  "security.workspace.trust.enabled": false,
  "workbench.startupEditor": "none",
  "workbench.welcome.enabled": false,
  "workbench.tips.enabled": false,
  "window.commandCenter": false,
  "chat.commandCenter.enabled": false,
  "workbench.editor.enablePreview": false
}
JSON
}

build_extension() {
  if (( DO_BUILD_EXTENSION == 1 )); then
    echo "Building VS Code extension from $EXTENSION_DEV_PATH..."
    npm --prefix "$EXTENSION_DEV_PATH" run compile >/tmp/trust-plant-demo-media-build.log 2>&1
  fi
}

wait_for_code_window() {
  for _ in $(seq 1 50); do
    if wlrctl toplevel find app_id:code >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  echo "Timed out waiting for VS Code window." >&2
  exit 1
}

focus_and_fullscreen_code() {
  wlrctl toplevel focus app_id:code || true
  sleep 0.3
  wlrctl toplevel fullscreen app_id:code || true
  sleep 0.8
  hide_secondary_sidebars
  dismiss_toasts
}

launch_code() {
  local file_path="$1"
  wlrctl toplevel close app_id:code >/dev/null 2>&1 || true
  sleep 0.8
  code --new-window \
    --user-data-dir "$USER_DATA_DIR" \
    --extensions-dir "$EXTENSIONS_DIR" \
    --extensionDevelopmentPath "$EXTENSION_DEV_PATH" \
    "$WORKSPACE_DIR" \
    -g "$file_path" >/tmp/trust-plant-demo-media-code.log 2>&1 &
  wait_for_code_window
  sleep "$WINDOW_SETTLE_SECS"
  focus_and_fullscreen_code
}

close_window() {
  # Press ESC first to dismiss overlays/widgets, then close.
  dismiss_toasts
  sleep 0.2
  wlrctl toplevel close app_id:code >/dev/null 2>&1 || true
  sleep 1
}

capture_png() {
  local path="$1"
  grim -o "$DISPLAY_OUTPUT" "$path"
  echo "Captured $path"
}

frames_begin() {
  FRAME_DIR=$(mktemp -d)
  FRAME_INDEX=1
}

frames_capture() {
  local repeats="${1:-1}"
  local out
  for _ in $(seq 1 "$repeats"); do
    out=$(printf "%s/frame-%04d.png" "$FRAME_DIR" "$FRAME_INDEX")
    grim -o "$DISPLAY_OUTPUT" "$out"
    FRAME_INDEX=$((FRAME_INDEX + 1))
  done
}

frames_render_gif() {
  local output="$1"
  local palette
  palette=$(mktemp --suffix=.png)

  ffmpeg -hide_banner -loglevel error -y \
    -framerate "$GIF_FPS" \
    -i "$FRAME_DIR/frame-%04d.png" \
    -vf "scale='min(${GIF_WIDTH},iw)':-2:flags=lanczos,palettegen=stats_mode=diff" \
    "$palette"

  ffmpeg -hide_banner -loglevel error -y \
    -framerate "$GIF_FPS" \
    -i "$FRAME_DIR/frame-%04d.png" \
    -i "$palette" \
    -lavfi "fps=${GIF_FPS},scale='min(${GIF_WIDTH},iw)':-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    "$output"

  rm -f "$palette"
  rm -rf "$FRAME_DIR"
  echo "Captured $output"
}

shot_diagnostics_png() {
  launch_code "$WORKSPACE_DIR/src/program.st:1:1"
  # Open Problems panel.
  key 29:1 42:1 50:1 50:0 42:0 29:0
  sleep 1.8
  dismiss_toasts
  capture_png "$ASSET_DIR/screenshot-diagnostics.png"
  close_window
}

shot_refactor_png() {
  launch_code "$WORKSPACE_DIR/src/program.st:6:5"
  # Rename symbol widget (F2), type new name (do not apply).
  key 60:1 60:0
  sleep 0.7
  type_text "SpeedInputRaw"
  sleep 1.2
  dismiss_toasts
  capture_png "$ASSET_DIR/screenshot-refactor.png"
  # Cancel rename to keep workspace clean.
  key 1:1 1:0
  sleep 0.3
  close_window
}

shot_debug_png() {
  launch_code "$WORKSPACE_DIR/src/config.st:1:1"
  # Open Run and Debug.
  key 29:1 42:1 32:1 32:0 42:0 29:0
  sleep 0.8
  # Show Start Debugging command list.
  key 59:1 59:0
  sleep 0.8
  type_text "start debugging"
  sleep 1.4
  dismiss_toasts
  capture_png "$ASSET_DIR/screenshot-debug.png"
  dismiss_toasts
  close_window
}

gif_rename() {
  launch_code "$WORKSPACE_DIR/src/program.st:6:5"
  frames_begin
  frames_capture 4
  key 60:1 60:0
  sleep 0.6
  frames_capture 3
  type_text "SpeedInputRaw"
  sleep 0.8
  frames_capture 5
  dismiss_toasts
  frames_capture 2
  frames_render_gif "$ASSET_DIR/demo-rename.gif"
  close_window
}

gif_debug() {
  launch_code "$WORKSPACE_DIR/src/config.st:1:1"
  frames_begin
  frames_capture 4
  key 29:1 42:1 32:1 32:0 42:0 29:0
  sleep 0.8
  frames_capture 3
  key 59:1 59:0
  sleep 0.6
  frames_capture 2
  type_text "start debugging"
  sleep 1.0
  frames_capture 5
  dismiss_toasts
  frames_capture 2
  frames_render_gif "$ASSET_DIR/demo-debug.gif"
  close_window
}

echo "Using display output: $DISPLAY_OUTPUT"
echo "Workspace: $WORKSPACE_DIR"
prepare_profile
build_extension

shot_diagnostics_png
shot_refactor_png
shot_debug_png

if (( DO_GIFS == 1 )); then
  gif_rename
  gif_debug
fi

if (( DO_OPTIMIZE == 1 )); then
  "$ROOT_DIR/scripts/prepare-readme-media.sh" --dir "$ASSET_DIR"
fi

echo "Done. Media written to $ASSET_DIR"
