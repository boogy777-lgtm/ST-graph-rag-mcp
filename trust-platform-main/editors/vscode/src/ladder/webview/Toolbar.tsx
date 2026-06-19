import React from "react";

interface ToolbarProps {
  selectedTool: string | null;
  onToolSelect: (tool: string | null) => void;
  onAddRung: () => void;
  onRemoveRung: () => void;
  canRemoveRung: boolean;
  onSave: () => void;
  onAutoRoute: () => void;
  onSearchReplace: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
}

export function Toolbar({
  selectedTool,
  onToolSelect,
  onAddRung,
  onRemoveRung,
  canRemoveRung,
  onSave,
  onAutoRoute,
  onSearchReplace,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  canUndo,
  canRedo,
  canPaste,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <h3>Elements</h3>
        <button
          className={`toolbar-button ${selectedTool === 'contact' ? 'active' : ''}`}
          onClick={() => onToolSelect(selectedTool === 'contact' ? null : 'contact')}
          title="Add Contact (NO/NC)"
        >
          ├─┤ Contact
        </button>
        <button
          className={`toolbar-button ${selectedTool === 'coil' ? 'active' : ''}`}
          onClick={() => onToolSelect(selectedTool === 'coil' ? null : 'coil')}
          title="Add Coil"
        >
          ( ) Coil
        </button>
        <button
          className={`toolbar-button ${selectedTool === 'timer' ? 'active' : ''}`}
          onClick={() => onToolSelect(selectedTool === 'timer' ? null : 'timer')}
          title="Add Timer"
        >
          [T] Timer
        </button>
        <button
          className={`toolbar-button ${selectedTool === 'counter' ? 'active' : ''}`}
          onClick={() => onToolSelect(selectedTool === 'counter' ? null : 'counter')}
          title="Add Counter"
        >
          [C] Counter
        </button>
        <button
          className={`toolbar-button ${selectedTool === 'compare' ? 'active' : ''}`}
          onClick={() => onToolSelect(selectedTool === 'compare' ? null : 'compare')}
          title="Add Comparator"
        >
          [GT] Compare
        </button>
        <button
          className={`toolbar-button ${selectedTool === 'math' ? 'active' : ''}`}
          onClick={() => onToolSelect(selectedTool === 'math' ? null : 'math')}
          title="Add Math Block"
        >
          [+] Math
        </button>
      </div>

      <div className="toolbar-section">
        <h3>Rungs</h3>
        <button
          className="toolbar-button"
          onClick={onAddRung}
          title="Add new rung"
        >
          ➕ Add Rung
        </button>
        <button
          className="toolbar-button"
          onClick={onRemoveRung}
          title="Remove selected rung"
          disabled={!canRemoveRung}
        >
          ➖ Remove Rung
        </button>
      </div>

      <div className="toolbar-section">
        <h3>Edit</h3>
        <button
          className="toolbar-button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl/Cmd+Z)"
        >
          ↶ Undo
        </button>
        <button
          className="toolbar-button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl/Cmd+Y or Shift+Ctrl/Cmd+Z)"
        >
          ↷ Redo
        </button>
        <button
          className="toolbar-button"
          onClick={onCopy}
          title="Copy selected element or active rung (Ctrl/Cmd+C)"
        >
          ⧉ Copy
        </button>
        <button
          className="toolbar-button"
          onClick={onPaste}
          disabled={!canPaste}
          title="Paste copied element/rung (Ctrl/Cmd+V)"
        >
          📋 Paste
        </button>
        <button
          className="toolbar-button"
          onClick={onSearchReplace}
          title="Search/replace ladder symbols"
        >
          🔎 Replace
        </button>
        <button
          className="toolbar-button"
          onClick={onAutoRoute}
          title="Auto-route rung wires"
        >
          ↹ Auto-route
        </button>
        <button
          className="toolbar-button"
          onClick={onSave}
          title="Save program"
        >
          💾 Save
        </button>
      </div>
    </div>
  );
}
