import { create } from "zustand";

interface Node {
	id: string;
	type: string;
	position: { x: number; y: number };
	data: { label: string; type: string };
}

interface Edge {
	id: string;
	source: string;
	target: string;
	label: string;
}

interface GraphState {
	nodes: Node[];
	edges: Edge[];
	fetchGraph: () => Promise<void>;
	onNodesChange: (changes: any[]) => void;
	onEdgesChange: (changes: any[]) => void;
}

import { applyEdgeChanges, applyNodeChanges } from "@xyflow/react";

export const useGraphStore = create<GraphState>((set, get) => ({
	nodes: [],
	edges: [],
	onNodesChange: (changes) => {
		set({
			nodes: applyNodeChanges(changes, get().nodes),
		});
	},
	onEdgesChange: (changes) => {
		set({
			edges: applyEdgeChanges(changes, get().edges),
		});
	},
	fetchGraph: async () => {
		try {
			const res = await fetch("/api/graph/snapshot");
			const data = await res.json();

			// Merge to preserve positions of existing nodes
			const currentNodes = get().nodes;
			const currentNodesMap = new Map(currentNodes.map((n) => [n.id, n]));

			const newNodes = (data.nodes || []).map((n: Node, index: number) => {
				const existing = currentNodesMap.get(n.id);
				if (existing) {
					return { ...n, position: existing.position };
				}
				// basic deterministic scatter if no layout engine
				return {
					...n,
					position: { x: (index % 10) * 150, y: Math.floor(index / 10) * 100 },
				};
			});

			set({ nodes: newNodes, edges: data.edges || [] });
		} catch (e) {
			console.error("Failed to fetch graph", e);
		}
	},
}));
