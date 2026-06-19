import React from "react";

interface SfcCodePanelProps {
  code: string | null;
  errors: string[];
  isGenerating?: boolean;
  onCopy?: () => void;
}

/**
 * Code Panel - Displays generated Structured Text code in real-time
 */
export const SfcCodePanel: React.FC<SfcCodePanelProps> = ({
  code,
  errors,
  isGenerating = false,
  onCopy,
}) => {
  const handleCopyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      onCopy?.();
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: "400px",
        display: "flex",
        flexDirection: "column",
        background: "var(--vscode-editor-background)",
        borderLeft: "1px solid var(--vscode-panel-border)",
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--vscode-panel-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--vscode-sideBar-background)",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--vscode-foreground)",
          }}
        >
          Generated ST Code
        </h3>
        {code && (
          <button
            onClick={handleCopyCode}
            style={{
              padding: "4px 12px",
              fontSize: "11px",
              border: "1px solid var(--vscode-button-border)",
              borderRadius: "2px",
              background: "var(--vscode-button-background)",
              color: "var(--vscode-button-foreground)",
              cursor: "pointer",
            }}
            title="Copy code to clipboard"
          >
            Copy
          </button>
        )}
      </div>

      {/* Code Display */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: code ? "12px" : "0",
        }}
      >
        {isGenerating ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: "20px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "var(--vscode-descriptionForeground)",
              }}
            >
              Generating Structured Text...
            </p>
          </div>
        ) : code ? (
          <pre
            style={{
              margin: 0,
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              fontSize: "12px",
              lineHeight: "1.5",
              color: "var(--vscode-editor-foreground)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <code>{code}</code>
          </pre>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: "20px",
              textAlign: "center",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                Structured Text code will appear here
              </p>
              <p
                style={{
                  margin: "8px 0 0 0",
                  fontSize: "11px",
                  color: "var(--vscode-descriptionForeground)",
                  opacity: 0.7,
                }}
              >
                Click Generate or Show Code to generate from the current SFC
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Errors/Warnings */}
      {errors.length > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--vscode-panel-border)",
            padding: "12px",
            background: "var(--vscode-inputValidation-warningBackground)",
            maxHeight: "150px",
            overflow: "auto",
          }}
        >
          <h4
            style={{
              margin: "0 0 8px 0",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--vscode-inputValidation-warningForeground)",
            }}
          >
            Warnings ({errors.length})
          </h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "11px",
              color: "var(--vscode-inputValidation-warningForeground)",
            }}
          >
            {errors.map((error, index) => (
              <li key={index} style={{ marginBottom: "4px" }}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
