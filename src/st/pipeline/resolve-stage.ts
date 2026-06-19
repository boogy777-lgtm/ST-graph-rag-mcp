import type { Edge } from "../../graph/builder";
import type { Entity } from "../entity-extractor";
import type {
	STPOU,
	STRelationship,
	STSQLiteManager,
	STType,
	STVariable,
} from "../sqlite-manager";

// === Entity Converters (duplicated here to avoid circular dependency with indexer.ts) ===

function entityToPOU(entity: Entity, filePath: string): STPOU {
	const now = Date.now();
	return {
		id: `st:${filePath}:${entity.name}`,
		name: entity.name,
		pou_type: entity.type,
		file_path: filePath,
		start_line: entity.line,
		end_line: undefined,
		namespace: entity.metadata.parent || undefined,
		extends: undefined,
		implements: undefined,
		signature: entity.signature || undefined,
		created_at: now,
		updated_at: now,
	};
}

function entityToType(entity: Entity, filePath: string): STType | null {
	if (entity.type !== "TYPE" && entity.type !== "ENUM") return null;
	return {
		id: `st:type:${filePath}:${entity.name}`,
		name: entity.name,
		type_kind: entity.type === "ENUM" ? "ENUM" : "TYPE",
		file_path: filePath,
		start_line: entity.line,
		end_line: undefined,
		definition: undefined,
		created_at: Date.now(),
	};
}

function edgeToRelationship(
	edge: Edge,
	fromId: string,
	toId: string,
): STRelationship {
	return {
		id: `st:rel:${edge.id}`,
		from_id: fromId,
		to_id: toId,
		type: edge.type,
		file_path: edge.file,
		line: undefined,
		metadata: undefined,
	};
}

// === Types matching extract-stage output ===

type VarsByScope = Map<
	string,
	{
		direction: string;
		variables: { name: string; varType: string; line: number }[];
	}[]
>;

type ExtendsImplements = Map<
	string,
	{ extends?: string; implements?: string[] }
>;

type PouEndLines = Map<string, number>;

// === Result ===

export interface ResolveResult {
	pous: STPOU[];
	variables: STVariable[];
	types: STType[];
	relationships: STRelationship[];
}

export function resolveStage(
	entities: Entity[],
	structuralEdges: Edge[],
	varsByScope: VarsByScope,
	extendsImplements: ExtendsImplements,
	pouEndLines: PouEndLines,
	filePath: string,
	sqliteManager: STSQLiteManager,
): ResolveResult {
	// Convert entities to SQLite format
	const pous: STPOU[] = [];
	const variables: STVariable[] = [];
	const types: STType[] = [];

	// Entity ID map for relationship resolution
	const entityIdMap = new Map<string, string>(); // entity.id -> st_pous.id

	for (const entity of entities) {
		if (entity.type === "VARIABLE") {
			// Variables are extracted from source code below for richer data
		} else if (entity.type === "TYPE" || entity.type === "ENUM") {
			const stType = entityToType(entity, filePath);
			if (stType) types.push(stType);
		} else {
			// POU types: FUNCTION_BLOCK, PROGRAM, FUNCTION, METHOD, CLASS
			const pou = entityToPOU(entity, filePath);

			// Enhance with source code data
			const endLine = pouEndLines.get(entity.name);
			if (endLine) {
				pou.end_line = endLine;
			}

			const extImpl = extendsImplements.get(entity.name);
			if (extImpl) {
				if (extImpl.extends) pou.extends = extImpl.extends;
				if (extImpl.implements)
					pou.implements = JSON.stringify(extImpl.implements);
			}

			entityIdMap.set(entity.id, pou.id);
			pous.push(pou);
		}
	}

	// Add variables from source code extraction (with directions)
	for (const [pouName, varGroups] of varsByScope) {
		const pouId = `st:${filePath}:${pouName}`;
		for (const group of varGroups) {
			for (const v of group.variables) {
				variables.push({
					id: `st:var:${pouId}:${v.name}`,
					pou_id: pouId,
					name: v.name,
					direction: group.direction,
					var_type: v.varType,
					default_value: undefined,
					start_line: v.line,
					end_line: undefined,
				});
			}
		}
	}

	// Convert structural edges to relationships
	const relationships: STRelationship[] = [];
	for (const edge of structuralEdges) {
		// Resolve source and target entity IDs to SQLite IDs
		const sourceEntity = entities.find((e) => e.id === edge.source);
		const targetEntity = entities.find((e) => e.id === edge.target);

		if (sourceEntity && targetEntity) {
			const fromId =
				entityIdMap.get(sourceEntity.id) ||
				`st:type:${filePath}:${sourceEntity.name}`;
			const toId =
				entityIdMap.get(targetEntity.id) ||
				`st:type:${filePath}:${targetEntity.name}`;
			relationships.push(edgeToRelationship(edge, fromId, toId));
		}
	}

	// Add EXTENDS relationships
	for (const [pouName, extImpl] of extendsImplements) {
		if (extImpl.extends) {
			const fromPou = pous.find((p) => p.name === pouName);
			if (fromPou) {
				// Find the extended type
				const toPou = sqliteManager.getPOUByNameExact(extImpl.extends);
				const toType = sqliteManager.searchTypes(extImpl.extends)[0];
				const toId = toPou?.id || toType?.id || undefined;
				if (toId) {
					relationships.push({
						id: `st:rel:extends:${filePath}:${pouName}:${extImpl.extends}`,
						from_id: fromPou.id,
						to_id: toId,
						type: "EXTENDS",
						file_path: filePath,
						line: undefined,
						metadata: undefined,
					});
				}
			}
		}

		// Add IMPLEMENTS relationships
		if (extImpl.implements) {
			const fromPou = pous.find((p) => p.name === pouName);
			if (fromPou) {
				for (const iface of extImpl.implements) {
					const toType = sqliteManager.searchTypes(iface)[0];
					const toPou = sqliteManager.getPOUByNameExact(iface);
					const toId = toPou?.id || toType?.id || undefined;
					if (toId) {
						relationships.push({
							id: `st:rel:implements:${filePath}:${pouName}:${iface}`,
							from_id: fromPou.id,
							to_id: toId,
							type: "IMPLEMENTS",
							file_path: filePath,
							line: undefined,
							metadata: undefined,
						});
					}
				}
			}
		}
	}

	return { pous, variables, types, relationships };
}
