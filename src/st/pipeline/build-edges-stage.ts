import { buildEdges, type Edge } from "../../graph/builder";
import type { Entity } from "../entity-extractor";

export interface BuildEdgesResult {
	structuralEdges: Edge[];
}

export function buildEdgesStage(entities: Entity[]): BuildEdgesResult {
	const structuralEdges = buildEdges(entities);
	return { structuralEdges };
}
