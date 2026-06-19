import type {
	STPOU,
	STRelationship,
	STSQLiteManager,
	STType,
	STVariable,
} from "../sqlite-manager";

export interface PersistInput {
	filePath: string;
	hash: string;
	pous: STPOU[];
	variables: STVariable[];
	types: STType[];
	relationships: STRelationship[];
}

export interface PersistResult {
	entityCount: number;
	edgeCount: number;
	skippedRels: number;
}

export function persistStage(
	input: PersistInput,
	sqliteManager: STSQLiteManager,
): PersistResult {
	console.error(
		`[ST Index] ${input.filePath}: ${input.relationships.length} relationships to save`,
	);
	if (input.relationships.length > 0) {
		input.relationships
			.slice(0, 5)
			.forEach((r) =>
				console.error(`  REL: ${r.from_id} --[${r.type}]--> ${r.to_id}`),
			);
	}

	const skipped = sqliteManager.bulkInsertFileData(
		input.filePath,
		input.hash,
		input.pous,
		[],
		input.variables,
		input.types,
		input.relationships,
		[],
	);

	if (skipped.skippedRels > 0) {
		console.error(
			`[ST Index] ${input.filePath}: FK violations — ${skipped.skippedRels} relationships skipped (cross-file refs will resolve on next index)`,
		);
	}

	return {
		entityCount:
			input.pous.length + input.variables.length + input.types.length,
		edgeCount: input.relationships.length,
		skippedRels: skipped.skippedRels,
	};
}
