#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WORKSPACE_FILE="$ROOT_DIR/examples/filling_line/media/filling-line-media.code-workspace"
ASSET_DIR="$ROOT_DIR/editors/vscode/assets"
EXTENSION_DEV_PATH="$ROOT_DIR/editors/vscode"
USER_DATA_DIR="/tmp/trust-filling-line-pro-user-data"
EXTENSIONS_DIR="$USER_DATA_DIR/extensions"
DISPLAY_OUTPUT="${TRUST_SCREEN_OUTPUT:-}"
WINDOW_SETTLE_SECS="${TRUST_WINDOW_SETTLE_SECS:-8}"
GIF_WIDTH=1280
GIF_FPS=6
DO_BUILD_EXTENSION=1

usage() {
  cat <<'EOF'
Capture professional media from examples/filling_line.

Usage:
  scripts/capture-filling-line-media-pro.sh [options]

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
require_cmd ffprobe
require_cmd fc-match
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

FONT_FILE=$(fc-match -f '%{file}\n' 'DejaVu Sans' 2>/dev/null | head -n1 || true)
if [[ -z "$FONT_FILE" ]]; then
  echo "Could not resolve a font for annotated social GIFs." >&2
  exit 1
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
if ! [[ "$SCREEN_W" =~ ^[0-9]+$ ]] || ! [[ "$SCREEN_H" =~ ^[0-9]+$ ]]; then
  SCREEN_W=1920
  SCREEN_H=1080
fi

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

open_quick_file() {
  local file_name="$1"
  # Ctrl+P
  key 29:1 25:1 25:0 29:0
  sleep 0.35
  type_text "$file_name"
  key 28:1 28:0
  sleep 0.9
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
  "git.enabled": false,
  "files.autoSave": "off",
  "debug.openDebug": "neverOpen",
  "editor.glyphMargin": true,
  "debug.showBreakpointsInOverviewRuler": true
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
    npm --prefix "$EXTENSION_DEV_PATH" run compile >/tmp/trust-filling-line-pro-build.log 2>&1
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
    -g "$goto" >/tmp/trust-filling-line-pro-code.log 2>&1 &
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
  # Close without saving edits.
  key 29:1 24:1 24:0 29:0
  sleep 0.5
  key 1:1 1:0
  sleep 0.4
  wlrctl toplevel close app_id:code >/dev/null 2>&1 || true
  sleep 0.8
}

set_breakpoint_here() {
  # Ensure editor focus and jump to deterministic executable line in Main.st.
  # Ctrl+1 (first editor group)
  key 29:1 2:1 2:0 29:0
  sleep 0.15
  # Ctrl+G, line 21, Enter
  key 29:1 34:1 34:0 29:0
  sleep 0.2
  type_text "21"
  key 28:1 28:0
  sleep 0.25
  # Click gutter on line 21 to create a visible breakpoint marker.
  click_pct 0.013 0.30
  sleep 0.45
}

show_runtime_panel() {
  # F6 bound to trust-lsp.debug.openIoPanel.
  key 64:1 64:0
  sleep 1.8
}

start_debug() {
  # F7 bound to trust-lsp.debug.start.
  key 65:1 65:0
  sleep 2.0
}

set_runtime_values_live() {
  # Intentionally no direct writes here.
  # Mouse-coordinate writes in the runtime webview are too layout-fragile for
  # deterministic capture across sessions.
  true
}

annotate_refactor_social() {
  local in="$ASSET_DIR/demo-rename.gif"
  local out="$ASSET_DIR/demo-rename-social.gif"
  ffmpeg -hide_banner -loglevel error -y -i "$in" -vf \
"drawtext=fontfile='${FONT_FILE}':text='F2 Rename symbol':x=36:y=h-86:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:enable='between(t,0.0,2.2)',\
drawtext=fontfile='${FONT_FILE}':text='Type LevelCtrl':x=36:y=h-86:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:enable='between(t,2.2,4.6)',\
drawtext=fontfile='${FONT_FILE}':text='Enter updates declaration and usage':x=36:y=h-86:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:enable='between(t,4.6,9.5)'" \
    "$out"
  echo "Captured $out"
}

annotate_debug_social() {
  local in="$ASSET_DIR/demo-debug.gif"
  local out="$ASSET_DIR/demo-debug-social.gif"
  ffmpeg -hide_banner -loglevel error -y -i "$in" -vf \
"drawtext=fontfile='${FONT_FILE}':text='F9 Set breakpoint in Main.st':x=36:y=h-86:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:enable='between(t,0.0,2.0)',\
drawtext=fontfile='${FONT_FILE}':text='F6 Open Runtime Panel':x=36:y=h-86:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:enable='between(t,2.0,3.8)',\
drawtext=fontfile='${FONT_FILE}':text='F7 Start Debugging':x=36:y=h-86:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:enable='between(t,3.8,6.2)',\
drawtext=fontfile='${FONT_FILE}':text='Main code plus runtime pane visible':x=36:y=h-86:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:enable='between(t,6.2,11.5)'" \
    "$out"
  echo "Captured $out"
}

scene_diagnostics_png() {
  launch "$ROOT_DIR/examples/filling_line/src/Main.st:1:1"
  type_text "BROKEN_TOKEN "
  sleep 0.5
  # Ctrl+Shift+M (Problems panel)
  key 29:1 42:1 50:1 50:0 42:0 29:0
  sleep 1.0
  dismiss_noise
  capture_png "$ASSET_DIR/screenshot-diagnostics.png"
  close_vscode
}

scene_refactor_png() {
  launch "$ROOT_DIR/examples/filling_line/src/Main.st:19:4"
  key 60:1 60:0
  sleep 0.5
  type_text "LevelCtrl"
  key 28:1 28:0
  sleep 0.8
  dismiss_noise
  capture_png "$ASSET_DIR/screenshot-refactor.png"
  close_vscode
}

scene_debug_png() {
  launch "$ROOT_DIR/examples/filling_line/src/Main.st:17:1"
  set_breakpoint_here
  show_runtime_panel
  start_debug
  # Keep the focus on runtime+code, and hide left sidebar noise.
  key 66:1 66:0
  sleep 0.3
  # Close bottom panel to free space for code + runtime pane.
  key 87:1 87:0
  sleep 0.3
  sleep 0.8
  dismiss_noise
  capture_png "$ASSET_DIR/screenshot-debug.png"
  close_vscode
}

scene_refactor_gif() {
  launch "$ROOT_DIR/examples/filling_line/src/Main.st:19:4"
  frames_begin
  frames_capture 10
  key 60:1 60:0
  sleep 0.4
  frames_capture 8
  type_text "LevelCtrl"
  sleep 0.5
  frames_capture 10
  key 28:1 28:0
  sleep 0.8
  frames_capture 16
  frames_render_gif "$ASSET_DIR/demo-rename.gif"
  close_vscode
}

scene_debug_gif() {
  launch "$ROOT_DIR/examples/filling_line/src/Main.st:17:1"
  frames_begin
  frames_capture 8
  set_breakpoint_here
  sleep 0.4
  frames_capture 8
  show_runtime_panel
  frames_capture 8
  start_debug
  frames_capture 10
  # Hide left debug/sidebar noise.
  key 66:1 66:0
  sleep 0.3
  # Close bottom panel to keep runtime+code focus.
  key 87:1 87:0
  sleep 0.3
  frames_capture 8
  frames_capture 16
  frames_render_gif "$ASSET_DIR/demo-debug.gif"
  close_vscode
}

echo "Using output: $DISPLAY_OUTPUT (${SCREEN_W}x${SCREEN_H})"
prepare_profile
build_extension
scene_diagnostics_png
scene_refactor_png
scene_debug_png
scene_refactor_gif
scene_debug_gif
annotate_refactor_social
annotate_debug_social
"$ROOT_DIR/scripts/prepare-readme-media.sh" \
  --dir "$ASSET_DIR" \
  --gif-fps "$GIF_FPS" \
  --gif-max-width 1000
echo "Done. Filling line media updated in $ASSET_DIR"
