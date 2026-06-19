import React from "react";
import type { RuntimeUiMode, RuntimeUiState } from "../runtimeTypes";
import "./runtimeControlShell.css";

interface RuntimeControlShellProps {
  state: RuntimeUiState;
  onSetMode: (mode: RuntimeUiMode) => void;
  onStart: () => void;
  onStop: () => void;
  onOpenRuntimeSettings: () => void;
}

function statusLabel(status: RuntimeUiState["status"]): string {
  switch (status) {
    case "idle":
      return "Stopped";
    case "running":
      return "Running";
    case "error":
      return "Error";
    default:
      return "Stopped";
  }
}

export const RuntimeControlShell: React.FC<RuntimeControlShellProps> = ({
  state,
  onSetMode,
  onStart,
  onStop,
  onOpenRuntimeSettings,
}) => {
  const canChangeMode = !state.isExecuting;
  const status = statusLabel(state.status);
  const statusClass = state.isExecuting
    ? "runtime-shell__status-pill running on"
    : "runtime-shell__status-pill disconnected";

  return (
    <section className="runtime-shell" aria-label="Runtime controls">
      <div className="runtime-shell__header-top">
        <div className="runtime-shell__toolbar">
          <div className="runtime-shell__mode-toggle" role="group" aria-label="Runtime mode">
            <button
              type="button"
              className={`runtime-shell__mode-button ${
                state.mode === "local" ? "active" : ""
              }`}
              disabled={!canChangeMode}
              onClick={() => onSetMode("local")}
              title="Use the local runtime started by the debugger."
            >
              Local
            </button>
            <button
              type="button"
              className={`runtime-shell__mode-button ${
                state.mode === "external" ? "active" : ""
              }`}
              disabled={!canChangeMode}
              onClick={() => onSetMode("external")}
              title="Connect to a running runtime at the configured endpoint."
            >
              External
            </button>
          </div>
          <button
            type="button"
            className="runtime-shell__start-button"
            onClick={state.isExecuting ? onStop : onStart}
            title="Start or stop the selected runtime."
          >
            {state.isExecuting ? "Stop" : "Start"}
          </button>
          <button
            type="button"
            className="runtime-shell__icon-button"
            onClick={onOpenRuntimeSettings}
            title="Open runtime settings."
            aria-label="Open runtime settings"
          >
            ⚙
          </button>
        </div>
        <div className="runtime-shell__runtime-status">
          <span className={statusClass}>{status}</span>
        </div>
      </div>
      {state.status === "error" && state.lastError && (
        <div className="runtime-shell__error">
          {state.lastError}
        </div>
      )}
    </section>
  );
};
