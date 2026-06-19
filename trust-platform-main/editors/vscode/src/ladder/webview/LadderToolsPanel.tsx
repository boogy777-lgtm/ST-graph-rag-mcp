import React from "react";

export const LADDER_TOOL_DRAG_MIME = "application/x-trust-ladder-tool";
export type LadderToolId =
  | "contact"
  | "coil"
  | "timer"
  | "counter"
  | "compare"
  | "math"
  | "branchSplit"
  | "branchMerge"
  | "junction";

interface LadderToolsPanelProps {
  selectedTool: LadderToolId | null;
  onToolSelect: (tool: LadderToolId | null) => void;
  onDeleteSelection: () => void;
  onAddRung: () => void;
  onRemoveRung: () => void;
  onAddParallelContact: () => void;
  onClearWiring: () => void;
  onOpenRuntimePanel: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onSearchReplace: () => void;
  onAutoRoute: () => void;
  onSave: () => void;
  onToggleLinkMode: () => void;
  linkModeEnabled: boolean;
  linkSourceLabel?: string;
  linkFeedback?: string | null;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  canDeleteSelection: boolean;
  canRemoveRung: boolean;
  canAddParallelContact: boolean;
  canClearWiring: boolean;
}

const LOGIC_TOOL_OPTIONS: Array<{ id: LadderToolId; label: string; title: string }> = [
  { id: "contact", label: "Contact", title: "Add Contact (NO/NC)" },
  {
    id: "coil",
    label: "Coil",
    title: "Add Coil (NORMAL/SET/RESET/NEGATED per IEC Table 76)",
  },
  { id: "timer", label: "Timer", title: "Add Timer (TON/TOF/TP)" },
  { id: "counter", label: "Counter", title: "Add Counter (CTU/CTD/CTUD)" },
  { id: "compare", label: "Compare", title: "Add Compare block (GT/LT/EQ)" },
  { id: "math", label: "Math", title: "Add Math block (ADD/SUB/MUL/DIV)" },
];

const TOPOLOGY_TOOL_OPTIONS: Array<{ id: LadderToolId; label: string; title: string }> = [
  {
    id: "branchSplit",
    label: "Split",
    title: "Add branch split node for parallel legs",
  },
  {
    id: "junction",
    label: "Junction",
    title: "Add branch junction node",
  },
  {
    id: "branchMerge",
    label: "Merge",
    title: "Add branch merge node",
  },
];

export function LadderToolsPanel({
  selectedTool,
  onToolSelect,
  onDeleteSelection,
  onAddRung,
  onRemoveRung,
  onAddParallelContact,
  onClearWiring,
  onOpenRuntimePanel,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onSearchReplace,
  onAutoRoute,
  onSave,
  onToggleLinkMode,
  linkModeEnabled,
  linkSourceLabel,
  linkFeedback,
  canUndo,
  canRedo,
  canPaste,
  canDeleteSelection,
  canRemoveRung,
  canAddParallelContact,
  canClearWiring,
}: LadderToolsPanelProps) {
  const handleToolDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    toolId: LadderToolId
  ) => {
    event.dataTransfer.setData(LADDER_TOOL_DRAG_MIME, toolId);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <section className="ladder-tools-panel" aria-label="Ladder tools">
      <div className="ladder-tools-panel__section-title">Quick Actions</div>
      <div className="ladder-tools-panel__grid">
        <button
          type="button"
          className="ladder-tools-panel__button"
          onClick={onDeleteSelection}
          disabled={!canDeleteSelection}
          title="Delete selected element"
        >
          Delete
        </button>
        <button
          type="button"
          className="ladder-tools-panel__button"
          onClick={onCopy}
          title="Copy selected element or active rung"
        >
          Copy
        </button>
        <button
          type="button"
          className="ladder-tools-panel__button"
          onClick={onPaste}
          disabled={!canPaste}
          title="Paste copied element or rung"
        >
          Paste
        </button>
        <button
          type="button"
          className="ladder-tools-panel__button"
          onClick={onAddParallelContact}
          disabled={!canAddParallelContact}
          title="Auto-create a parallel branch from selected contact"
        >
          Parallel
        </button>
      </div>
      <div className="ladder-tools-panel__section-title">Elements</div>
      <div className="ladder-tools-panel__grid">
        {LOGIC_TOOL_OPTIONS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`ladder-tools-panel__button ladder-tools-panel__tool ${
              selectedTool === tool.id ? "active" : ""
            }`}
            draggable
            onDragStart={(event) => handleToolDragStart(event, tool.id)}
            onClick={() => onToolSelect(selectedTool === tool.id ? null : tool.id)}
            title={tool.title}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <div className="ladder-tools-panel__section-title">Topology</div>
      <div className="ladder-tools-panel__grid">
        {TOPOLOGY_TOOL_OPTIONS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`ladder-tools-panel__button ladder-tools-panel__tool ${
              selectedTool === tool.id ? "active" : ""
            }`}
            draggable
            onDragStart={(event) => handleToolDragStart(event, tool.id)}
            onClick={() => onToolSelect(selectedTool === tool.id ? null : tool.id)}
            title={tool.title}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`ladder-tools-panel__button ${linkModeEnabled ? "active" : ""}`}
        onClick={onToggleLinkMode}
        title="Wire mode: click source then target, or drag from source and release on target"
      >
        {linkModeEnabled ? "Wire Mode: On" : "Wire Mode"}
      </button>
      {linkModeEnabled && (
        <div className="ladder-tools-panel__hint">
          {linkSourceLabel
            ? `Source: ${linkSourceLabel}. Click/drag to target node.`
            : "Click a source node, then click or drag to the target node."}
        </div>
      )}
      {linkModeEnabled && linkFeedback && (
        <div className="ladder-tools-panel__hint">{linkFeedback}</div>
      )}
      <div className="ladder-tools-panel__section-title">Rungs</div>
      <div className="ladder-tools-panel__rungs">
        <button
          type="button"
          className="ladder-tools-panel__button"
          onClick={onAddRung}
          title="Add new rung"
        >
          Add Rung
        </button>
        <button
          type="button"
          className="ladder-tools-panel__button"
          onClick={onRemoveRung}
          title="Remove selected rung"
          disabled={!canRemoveRung}
        >
          Remove Rung
        </button>
      </div>
      <button
        type="button"
        className="ladder-tools-panel__button"
        onClick={onClearWiring}
        disabled={!canClearWiring}
        title="Remove explicit wiring from active rung"
      >
        Clear Wiring
      </button>
      <button
        type="button"
        className="ladder-tools-panel__button"
        onClick={onOpenRuntimePanel}
        title="Open Structured Text runtime panel"
      >
        Open Runtime Panel
      </button>
      <div className="ladder-tools-panel__section-title">Edit</div>
      <div className="ladder-tools-panel__grid">
        <button
          type="button"
          className="ladder-tools-panel__button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl/Cmd+Z)"
        >
          Undo
        </button>
        <button
          type="button"
          className="ladder-tools-panel__button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl/Cmd+Y or Shift+Ctrl/Cmd+Z)"
        >
          Redo
        </button>
        <button
          type="button"
          className="ladder-tools-panel__button"
          onClick={onSearchReplace}
          title="Search and replace ladder symbols"
        >
          Replace
        </button>
        <button
          type="button"
          className="ladder-tools-panel__button"
          onClick={onAutoRoute}
          title="Auto-route rung wiring"
        >
          Auto-route
        </button>
      </div>
      <button
        type="button"
        className="ladder-tools-panel__button"
        onClick={onSave}
        title="Save program"
      >
        Save
      </button>
    </section>
  );
}
