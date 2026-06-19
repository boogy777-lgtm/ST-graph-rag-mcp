/**
 * Graph Builder
 *
 * Builds edges between entities based on their relationships.
 * Handles cycle detection and visited sets for safe traversal.
 */

import type { Entity } from "../st/entity-extractor";
import { EntityIndex } from "./entity-index";

export type EdgeType =
	| "CONTAINS" // FB → METHOD, FB → VARIABLE
	| "USES" // FB → TYPE, FB → ENUM
	| "CALLS" // METHOD_A → METHOD_B
	| "EXTENDS" // FB_Child → FB_Parent
	| "IMPLEMENTS" // FB → INTERFACE
	| "REFERENCES"; // VARIABLE → TYPE

export interface Edge {
	id: string;
	source: string;
	target: string;
	type: EdgeType;
	file: string;
}

/**
 * Build edges from entities.
 * Uses parent relationships and name patterns to infer edges.
 */
export function buildEdges(entities: Entity[]): Edge[] {
	const edges: Edge[] = [];
	const entityMap = new Map<string, Entity>();
	const visited = new Set<string>();

	// Build lookup map and O(1) indexes
	for (const entity of entities) {
		entityMap.set(entity.id, entity);
	}
	const entityIndex = new EntityIndex(entities);

	for (const entity of entities) {
		// CONTAINS: parent → child
		if (entity.metadata.parent) {
			const parentId = `${entity.file}:${entity.metadata.parent}`;
			if (entityMap.has(parentId)) {
				const edgeId = `${parentId}->${entity.id}`;
				if (!visited.has(edgeId)) {
					visited.add(edgeId);
					edges.push({
						id: edgeId,
						source: parentId,
						target: entity.id,
						type: "CONTAINS",
						file: entity.file,
					});
				}
			}
		}

		// USES: FB/PRGM → TYPE/ENUM (O(k) where k = types/enums in the same file)
		if (entity.type === "FUNCTION_BLOCK" || entity.type === "PROGRAM") {
			const types = entityIndex.getByFileAndType(entity.file, "TYPE");
			const enums = entityIndex.getByFileAndType(entity.file, "ENUM");
			for (const other of [...types, ...enums]) {
				if (other.id !== entity.id) {
					const edgeId = `${entity.id}->USES->${other.id}`;
					if (!visited.has(edgeId)) {
						visited.add(edgeId);
						edges.push({
							id: edgeId,
							source: entity.id,
							target: other.id,
							type: "USES",
							file: entity.file,
						});
					}
				}
			}
		}

		// REFERENCES: VARIABLE → TYPE (inferred from dataType)
		if (entity.type === "VARIABLE" && entity.metadata.dataType) {
			const targetId = `${entity.file}:${entity.metadata.dataType}`;
			if (entityMap.has(targetId)) {
				const edgeId = `${entity.id}->REFERENCES->${targetId}`;
				if (!visited.has(edgeId)) {
					visited.add(edgeId);
					edges.push({
						id: edgeId,
						source: entity.id,
						target: targetId,
						type: "REFERENCES",
						file: entity.file,
					});
				}
			}
		}
	}

	return edges;
}

/**
 * Detect cycles in the graph.
 * Returns true if a cycle exists.
 */
export function hasCycle(edges: Edge[]): boolean {
	const adj = new Map<string, string[]>();
	const visited = new Set<string>();
	const recStack = new Set<string>();

	// Build adjacency list
	for (const edge of edges) {
		if (!adj.has(edge.source)) {
			adj.set(edge.source, []);
		}
		adj.get(edge.source)!.push(edge.target);
	}

	function dfs(node: string): boolean {
		visited.add(node);
		recStack.add(node);

		const neighbors = adj.get(node) || [];
		for (const neighbor of neighbors) {
			if (!visited.has(neighbor)) {
				if (dfs(neighbor)) return true;
			} else if (recStack.has(neighbor)) {
				return true;
			}
		}

		recStack.delete(node);
		return false;
	}

	for (const node of adj.keys()) {
		if (!visited.has(node)) {
			if (dfs(node)) return true;
		}
	}

	return false;
}
