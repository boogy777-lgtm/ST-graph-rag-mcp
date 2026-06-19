import * as vscode from "vscode";

export function getHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
): string {
	const nonce = getNonce();
	const codiconUri = webview.asWebviewUri(
		vscode.Uri.joinPath(
			extensionUri,
			"node_modules",
			"@vscode",
			"codicons",
			"dist",
			"codicon.css",
		),
	);
	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, "media", "ioPanel.js"),
	);
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
			webview.cspSource
		} 'unsafe-inline'; font-src ${webview.cspSource}; script-src ${
			webview.cspSource
		} 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Structured Text Runtime</title>
    <link href="${codiconUri}" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light dark;
        --bg: var(--vscode-sideBar-background);
        --text: var(--vscode-sideBar-foreground);
        --muted: var(--vscode-descriptionForeground);
        --border: var(--vscode-sideBar-border, var(--vscode-panel-border));
        --panel: var(--vscode-editor-background);
        --table-header: var(--vscode-sideBarSectionHeader-background, var(--vscode-sideBar-background));
        --table-header-text: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-sideBar-foreground));
        --row-hover: var(--vscode-list-hoverBackground);
        --row-alt: var(--vscode-list-inactiveSelectionBackground);
        --button-bg: var(--vscode-button-background);
        --button-fg: var(--vscode-button-foreground);
        --button-hover: var(--vscode-button-hoverBackground);
        --input-bg: var(--vscode-input-background);
        --input-fg: var(--vscode-input-foreground);
        --input-border: var(--vscode-input-border);
        --error: var(--vscode-errorForeground, #f14c4c);
        --warning: var(--vscode-editorWarning-foreground, #cca700);
      }

      * {
        box-sizing: border-box;
      }

      body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        margin: 0;
        padding: 0;
        color: var(--text);
        background: var(--bg);
      }

      header {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        background: var(--bg);
        border-bottom: 1px solid var(--border);
      }

      h1 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
      }

      .header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .header-search {
        display: flex;
      }

      .runtime-status {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        color: var(--muted);
        flex-wrap: wrap;
      }

      .mode-toggle {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--border);
        border-radius: 999px;
        overflow: hidden;
      }

      .mode-button {
        background: transparent;
        border: none;
        color: var(--text);
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }

      .mode-button.active {
        background: var(--button-bg);
        color: var(--button-fg);
      }

      .mode-button:disabled {
        cursor: default;
        opacity: 0.5;
      }

      .mode-subtitle {
        font-size: 11px;
        color: var(--muted);
        margin-right: 8px;
      }

      .status-group {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .status-pill {
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--row-alt);
        color: var(--text);
        white-space: nowrap;
      }

      .status-pill.on,
      .status-pill.running {
        background: var(--button-bg);
        color: var(--button-fg);
        border-color: transparent;
      }

      .status-pill.off {
        opacity: 0.7;
      }

      .status-pill.connected {
        border-color: var(--button-bg);
      }

      .status-pill.disconnected {
        opacity: 0.7;
      }

      .status-action {
        border: 1px solid var(--border);
        background: transparent;
        color: var(--text);
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
      }

      .status-action:hover {
        background: var(--row-alt);
      }

      .status-action:disabled {
        cursor: default;
        opacity: 0.5;
      }

      input#filter {
        padding: 4px 8px;
        border: 1px solid var(--input-border);
        border-radius: 4px;
        min-width: 220px;
        background: var(--input-bg);
        color: var(--input-fg);
      }

      input#filter::placeholder {
        color: rgba(76, 86, 106, 0.7);
      }

      button {
        background: var(--button-bg);
        border: none;
        color: var(--button-fg);
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
      }

      button:hover {
        background: var(--button-hover);
      }

      .panel {
        background: transparent;
        border: none;
        border-radius: 0;
        padding: 8px;
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .icon-btn {
        width: 28px;
        height: 28px;
        padding: 0;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--text);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .icon-btn .codicon {
        font-size: 16px;
        line-height: 1;
      }

      .icon-btn:hover {
        background: var(--row-hover);
      }

      .icon-btn:active {
        background: var(--row-alt);
      }

      .icon-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .icon-btn:disabled:hover {
        background: transparent;
      }

      .icon-btn.primary {
        border-color: transparent;
        background: var(--button-bg);
        color: var(--button-fg);
      }

      .icon-btn.primary:hover {
        background: var(--button-hover);
      }

      .tree {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      details.tree-node > summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
      }

      details.tree-node > summary:hover {
        background: var(--row-hover);
      }

      details.tree-node > summary::-webkit-details-marker {
        display: none;
      }

      details.tree-node > summary::before {
        content: "▸";
        display: inline-block;
        width: 12px;
        color: var(--muted);
        transform: translateY(-1px);
      }

      details.tree-node[open] > summary::before {
        content: "▾";
      }

      .tree-node.level-1 {
        padding-left: 12px;
      }

      .tree-node.level-2 {
        padding-left: 22px;
      }

      .tree-node.level-3 {
        padding-left: 32px;
      }

      .rows {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 2px 6px 2px 18px;
      }

      .row {
        display: grid;
        grid-template-columns: minmax(120px, 1fr) auto auto;
        align-items: center;
        gap: 8px;
        padding: 2px 4px;
        border-radius: 4px;
        font-size: 12px;
      }

      .row:hover {
        background: var(--row-hover);
      }

      .row .name {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .row .name .type {
        font-size: 10px;
        color: var(--muted);
      }

      .row .name .address {
        font-size: 10px;
        color: var(--muted);
      }

      .row .value {
        color: var(--text);
        font-family: var(--vscode-editor-font-family);
        font-size: 11px;
      }

      .row .actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .value-input {
        width: 70px;
        padding: 2px 4px;
        border: 1px solid var(--input-border);
        border-radius: 3px;
        background: var(--input-bg);
        color: var(--input-fg);
        font-family: var(--vscode-editor-font-family);
        font-size: 11px;
      }

      .value-input:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .mini-btn {
        width: 18px;
        height: 18px;
        padding: 0;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 600;
        border: 1px solid var(--input-border);
        background: var(--button-bg);
        color: var(--button-fg);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      .mini-btn:hover {
        background: var(--button-hover);
      }

      .mini-btn.active {
        background: var(--vscode-testing-iconPassed, #1f8f4e);
        color: #ffffff;
        border-color: var(--vscode-testing-iconPassed, #1f8f4e);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
      }

      .mini-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .empty {
        font-size: 11px;
        color: var(--muted);
        padding: 2px 6px 2px 24px;
      }

      .status {
        margin-top: 10px;
        color: var(--muted);
        font-size: 12px;
      }

      .diagnostics {
        margin-top: 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--panel);
        padding: 8px;
      }

      .diagnostics-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }

      .diagnostics-title {
        font-size: 12px;
        font-weight: 600;
      }

      .diagnostics-summary {
        font-size: 11px;
        color: var(--muted);
      }

      .diagnostics-runtime {
        font-size: 11px;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .diagnostics-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .diagnostic-item {
        padding: 6px 8px;
        border-radius: 4px;
        background: var(--row-alt);
        border-left: 3px solid transparent;
      }

      .diagnostic-item.error {
        border-left-color: var(--error);
      }

      .diagnostic-item.warning {
        border-left-color: var(--warning);
      }

      .diagnostic-message {
        font-size: 12px;
      }

      .diagnostic-meta {
        font-size: 11px;
        color: var(--muted);
        margin-top: 2px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .runtime-view.hidden {
        display: none;
      }

      .settings-panel {
        display: none;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--panel);
        padding: 12px;
      }

      .settings-panel.open {
        display: block;
      }

      .settings-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .settings-title {
        font-size: 13px;
        font-weight: 600;
      }

      .settings-subtitle {
        font-size: 11px;
        color: var(--muted);
        margin-top: 2px;
      }

      .settings-grid {
        display: grid;
        gap: 12px;
      }

      .settings-section {
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 10px;
        background: var(--row-alt);
      }

      .settings-section h2 {
        margin: 0 0 8px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: var(--muted);
      }

      .settings-row {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
      }

      .settings-row:last-child {
        margin-bottom: 0;
      }

      .settings-row label {
        font-size: 11px;
        color: var(--muted);
      }

      .settings-row input,
      .settings-row textarea,
      .settings-row select {
        width: 100%;
        padding: 4px 6px;
        border: 1px solid var(--input-border);
        border-radius: 4px;
        background: var(--input-bg);
        color: var(--input-fg);
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
      }

      .settings-row textarea {
        min-height: 56px;
        resize: vertical;
      }

      .settings-help {
        font-size: 11px;
        color: var(--muted);
        margin-top: 4px;
      }

      .settings-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .button-ghost {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text);
      }

      .button-ghost:hover {
        background: var(--row-hover);
      }
    </style>
  </head>
  <body>
    <header>
      <div class="header-top">
        <div class="toolbar">
          <div class="mode-toggle" role="group" aria-label="Runtime mode">
            <button id="modeSimulate" class="mode-button" type="button" title="Use the local runtime started by the debugger." aria-label="Use the local runtime started by the debugger">Local</button>
            <button id="modeOnline" class="mode-button" type="button" title="Connect to a running runtime at the configured endpoint." aria-label="Connect to a running runtime at the configured endpoint">External</button>
          </div>
          <button id="runtimeStart" type="button" title="Start or stop the selected runtime." aria-label="Start or stop the selected runtime">Start</button>
          <button
            id="settings"
            class="icon-btn"
            title="Open runtime settings"
            aria-label="Open runtime settings"
            type="button"
          >
            <span class="codicon codicon-settings-gear" aria-hidden="true"></span>
          </button>
        </div>
        <div class="runtime-status">
          <span id="runtimeStatusText" class="status-pill disconnected">Stopped</span>
        </div>
      </div>
      <div class="header-search">
        <input id="filter" placeholder="Filter by name or address" />
      </div>
    </header>

    <div class="panel">
      <div id="runtimeView" class="runtime-view">
        <div id="sections" class="tree"></div>
        <div class="diagnostics" id="diagnostics">
          <div class="diagnostics-header">
            <div class="diagnostics-title">Compile Diagnostics</div>
            <div class="diagnostics-summary" id="diagnosticsSummary">
              No compile run yet
            </div>
          </div>
          <div class="diagnostics-runtime" id="diagnosticsRuntime"></div>
          <div class="diagnostics-list" id="diagnosticsList"></div>
        </div>
      </div>
      <div id="settingsPanel" class="settings-panel">
        <div class="settings-header">
          <div>
            <div class="settings-title">Runtime Settings</div>
            <div class="settings-subtitle">
              Stored in workspace settings for this project.
            </div>
          </div>
          <div class="settings-actions">
            <button id="settingsSave" title="Save runtime settings" aria-label="Save runtime settings">Save</button>
            <button id="settingsCancel" class="button-ghost" title="Close without saving" aria-label="Close without saving">Close</button>
          </div>
        </div>
        <div class="settings-grid">
          <section class="settings-section">
            <h2>Runtime Control</h2>
            <div class="settings-row">
              <label for="runtimeControlEndpoint">Endpoint</label>
              <input
                id="runtimeControlEndpoint"
                type="text"
                placeholder="unix:///tmp/trust-debug.sock or tcp://127.0.0.1:9901"
                autocomplete="off"
              />
            </div>
            <div class="settings-row">
              <label for="runtimeControlAuthToken">Auth token</label>
              <input
                id="runtimeControlAuthToken"
                type="password"
                placeholder="Optional"
                autocomplete="off"
              />
            </div>
            <div class="settings-row">
              <label for="runtimeInlineValuesEnabled">Inline values</label>
              <input
                id="runtimeInlineValuesEnabled"
                type="checkbox"
              />
            </div>
            <div class="settings-help">
              Inline values show live runtime values in the editor.
            </div>
          </section>
          <section class="settings-section">
            <h2>Runtime Sources</h2>
            <div class="settings-row">
              <label for="runtimeIncludeGlobs">Include globs</label>
              <textarea
                id="runtimeIncludeGlobs"
                placeholder="**/*.{st,ST,pou,POU}"
              ></textarea>
            </div>
            <div class="settings-row">
              <label for="runtimeExcludeGlobs">Exclude globs</label>
              <textarea id="runtimeExcludeGlobs"></textarea>
            </div>
            <div class="settings-row">
              <label for="runtimeIgnorePragmas">Ignore pragmas</label>
              <textarea
                id="runtimeIgnorePragmas"
                placeholder="@trustlsp:runtime-ignore"
              ></textarea>
            </div>
            <div class="settings-help">
              One entry per line. Leave blank to use defaults.
            </div>
          </section>
          <section class="settings-section">
            <h2>Debug Adapter</h2>
            <div class="settings-row">
              <label for="debugAdapterPath">Adapter path</label>
              <input id="debugAdapterPath" type="text" autocomplete="off" />
            </div>
            <div class="settings-row">
              <label for="debugAdapterArgs">Adapter args</label>
              <textarea id="debugAdapterArgs"></textarea>
            </div>
            <div class="settings-row">
              <label for="debugAdapterEnv">Adapter env</label>
              <textarea
                id="debugAdapterEnv"
                placeholder="KEY=VALUE"
              ></textarea>
            </div>
            <div class="settings-help">
              Env entries can be KEY=VALUE per line or JSON.
            </div>
          </section>
          <section class="settings-section">
            <h2>Language Server</h2>
            <div class="settings-row">
              <label for="serverPath">Server path</label>
              <input id="serverPath" type="text" autocomplete="off" />
            </div>
            <div class="settings-row">
              <label for="traceServer">Trace level</label>
              <select id="traceServer">
                <option value="off">Off</option>
                <option value="messages">Messages</option>
                <option value="verbose">Verbose</option>
              </select>
            </div>
          </section>
        </div>
      </div>
      <div class="status" id="status">Runtime panel loading...</div>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function getNonce(): string {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i += 1) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
