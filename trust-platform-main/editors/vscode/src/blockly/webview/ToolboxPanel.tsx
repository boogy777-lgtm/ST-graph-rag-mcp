import React from "react";

/**
 * Toolbox Panel - Shows available Blockly blocks organized by category
 */
export const ToolboxPanel: React.FC = () => {
  const categories = [
    { name: "Logic", icon: "🔀", color: "#5C81A6" },
    { name: "Loops", icon: "🔁", color: "#5CA65C" },
    { name: "Math", icon: "➕", color: "#5C68A6" },
    { name: "Variables", icon: "📦", color: "#A55B99" },
    { name: "Functions", icon: "⚙️", color: "#9A5CA6" },
    { name: "PLC I/O", icon: "🔌", color: "#D19A4D" },
    { name: "PLC Timers", icon: "⏱️", color: "#D1684D" },
    { name: "PLC Counters", icon: "🔢", color: "#4D97D1" },
  ];

  return (
    <div className="toolbox-panel">
      <div className="toolbox-header">
        <h3>Blocks</h3>
      </div>
      <div className="toolbox-categories">
        {categories.map((category) => (
          <div
            key={category.name}
            className="toolbox-category"
            style={{ borderLeftColor: category.color }}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-name">{category.name}</span>
          </div>
        ))}
      </div>
      <div className="toolbox-footer">
        <p className="toolbox-hint">
          Drag blocks to workspace
        </p>
      </div>
    </div>
  );
};
