#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WORKSPACE_FILE="$ROOT_DIR/examples/plant_demo/media/plant-demo-media.code-workspace"
ASSET_DIR="$ROOT_DIR/editors/vscode/assets"
EXTENSION_DEV_PATH="$ROOT_DIR/editors/vscode"
USER_DATA_DIR="/tmp/trust-plant-demo-pro-user-data"
EXTENSIONS_DIR="$USER_DATA_DIR/extensions"
DISPLAY_OUTPUT="${TRUST_SCREEN_OUTPUT:-}"
WINDOW_SETTLE_SECS="${TRUST_WINDOW_SETTLE_SECS:-8}"
GIF_WIDTH=1280
GIF_FPS=6
DO_BUILD_EXTENSION=1

usage() {
  cat <<'EOF'
Capture professional media from examples/plant_demo.

Usage:
  scripts/capture-plant-demo-media-pro.sh [options]

Options:
      --workspace-file <path>  Workspace file (default: examples/plant_demo/media/plant-demo-media.code-workspace)
      --assets-dir <path>      Output assets dir (default: editors/vscode/assets)
      --output <display>       Wayland output for grim (default: first from wlr-randr)
      --no-build-extension     Skip npm compile
      --gif-width <px>         GIF width (default: 1280)
      --gif-fps <n>            GIF fps (default: 6)
  -h, --help                   Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace-file)
      WORKSPACE_FILE="${2:-}"
      shift 2
      ;;
    --assets-dir)
      ASSET_DIR="${2:-}"
      shift 2
      ;;
    --output)
      DISPLAY_OUTPUT="${2:-}"
      shift 2
      ;;
    --no-build-extension)
      DO_BUILD_EXTENSION=0
      shift
      ;;
    --gif-width)
      GIF_WIDTH="${2:-}"
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

if [[ "$WORKSPACE_FILE" != /* ]]; then
  WORKSPACE_FILE="$ROOT_DIR/$WORKSPACE_FILE"
fi
if [[ "$ASSET_DIR" != /* ]]; then
  ASSET_DIR="$ROOT_DIR/$ASSET_DIR"
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd code
require_cmd ydotool
require_cmd grim
require_cmd ffmpeg
require_cmd wlrctl
require_cmd wlr-randr
require_cmd npm

mkdir -p "$ASSET_DIR"

if [[ -z "$DISPLAY_OUTPUT" ]]; then
  DISPLAY_OUTPUT=$(wlr-randr | awk 'NR==1 {print $1; exit}')
fi

if [[ ! -f "$WORKSPACE_FILE" ]]; then
  echo "Workspace file missing: $WORKSPACE_FILE" >&2
  exit 1
fi

key() { ydotool key "$@"; }
type_text() {
  local text="$1"
  # ASCII-only token for rename; ydotool is stable here on Swedish layout.
  ydotool type "$text"
  sleep 0.12
}

dismiss_noise() {
  key 1:1 1:0
  sleep 0.1
  key 1:1 1:0
  sleep 0.1
}

prepare_profile() {
  rm -rf "$USER_DATA_DIR"
  mkdir -p "$USER_DATA_DIR/User" "$EXTENSIONS_DIR"
  cat >"$USER_DATA_DIR/User/settings.json" <<'JSON'
{
  "security.workspace.trust.enabled": false,
  "window.commandCenter": false,
  "chat.commandCenter.enabled": false,
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  "git.openRepositoryInParentFolders": "never",
  "git.enabled": false
}
JSON
  cat >"$USER_DATA_DIR/User/keybindings.json" <<'JSON'
[
  {
    "key": "f6",
    "command": "trust-lsp.debug.openIoPanel"
  },
  {
    "key": "f7",
    "command": "trust-lsp.debug.start"
  }
]
JSON
}

build_extension() {
  if (( DO_BUILD_EXTENSION == 1 )); then
    npm --prefix "$EXTENSION_DEV_PATH" run compile >/tmp/trust-plant-pro-build.log 2>&1
  fi
}

wait_for_window() {
  for _ in $(seq 1 60); do
    if wlrctl toplevel find app_id:code >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  echo "VS Code window not found." >&2
  exit 1
}

launch() {
  local goto="$1"
  wlrctl toplevel close app_id:code >/dev/null 2>&1 || true
  sleep 0.8
  code --new-window \
    --user-data-dir "$USER_DATA_DIR" \
    --extensions-dir "$EXTENSIONS_DIR" \
    --extensionDevelopmentPath "$EXTENSION_DEV_PATH" \
    "$WORKSPACE_FILE" \
    -g "$goto" >/tmp/trust-plant-pro-code.log 2>&1 &
  wait_for_window
  sleep "$WINDOW_SETTLE_SECS"
  wlrctl toplevel focus app_id:code || true
  sleep 0.2
  wlrctl toplevel fullscreen app_id:code || true
  sleep 0.8
  # Hide chat/secondary sidebar.
  key 29:1 56:1 74:1 74:0 56:0 29:0
  sleep 0.4
  dismiss_noise
}

capture_png() {
  grim -o "$DISPLAY_OUTPUT" "$1"
  echo "Captured $1"
}

FRAME_DIR=""
FRAME_INDEX=1
frames_begin() {
  FRAME_DIR=$(mktemp -d)
  FRAME_INDEX=1
}
frames_capture() {
  local n="${1:-1}"
  for _ in $(seq 1 "$n"); do
    grim -o "$DISPLAY_OUTPUT" "$(printf "%s/frame-%04d.png" "$FRAME_DIR" "$FRAME_INDEX")"
    FRAME_INDEX=$((FRAME_INDEX + 1))
  done
}
frames_render_gif() {
  local out="$1"
  local palette
  palette=$(mktemp --suffix=.png)
  ffmpeg -hide_banner -loglevel error -y -framerate "$GIF_FPS" -i "$FRAME_DIR/frame-%04d.png" \
    -vf "scale='min(${GIF_WIDTH},iw)':-2:flags=lanczos,palettegen=stats_mode=diff" "$palette"
  ffmpeg -hide_banner -loglevel error -y -framerate "$GIF_FPS" -i "$FRAME_DIR/frame-%04d.png" -i "$palette" \
    -lavfi "fps=${GIF_FPS},scale='min(${GIF_WIDTH},iw)':-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" "$out"
  rm -f "$palette"
  rm -rf "$FRAME_DIR"
  echo "Captured $out"
}

close_vscode() {
  dismiss_noise
  wlrctl toplevel close app_id:code >/dev/null 2>&1 || true
  sleep 0.8
}

set_breakpoint_here() {
  # F9 toggles a breakpoint on the current line.
  key 67:1 67:0
  sleep 0.4
}

show_runtime_panel() {
  # F6 is bound in keybindings.json to trust-lsp.debug.openIoPanel.
  key 64:1 64:0
  sleep 2.0
}

scene_diagnostics_png() {
  launch "$ROOT_DIR/examples/plant_demo/src/program.st:1:1"
  key 29:1 42:1 50:1 50:0 42:0 29:0
  sleep 1.0
  dismiss_noise
  capture_png "$ASSET_DIR/screenshot-diagnostics.png"
  close_vscode
}

scene_refactor_png() {
  launch "$ROOT_DIR/examples/plant_demo/src/program.st:7:5"
  # True refactor: symbol rename from declaration (F2).
  key 60:1 60:0
  sleep 0.5
  type_text "SpeedInputRaw"
  key 28:1 28:0
  sleep 0.8
  dismiss_noise
  capture_png "$ASSET_DIR/screenshot-refactor.png"
  close_vscode
}

scene_debug_png() {
  launch "$ROOT_DIR/examples/plant_demo/src/config.st:1:1"
  set_breakpoint_here
  show_runtime_panel
  # F7 is bound in keybindings.json to trust-lsp.debug.start.
  key 65:1 65:0
  sleep 2.4
  dismiss_noise
  capture_png "$ASSET_DIR/screenshot-debug.png"
  close_vscode
}

scene_refactor_gif() {
  launch "$ROOT_DIR/examples/plant_demo/src/program.st:7:5"
  frames_begin
  frames_capture 12
  key 60:1 60:0
  sleep 0.35
  frames_capture 6
  type_text "SpeedInputRaw"
  sleep 0.45
  frames_capture 12
  key 28:1 28:0
  sleep 0.6
  frames_capture 14
  frames_render_gif "$ASSET_DIR/demo-rename.gif"
  close_vscode
}

scene_debug_gif() {
  launch "$ROOT_DIR/examples/plant_demo/src/config.st:1:1"
  set_breakpoint_here
  frames_begin
  frames_capture 10
  show_runtime_panel
  frames_capture 10
  # F7 is bound in keybindings.json to trust-lsp.debug.start.
  key 65:1 65:0
  sleep 1.2
  frames_capture 16
  frames_render_gif "$ASSET_DIR/demo-debug.gif"
  close_vscode
}

echo "Using output: $DISPLAY_OUTPUT"
prepare_profile
build_extension
scene_diagnostics_png
scene_refactor_png
scene_debug_png
scene_refactor_gif
scene_debug_gif
"$ROOT_DIR/scripts/prepare-readme-media.sh" --dir "$ASSET_DIR"
echo "Done. Professional media updated in $ASSET_DIR"
