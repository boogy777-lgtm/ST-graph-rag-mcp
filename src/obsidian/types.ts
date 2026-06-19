/**
 * Obsidian Exporter — Shared Entity Types
 *
 * Mirrors SQLite row shape for the entities exported to the vault.
 * Kept narrow (only the columns actually rendered) to avoid coupling
 * to the full STPOU/STType types in src/st/sqlite-manager.
 */

export type PouKind = "PROGRAM" | "FUNCTION_BLOCK" | "FUNCTION" | "METHOD";

export interface PouEntity {
	id: string;
	name: string;
	pou_type: string;
	file_path: string;
	start_line: number;
	end_line: number | null;
	namespace: string | null;
	extends: string | null;
	implements: string | null;
	signature: string | null;
}

export interface TypeEntity {
	id: string;
	name: string;
	type_kind: string;
	file_path: string;
	start_line: number;
	end_line: number | null;
	definition: string | null;
}

export interface VariableEntity {
	id: string;
	pou_id: string;
	name: string;
	direction: string;
	var_type: string;
	default_value: string | null;
	start_line: number | null;
	end_line: number | null;
}

export interface CallEdge {
	id: string;
	from_id: string;
	to_id: string;
	type: string;
	file_path: string;
	line: number | null;
}

export interface IncomingCallEdge {
	id: string;
	from_id: string;
	from_name: string;
	from_file: string;
	line: number | null;
}
