import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import type { SfcStepNode } from "./types";

/**
 * Custom node component for SFC steps following IEC 61131-3 standard
 */
export const StepNode = memo(({ data, selected }: NodeProps<SfcStepNode>) => {
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onToggleBreakpoint) {
      data.onToggleBreakpoint();
    }
  };

  // IEC 61131-3: Simple rectangular steps
  const isInitial = data.type === "initial";
  const isFinal = data.type === "final";

  const borderColor = selected
    ? "var(--vscode-focusBorder)"
    : data.isCurrentDebugStep
    ? "#FFA500"
    : "var(--vscode-editor-foreground)";

  const backgroundColor = data.isActive
    ? "#4caf50"
    : data.isCurrentDebugStep
    ? "rgba(255, 165, 0, 0.2)"
    : "var(--vscode-editor-background)";

  const textColor = data.isActive
    ? "#ffffff"
    : "var(--vscode-editor-foreground)";
  
  const borderWidth = data.isActive ? "3px" : isInitial ? "3px" : "2px";

  // Simple rectangular box per IEC 61131-3
  const stepStyle: React.CSSProperties = {
    width: "200px",
    minHeight: "56px",
    padding: "10px 14px",
    border: `${borderWidth} solid ${borderColor}`,
    borderRadius: "2px",
    background: backgroundColor,
    color: textColor,
    fontFamily: "var(--vscode-font-family)",
    fontSize: "13px",
    fontWeight: data.isActive ? 700 : isInitial ? 600 : 500,
    textAlign: "center",
    position: "relative",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    boxShadow: data.isActive 
      ? `0 0 0 3px ${borderColor}, 0 4px 12px rgba(76, 175, 80, 0.4)` 
      : selected 
      ? `0 0 0 2px var(--vscode-focusBorder)` 
      : "none",
  };

  // Final step: double bottom border
  if (isFinal) {
    stepStyle.borderBottom = `4px double ${borderColor}`;
  }

  return (
    <div
      style={stepStyle}
      onDoubleClick={handleDoubleClick}
      title="Double-click to toggle breakpoint"
    >
      {/* Breakpoint indicator */}
      {data.hasBreakpoint && (
        <div
          style={{
            position: "absolute",
            top: "-8px",
            left: "-8px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "#E51400",
            border: "2px solid var(--vscode-editor-background)",
            boxShadow: "0 0 4px rgba(229, 20, 0, 0.6)",
            zIndex: 10,
          }}
          title="Breakpoint"
        />
      )}

      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: borderColor,
          width: 8,
          height: 8,
          border: "none",
          top: -4,
        }}
      />

      <div
        style={{
          width: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {data.label}
      </div>

      {data.description && (
        <div
          style={{
            fontSize: "10px",
            opacity: 0.7,
            marginTop: "4px",
            width: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {data.description}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: borderColor,
          width: 8,
          height: 8,
          border: "none",
          bottom: -4,
        }}
      />
    </div>
  );
});

StepNode.displayName = "StepNode";
