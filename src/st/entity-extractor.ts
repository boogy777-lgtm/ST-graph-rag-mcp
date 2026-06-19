/**
 * ST Entity Extractor
 *
 * Converts LSP symbols into Entity objects for graph building.
 * Maps LSP kind codes to entity types and extracts metadata.
 */

import type { LSPSymbol } from "../lsp/client";

export type EntityType =
	| "FUNCTION_BLOCK"
	| "PROGRAM"
	| "METHOD"
	| "FUNCTION"
	| "TYPE"
	| "ENUM"
	| "ENUM_MEMBER"
	| "VARIABLE"
	| "INTERFACE"
	| "PROPERTY";

export interface Entity {
	id: string;
	name: string;
	type: EntityType;
	file: string;
	line: number;
	column: number;
	signature?: string;
	metadata: {
		kind: number;
		parent?: string;
		dataType?: string;
		comments?: string[];
	};
}

/**
 * Map LSP symbol kind to entity type.
 * LSP kind codes: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolKind
 */
function kindToEntityType(kind: number): EntityType | null {
	switch (kind) {
		case 2:
			return "PROGRAM"; // Module
		case 5:
			return "FUNCTION_BLOCK"; // Class
		case 6:
			return "METHOD"; // Method
		case 7:
			return "PROPERTY"; // Property
		case 8:
			return "VARIABLE"; // Field
		case 10:
			return "ENUM"; // Enum
		case 11:
			return "INTERFACE"; // Interface
		case 12:
			return "FUNCTION"; // Function
		case 13:
			return "VARIABLE"; // Variable
		case 22:
			return "ENUM_MEMBER"; // EnumMember
		case 23:
			return "TYPE"; // Struct
		default:
			return null;
	}
}

/**
 * Extract start position from an LSP symbol.
 * Handles both SymbolInformation (location.range) and DocumentSymbol (range/selectionRange).
 */
function getSymbolPosition(symbol: LSPSymbol): {
	line: number;
	character: number;
} {
	const range = symbol.location?.range ?? symbol.selectionRange ?? symbol.range;
	if (!range) {
		return { line: 0, character: 0 };
	}
	return range.start;
}

/**
 * Infer entity type from name pattern (fallback for unknown kinds).
 * trust-lsp may return names like "FB_MixMode (FUNCTION_BLOCK)" — extract base name.
 */
function inferTypeFromName(name: string): EntityType | null {
	const baseName = name.includes(" (") ? name.split(" (")[0] : name;
	if (baseName.startsWith("FB_")) return "FUNCTION_BLOCK";
	if (baseName.startsWith("PRG_")) return "PROGRAM";
	if (baseName.startsWith("FC_")) return "FUNCTION";
	if (baseName.startsWith("E_")) return "ENUM";
	if (baseName.endsWith("_STRUCT")) return "TYPE";
	// Also check the suffix for type hints
	if (name.includes("FUNCTION_BLOCK")) return "FUNCTION_BLOCK";
	if (name.includes("PROGRAM")) return "PROGRAM";
	if (name.includes("FUNCTION")) return "FUNCTION";
	if (name.includes("ENUM")) return "ENUM";
	if (name.includes("STRUCT")) return "TYPE";
	return null;
}

/**
 * Convert LSP symbols to Entity objects.
 */
export function symbolsToEntities(
	symbols: LSPSymbol[],
	filePath: string,
	comments?: string[],
): Entity[] {
	const entities: Entity[] = [];

	for (const symbol of symbols) {
		// Strip LSP type suffix: "FB_AnalogArray (FUNCTION_BLOCK)" → "FB_AnalogArray"
		const cleanName = symbol.name.includes(" (")
			? symbol.name.split(" (")[0]
			: symbol.name;
		const type = kindToEntityType(symbol.kind) || inferTypeFromName(cleanName);
		if (!type) continue;

		const pos = getSymbolPosition(symbol);
		const entity: Entity = {
			id: `${filePath}:${cleanName}`,
			name: cleanName,
			type,
			file: filePath,
			line: pos.line + 1,
			column: pos.character + 1,
			signature: symbol.detail,
			metadata: {
				kind: symbol.kind,
				parent: symbol.containerName,
				comments,
			},
		};

		entities.push(entity);

		// Process children (e.g., methods inside FB)
		if (symbol.children) {
			for (const child of symbol.children) {
				const childCleanName = child.name.includes(" (")
					? child.name.split(" (")[0]
					: child.name;
				const childType =
					kindToEntityType(child.kind) || inferTypeFromName(childCleanName);
				if (!childType) continue;

				const childPos = getSymbolPosition(child);
				entities.push({
					id: `${filePath}:${cleanName}.${childCleanName}`,
					name: childCleanName,
					type: childType,
					file: filePath,
					line: childPos.line + 1,
					column: childPos.character + 1,
					signature: child.detail,
					metadata: {
						kind: child.kind,
						parent: cleanName,
						comments,
					},
				});
			}
		}
	}

	return entities;
}
