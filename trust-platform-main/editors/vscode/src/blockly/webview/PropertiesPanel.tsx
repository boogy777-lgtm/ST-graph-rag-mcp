import React, { useState } from "react";
import { BlocklyWorkspace, Variable } from "./types";

interface PropertiesPanelProps {
  workspace: BlocklyWorkspace | null;
  selectedBlockId: string | null;
  onWorkspaceChange: (workspace: BlocklyWorkspace) => void;
}

/**
 * Properties Panel - Shows and edits workspace and block properties
 */
export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  workspace,
  selectedBlockId,
  onWorkspaceChange,
}) => {
  const [newVarName, setNewVarName] = useState("");
  const [newVarType, setNewVarType] = useState("BOOL");

  const handleAddVariable = () => {
    if (!workspace || !newVarName.trim()) return;

    const newVariable: Variable = {
      id: `var_${Date.now()}`,
      name: newVarName.trim(),
      type: newVarType,
    };

    const updatedWorkspace: BlocklyWorkspace = {
      ...workspace,
      variables: [...(workspace.variables || []), newVariable],
    };

    onWorkspaceChange(updatedWorkspace);
    setNewVarName("");
  };

  const handleRemoveVariable = (varId: string) => {
    if (!workspace) return;

    const updatedWorkspace: BlocklyWorkspace = {
      ...workspace,
      variables: (workspace.variables || []).filter((v) => v.id !== varId),
    };

    onWorkspaceChange(updatedWorkspace);
  };

  const handleUpdateMetadata = (field: string, value: string) => {
    if (!workspace) return;

    const updatedWorkspace: BlocklyWorkspace = {
      ...workspace,
      metadata: {
        ...workspace.metadata,
        name: workspace.metadata?.name || "Unnamed",
        [field]: value,
      },
    };

    onWorkspaceChange(updatedWorkspace);
  };

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <h3>Properties</h3>
      </div>

      <div className="properties-content">
        {/* Workspace Metadata */}
        <div className="property-section">
          <h4>Workspace</h4>
          <div className="property-field">
            <label>Name:</label>
            <input
              type="text"
              value={workspace?.metadata?.name || ""}
              onChange={(e) => handleUpdateMetadata("name", e.target.value)}
              placeholder="Program name"
            />
          </div>
          <div className="property-field">
            <label>Description:</label>
            <textarea
              value={workspace?.metadata?.description || ""}
              onChange={(e) => handleUpdateMetadata("description", e.target.value)}
              placeholder="Program description"
              rows={3}
            />
          </div>
          <div className="property-field">
            <label>Version:</label>
            <input
              type="text"
              value={workspace?.metadata?.version || ""}
              onChange={(e) => handleUpdateMetadata("version", e.target.value)}
              placeholder="1.0.0"
            />
          </div>
        </div>

        {/* Variables */}
        <div className="property-section">
          <h4>Variables</h4>
          <div className="variables-list">
            {(workspace?.variables || []).map((variable) => (
              <div key={variable.id} className="variable-item">
                <span className="variable-name">{variable.name}</span>
                <span className="variable-type">{variable.type}</span>
                <button
                  className="variable-delete"
                  onClick={() => handleRemoveVariable(variable.id)}
                  title="Delete variable"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="add-variable-form">
            <input
              type="text"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              placeholder="Variable name"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleAddVariable();
                }
              }}
            />
            <select
              value={newVarType}
              onChange={(e) => setNewVarType(e.target.value)}
            >
              <option value="BOOL">BOOL</option>
              <option value="INT">INT</option>
              <option value="DINT">DINT</option>
              <option value="REAL">REAL</option>
              <option value="STRING">STRING</option>
              <option value="TIME">TIME</option>
            </select>
            <button onClick={handleAddVariable} disabled={!newVarName.trim()}>
              + Add
            </button>
          </div>
        </div>

        {/* Selected Block Properties */}
        {selectedBlockId && (
          <div className="property-section">
            <h4>Block Properties</h4>
            <p className="property-placeholder">
              Block ID: {selectedBlockId}
            </p>
            {/* Additional block properties would go here */}
          </div>
        )}

        {!workspace && (
          <div className="property-placeholder">
            <p>No workspace loaded</p>
          </div>
        )}
      </div>
    </div>
  );
};
