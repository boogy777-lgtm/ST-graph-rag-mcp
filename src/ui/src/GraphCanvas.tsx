import { useEffect } from "react";
import { ReactFlow, Controls, Background, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useGraphStore } from "./stores/graphStore";

export function GraphCanvas() {
  const { nodes, edges, fetchGraph, onNodesChange, onEdgesChange } = useGraphStore();

  useEffect(() => {
    fetchGraph();
    const interval = setInterval(fetchGraph, 5000); // Polling as a fallback for index_done
    return () => clearInterval(interval);
  }, [fetchGraph]);

  return (
    <div style={{ width: "100%", height: "100%", background: "#1e1e1e" }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          colorMode="dark"
        >
          <Background gap={16} />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
