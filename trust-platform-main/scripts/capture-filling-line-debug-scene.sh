#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WORKSPACE_FILE="$ROOT_DIR/examples/filling_line/media/filling-line-media.code-workspace"
ASSET_DIR="$ROOT_DIR/editors/vscode/assets"
EXTENSION_DEV_PATH="$ROOT_DIR/editors/vscode"
USER_DATA_DIR="/tmp/trust-filling-line-debug-scene-user-data"
EXTENSIONS_DIR="$USER_DATA_DIR/extensions"
DISPLAY_OUTPUT="${TRUST_SCREEN_OUTPUT:-}"
WINDOW_SETTLE_SECS="${TRUST_WINDOW_SETTLE_SECS:-7}"
GIF_WIDTH=1280
GIF_FPS=6
DO_BUILD_EXTENSION=1

usage() {
  cat <<'EOF'
Capture a minimal filling_line debug scene:
1) open Main.st
2) set breakpoint
3) open runtime pane
4) start debugging

Outputs:
  editors/vscode/assets/screenshot-debug.png
  editors/vscode/assets/demo-debug.gif

Usage:
  scripts/capture-filling-line-debug-scene.sh [options]

Options:
      --workspace-file <path>  Workspace file (default: examples/filling_line/media/filling-line-media.code-workspace)
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

if [[ ! -f "$WORKSPACE_FILE" ]]; then
  echo "Workspace file missing: $WORKSPACE_FILE" >&2
  exit 1
fi

mkdir -p "$ASSET_DIR"

if [[ -z "$DISPLAY_OUTPUT" ]]; then
  DISPLAY_OUTPUT=$(wlr-randr | awk 'NR==1 {print $1; exit}')
fi

SCREEN_MODE=$(wlr-randr | awk -v out="$DISPLAY_OUTPUT" '
  $1 == out { in_output = 1; next }
  in_output && $1 ~ /^[0-9]+x[0-9]+/ && /\(current\)/ { print $1; exit }
  in_output && $1 !~ /^ / && $1 != out { in_output = 0 }
')
if [[ -z "$SCREEN_MODE" ]]; then
  SCREEN_MODE="1920x1080"
fi
SCREEN_W="${SCREEN_MODE%x*}"
SCREEN_H="${SCREEN_MODE#*x}"

key() { ydotool key "$@"; }
type_text() {
  local text="$1"
  ydotool type "$text"
  sleep 0.12
}

click_abs() {
  local x="$1"
  local y="$2"
  ydotool mousemove -a -x "$x" -y "$y"
  sleep 0.1
  ydotool click 0xC0
  sleep 0.15
}

click_pct() {
  local x_pct="$1"
  local y_pct="$2"
  local x y
  x=$(awk -v w="$SCREEN_W" -v p="$x_pct" 'BEGIN { printf "%d", w * p }')
  y=$(awk -v h="$SCREEN_H" -v p="$y_pct" 'BEGIN { printf "%d", h * p }')
  click_abs "$x" "$y"
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
  "window.zoomLevel": 0.7,
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  "workbench.editor.enablePreview": false,
  "git.openRepositoryInParentFolders": "never",
  "git.enabled": false,
  "files.autoSave": "off",
  "debug.openDebug": "neverOpen",
  "editor.glyphMargin": true
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
  },
  {
    "key": "f4",
    "command": "editor.debug.action.toggleBreakpoint"
  },
  {
    "key": "f8",
    "command": "workbench.action.closeSidebar"
  },
  {
    "key": "f11",
    "command": "workbench.action.closePanel"
  }
]
JSON
}

build_extension() {
  if (( DO_BUILD_EXTENSION == 1 )); then
    npm --prefix "$EXTENSION_DEV_PATH" run compile >/tmp/trust-filling-line-debug-scene-build.log 2>&1
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

launch_main() {
  wlrctl toplevel close app_id:code >/dev/null 2>&1 || true
  sleep 0.8
  code --new-window \
    --user-data-dir "$USER_DATA_DIR" \
    --extensions-dir "$EXTENSIONS_DIR" \
    --extensionDevelopmentPath "$EXTENSION_DEV_PATH" \
    "$WORKSPACE_FILE" \
    -g "$ROOT_DIR/examples/filling_line/src/Main.st:21:1" >/tmp/trust-filling-line-debug-scene-code.log 2>&1 &
  wait_for_window
  sleep "$WINDOW_SETTLE_SECS"
  wlrctl toplevel focus app_id:code || true
  sleep 0.2
  wlrctl toplevel fullscreen app_id:code || true
  sleep 0.8
  # Hide chat/secondary sidebar.
  key 29:1 56:1 74:1 74:0 56:0 29:0
  sleep 0.3
  dismiss_noise
}

close_vscode() {
  dismiss_noise
  key 29:1 24:1 24:0 29:0
  sleep 0.4
  key 1:1 1:0
  sleep 0.3
  wlrctl toplevel close app_id:code >/dev/null 2>&1 || true
  sleep 0.8
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

capture_png() {
  local path="$1"
  grim -o "$DISPLAY_OUTPUT" "$path"
  echo "Captured $path"
}

do_scene() {
  launch_main
  # Keep the recording clean: hide bottom panel and side bar if present.
  key 87:1 87:0
  sleep 0.25
  key 66:1 66:0
  sleep 0.25
  frames_begin
  frames_capture 6

  # Step 1: open Main (already open). Ensure editor group focus and line 21.
  key 29:1 2:1 2:0 29:0
  sleep 0.15
  key 29:1 34:1 34:0 29:0
  sleep 0.2
  type_text "21"
  key 28:1 28:0
  sleep 0.25
  frames_capture 6

  # Step 2: set breakpoint on line 21.
  # Deterministic breakpoint set via command palette.
  # Ctrl+Shift+P
  key 29:1 42:1 25:1 25:0 42:0 29:0
  sleep 0.3
  type_text "toggle breakpoint"
  key 28:1 28:0
  sleep 0.55
  frames_capture 8

  # Step 3: open runtime pane.
  key 64:1 64:0
  sleep 1.8
  frames_capture 10

  # Step 4: start debugging.
  key 65:1 65:0
  sleep 2.0
  # Keep only code+runtime visible.
  key 66:1 66:0
  sleep 0.25
  key 87:1 87:0
  sleep 0.25
  frames_capture 14

  capture_png "$ASSET_DIR/screenshot-debug.png"
  frames_render_gif "$ASSET_DIR/demo-debug.gif"
  close_vscode
}

echo "Using output: $DISPLAY_OUTPUT"
prepare_profile
build_extension
do_scene
"$ROOT_DIR/scripts/prepare-readme-media.sh" \
  --dir "$ASSET_DIR" \
  --gif-fps "$GIF_FPS" \
  --gif-max-width 1000
echo "Done. Debug scene updated in $ASSET_DIR"
