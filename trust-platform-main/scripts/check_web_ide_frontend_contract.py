#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

IDE_HTML = Path("crates/trust-runtime/src/web/ui/ide.html")

REQUIRED_SNIPPETS = {
    "monaco_bundle_import": "/ide/assets/ide-monaco.20260215.js",
    "no_cdn_hint": "could not be loaded from /ide/assets",
    "monaco_completion_provider": "registerCompletionItemProvider(ST_LANGUAGE_ID",
    "monaco_hover_provider": "registerHoverProvider(ST_LANGUAGE_ID",
    "monaco_markers": "setModelMarkers(model, MONACO_MARKER_OWNER",
    "trigger_suggest": "editor.action.triggerSuggest",
    "file_tree": 'id="fileTree"',
    "tabs": 'id="tabBar"',
    "command_palette": 'id="commandPalette"',
    "autosave": "scheduleAutosave",
    "offline_handler": 'window.addEventListener("offline"',
    "online_handler": 'window.addEventListener("online"',
    "health_endpoint": '"/api/ide/health"',
    "fs_audit_endpoint": "/api/ide/fs/audit",
    "diagnostics_endpoint": '"/api/ide/diagnostics"',
    "hover_endpoint": '"/api/ide/hover"',
    "completion_endpoint": '"/api/ide/completion"',
    "format_endpoint": '"/api/ide/format"',
    "symbols_endpoint": "/api/ide/symbols",
    "validate_endpoint": '"/api/ide/validate"',
    "frontend_telemetry_endpoint": '"/api/ide/frontend-telemetry"',
    "presence_endpoint": '"/api/ide/presence-model"',
    "multi_tab_presence_channel": "trust.ide.presence",
    "analysis_degraded_mode": "analysis degraded",
    "retry_action": "retryLastFailedAction",
    "format_command": "formatActiveDocument",
    "task_links_panel": 'id="taskLinksPanel"',
    "validate_button": 'id="validateBtn"',
    "skip_link": "Skip to IDE content",
    "dialog_a11y": 'role="dialog" aria-modal="true"',
    "save_shortcut": "Ctrl/Cmd+S",
}

FORBIDDEN_SNIPPETS = {
    "cdn_esm_sh": "esm.sh/",
}


def main() -> int:
    if not IDE_HTML.exists():
        print(f"missing file: {IDE_HTML}")
        return 1

    text = IDE_HTML.read_text(encoding="utf-8")
    missing = [name for name, snippet in REQUIRED_SNIPPETS.items() if snippet not in text]
    forbidden = [name for name, snippet in FORBIDDEN_SNIPPETS.items() if snippet in text]

    if missing or forbidden:
        print("web ide frontend contract failed. missing snippets:")
        for name in missing:
            print(f"  - {name}")
        if forbidden:
            print("forbidden snippets present:")
            for name in forbidden:
                print(f"  - {name}")
        return 1

    print("web ide frontend contract passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
