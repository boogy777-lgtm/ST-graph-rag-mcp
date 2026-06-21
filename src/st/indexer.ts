/**
 * ST Indexer Service (SQLite-backed)
 *
 * Orchestrates the full pipeline:
 * SCAN → STRIP → LSP → EXTRACT → BUILD → STORE (SQLite)
 *
 * All data persists in SQLite tables (st_pous, st_variables, st_types, st_relationships, st_files).
 * CALLS edges are built via regex parsing of function calls.
 * Variable directions (VAR_INPUT, VAR_OUTPUT, etc.) are extracted from source code.
 * EXTENDS/IMPLEMENTS clauses are extracted from FB declarations.
 */

import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, relative } from "path";
import { buildEdges, type Edge } from "../graph/builder";
import { LSPCallHierarchyItem, LSPClient } from "../lsp/client";
import { LSPReadyPoller, LSPTimeoutError } from "../lsp/poller";
import { extractComments, stripComments } from "../st/comment-stripper";
import { type Entity, symbolsToEntities } from "../st/entity-extractor";
import type { ProgressReporter } from "../types/progress.js";
import type { IndexerHooks } from "../telemetry/domain/ports.js";
import { noopHooks } from "../telemetry/domain/ports.js";
import {
	buildEdgesStage,
	cleanupStage,
	extractStage,
	lspOpenStage,
	parseStage,
	persistStage,
	prepareStage,
	resolveStage,
	saveDiagnostics,
} from "./pipeline";
import {
	type STPOU,
	type STRelationship,
	STSQLiteManager,
	type STType,
	type STVariable,
} from "./sqlite-manager";

// === ST Source Code Parsers ===

/**
 * Extract variable direction from a VAR section header.
 * Maps: VAR_INPUT → 'VAR_INPUT', VAR_OUTPUT → 'VAR_OUTPUT', etc.
 */
function varSectionToDirection(header: string): string {
	const upper = header.toUpperCase().trim();
	if (upper.startsWith("VAR_INPUT")) return "VAR_INPUT";
	if (upper.startsWith("VAR_OUTPUT")) return "VAR_OUTPUT";
	if (upper.startsWith("VAR_IN_OUT")) return "VAR_IN_OUT";
	if (upper.startsWith("VAR_TEMP")) return "VAR_TEMP";
	if (upper.startsWith("VAR_GLOBAL")) return "VAR_GLOBAL";
	if (upper.startsWith("VAR_EXTERNAL")) return "VAR_EXTERNAL";
	if (upper.startsWith("VAR_CONSTANT")) return "VAR_CONSTANT";
	if (upper.startsWith("VAR")) return "VAR";
	return "VAR";
}

/**
 * Parse variable declarations from a VAR section.
 * Returns array of { name, varType, line } objects.
 * Handles: varName : TypeName; varName1, varName2 : TypeName;
 */
function parseVarSection(
	content: string,
	startLine: number,
): { name: string; varType: string; line: number }[] {
	const variables: { name: string; varType: string; line: number }[] = [];
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		// Skip empty lines, comments, END_VAR
		if (
			!line ||
			line.startsWith("//") ||
			line.startsWith("(*") ||
			line.toUpperCase() === "END_VAR"
		)
			continue;

		// Match: varName : Type or varName1, varName2 : Type
		// Also handles: varName AT %IX0.0 : Type (direct variables)
		const varMatch = line.match(
			/^([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*(?:AT\s+\S+\s*)?:\s*(.+?);?$/,
		);
		if (varMatch) {
			const names = varMatch[1].split(",").map((n) => n.trim());
			const varType = varMatch[2].replace(/;$/, "").trim();
			for (const name of names) {
				if (name && !name.startsWith("//")) {
					variables.push({ name, varType, line: startLine + i + 1 });
				}
			}
		}
	}

	return variables;
}

/**
 * Extract all variables with directions from ST source code.
 * Returns map: pouName → { direction, variables[] }
 */
export function extractVariablesWithDirections(content: string): Map<
	string,
	{
		direction: string;
		variables: { name: string; varType: string; line: number }[];
	}[]
> {
	const result = new Map<
		string,
		{
			direction: string;
			variables: { name: string; varType: string; line: number }[];
		}[]
	>();
	const lines = content.split("\n");

	// Track current POU context
	let currentPouName: string | null = null;
	let pouVars: {
		direction: string;
		variables: { name: string; varType: string; line: number }[];
	}[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		const upper = line.toUpperCase();

		// Detect POU start: FUNCTION_BLOCK name, PROGRAM name, FUNCTION name, METHOD name
		const pouMatch = line.match(
			/^(?:FUNCTION_BLOCK|PROGRAM|FUNCTION|METHOD)\s+([A-Za-z_][A-Za-z0-9_]*)/i,
		);
		if (pouMatch) {
			// Save previous POU
			if (currentPouName) {
				result.set(currentPouName, pouVars);
			}
			currentPouName = pouMatch[1];
			pouVars = [];
			continue;
		}

		// Detect VAR section start
		const varMatch = line.match(
			/^(VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|VAR_TEMP|VAR_GLOBAL|VAR_EXTERNAL|VAR_CONSTANT|VAR)\b/i,
		);
		if (varMatch && currentPouName) {
			const direction = varSectionToDirection(varMatch[1]);
			// Find END_VAR
			let endLine = i + 1;
			for (let j = i + 1; j < lines.length; j++) {
				if (lines[j].trim().toUpperCase() === "END_VAR") {
					endLine = j;
					break;
				}
			}
			const sectionContent = lines.slice(i + 1, endLine).join("\n");
			const variables = parseVarSection(sectionContent, i + 1);
			if (variables.length > 0) {
				pouVars.push({ direction, variables });
			}
			continue;
		}

		// Detect POU end
		if (
			upper.startsWith("END_FUNCTION_BLOCK") ||
			upper.startsWith("END_PROGRAM") ||
			upper.startsWith("END_FUNCTION") ||
			upper.startsWith("END_METHOD")
		) {
			if (currentPouName) {
				result.set(currentPouName, pouVars);
				currentPouName = null;
				pouVars = [];
			}
		}
	}

	// Save last POU if file doesn't end with END_*
	if (currentPouName) {
		result.set(currentPouName, pouVars);
	}

	return result;
}

/**
 * Extract EXTENDS and IMPLEMENTS clauses from FB declarations.
 * Handles multiline: FUNCTION_BLOCK name EXTENDS Base \n IMPLEMENTS Ifc1, Ifc2
 * Returns map: pouName → { extends?: string, implements?: string[] }
 */
export function extractExtendsImplements(
	content: string,
): Map<string, { extends?: string; implements?: string[] }> {
	const result = new Map<string, { extends?: string; implements?: string[] }>();

	// Strip comments first to avoid false matches from commented code
	const cleanContent = stripComments(content);

	// Use multiline approach: match declaration header that may span multiple lines
	// Pattern: FUNCTION_BLOCK/PROGRAM/CLASS name [EXTENDS base] [IMPLEMENTS ifaces]
	// The declaration can span lines, so we join consecutive lines and search

	// First pass: find all FUNCTION_BLOCK/PROGRAM/CLASS declarations with EXTENDS/IMPLEMENTS
	// We use a multiline regex that allows \n between keywords
	const declRegex =
		/(?:FUNCTION_BLOCK|PROGRAM|CLASS)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+EXTENDS\s+([A-Za-z_][A-Za-z0-9_.]*))?(?:\s+IMPLEMENTS\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*))?/gi;

	// To handle multiline declarations, we normalize: collapse whitespace including newlines
	// between declaration keywords into single spaces
	const normalizedContent = cleanContent
		.replace(/\r?\n/g, " \n")
		.replace(/\s+/g, " ");

	for (const match of normalizedContent.matchAll(declRegex)) {
		const pouName = match[1];
		const extendsType = match[2];
		const implementsList = match[3];

		const entry: { extends?: string; implements?: string[] } = {};

		if (extendsType) {
			entry.extends = extendsType.trim();
		}

		if (implementsList) {
			entry.implements = implementsList
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s);
		}

		if (entry.extends || entry.implements) {
			result.set(pouName, entry);
		}
	}

	return result;
}

/**
 * Extract end lines for POU declarations.
 * Uses stripComments() to avoid matching END_ inside comments like // END_FUNCTION_BLOCK.
 * Returns map: pouName → endLine
 */
export function extractPOUEndLines(content: string): Map<string, number> {
	const result = new Map<string, number>();

	// Strip comments to avoid false matches from commented END_ lines
	const cleanContent = stripComments(content);
	const cleanLines = cleanContent.split("\n");

	// Also parse original content for POU names (declaration lines are the same in both)
	const originalLines = content.split("\n");

	let currentPouName: string | null = null;

	for (let i = 0; i < cleanLines.length; i++) {
		const upper = cleanLines[i].trim().toUpperCase();

		// Detect POU start (use original line for name extraction, fallback to clean line)
		const lineForName = originalLines[i] || cleanLines[i];
		const pouMatch = lineForName.match(
			/^(?:FUNCTION_BLOCK|PROGRAM|FUNCTION|METHOD|CLASS)\s+([A-Za-z_][A-Za-z0-9_]*)/i,
		);
		if (pouMatch) {
			currentPouName = pouMatch[1];
		}

		// Detect POU end — use cleaned line (comments stripped)
		const endMatch = upper.match(
			/^END_(FUNCTION_BLOCK|PROGRAM|FUNCTION|METHOD|CLASS)/,
		);
		if (endMatch && currentPouName) {
			result.set(currentPouName, i + 1);
			currentPouName = null;
		}
	}

	return result;
}

export interface IndexStats {
	totalFiles: number;
	indexedFiles: number;
	skippedFiles: number;
	totalEntities: number;
	totalEdges: number;
	totalTime: number;
}

export interface FileRecord {
	path: string;
	hash: string;
	lastIndexed: number;
	entityCount: number;
}

/**
 * @deprecated CALLS edges are now extracted via LSP callHierarchy (see extractCallsLSP).
 * This regex fallback is kept only as a safety net when LSP returns empty results.
 */
/**
 * Whitelist of standard IEC 61131-3 functions/blocks that should NOT be treated as POU calls.
 * These are built-in language constructs, not user-defined POUs.
 */
const IEC_STANDARD_FUNCTIONS = new Set([
	// Timers
	"TON",
	"TOF",
	"TP",
	"TONR",
	// Triggers/Flip-flops
	"R_TRIG",
	"F_TRIG",
	"SR",
	"RS",
	// Counters
	"CTU",
	"CTD",
	"CTUD",
	// Math: basic
	"ABS",
	"SQRT",
	"LN",
	"LOG",
	"EXP",
	// Math: trigonometric
	"SIN",
	"COS",
	"TAN",
	"ASIN",
	"ACOS",
	"ATAN",
	"ATAN2",
	// Math: arithmetic
	"ADD",
	"SUB",
	"MUL",
	"DIV",
	"MOD",
	"EXPT",
	"MOVE",
	// Comparison
	"GT",
	"GE",
	"EQ",
	"LE",
	"LT",
	"NE",
	// Bitwise
	"AND",
	"OR",
	"XOR",
	"NOT",
	"SHL",
	"SHR",
	"ROL",
	"ROR",
	// Selection
	"SEL",
	"MAX",
	"MIN",
	"LIMIT",
	"MUX",
	// Conversion: common ones (full list is huge, covering patterns)
	"BOOL_TO_BYTE",
	"BOOL_TO_WORD",
	"BOOL_TO_DWORD",
	"BOOL_TO_SINT",
	"BOOL_TO_INT",
	"BOOL_TO_DINT",
	"BOOL_TO_LINT",
	"BOOL_TO_USINT",
	"BOOL_TO_UINT",
	"BOOL_TO_UDINT",
	"BOOL_TO_ULINT",
	"BOOL_TO_REAL",
	"BOOL_TO_LREAL",
	"BOOL_TO_STRING",
	"BOOL_TO_WSTRING",
	"BYTE_TO_BOOL",
	"BYTE_TO_WORD",
	"BYTE_TO_DWORD",
	"BYTE_TO_SINT",
	"BYTE_TO_INT",
	"BYTE_TO_DINT",
	"BYTE_TO_LINT",
	"BYTE_TO_USINT",
	"BYTE_TO_UINT",
	"BYTE_TO_UDINT",
	"BYTE_TO_ULINT",
	"BYTE_TO_REAL",
	"BYTE_TO_LREAL",
	"BYTE_TO_STRING",
	"BYTE_TO_WSTRING",
	"WORD_TO_BOOL",
	"WORD_TO_BYTE",
	"WORD_TO_DWORD",
	"WORD_TO_SINT",
	"WORD_TO_INT",
	"WORD_TO_DINT",
	"WORD_TO_LINT",
	"WORD_TO_USINT",
	"WORD_TO_UINT",
	"WORD_TO_UDINT",
	"WORD_TO_ULINT",
	"WORD_TO_REAL",
	"WORD_TO_LREAL",
	"WORD_TO_STRING",
	"WORD_TO_WSTRING",
	"DWORD_TO_BOOL",
	"DWORD_TO_BYTE",
	"DWORD_TO_WORD",
	"DWORD_TO_SINT",
	"DWORD_TO_INT",
	"DWORD_TO_DINT",
	"DWORD_TO_LINT",
	"DWORD_TO_USINT",
	"DWORD_TO_UINT",
	"DWORD_TO_UDINT",
	"DWORD_TO_ULINT",
	"DWORD_TO_REAL",
	"DWORD_TO_LREAL",
	"DWORD_TO_STRING",
	"DWORD_TO_WSTRING",
	"SINT_TO_BOOL",
	"SINT_TO_BYTE",
	"SINT_TO_WORD",
	"SINT_TO_DWORD",
	"SINT_TO_INT",
	"SINT_TO_DINT",
	"SINT_TO_LINT",
	"SINT_TO_USINT",
	"SINT_TO_UINT",
	"SINT_TO_UDINT",
	"SINT_TO_ULINT",
	"SINT_TO_REAL",
	"SINT_TO_LREAL",
	"SINT_TO_STRING",
	"SINT_TO_WSTRING",
	"INT_TO_BOOL",
	"INT_TO_BYTE",
	"INT_TO_WORD",
	"INT_TO_DWORD",
	"INT_TO_SINT",
	"INT_TO_DINT",
	"INT_TO_LINT",
	"INT_TO_USINT",
	"INT_TO_UINT",
	"INT_TO_UDINT",
	"INT_TO_ULINT",
	"INT_TO_REAL",
	"INT_TO_LREAL",
	"INT_TO_STRING",
	"INT_TO_WSTRING",
	"DINT_TO_BOOL",
	"DINT_TO_BYTE",
	"DINT_TO_WORD",
	"DINT_TO_DWORD",
	"DINT_TO_SINT",
	"DINT_TO_INT",
	"DINT_TO_LINT",
	"DINT_TO_USINT",
	"DINT_TO_UINT",
	"DINT_TO_UDINT",
	"DINT_TO_ULINT",
	"DINT_TO_REAL",
	"DINT_TO_LREAL",
	"DINT_TO_STRING",
	"DINT_TO_WSTRING",
	"LINT_TO_BOOL",
	"LINT_TO_BYTE",
	"LINT_TO_WORD",
	"LINT_TO_DWORD",
	"LINT_TO_SINT",
	"LINT_TO_INT",
	"LINT_TO_DINT",
	"LINT_TO_USINT",
	"LINT_TO_UINT",
	"LINT_TO_UDINT",
	"LINT_TO_ULINT",
	"LINT_TO_REAL",
	"LINT_TO_LREAL",
	"LINT_TO_STRING",
	"LINT_TO_WSTRING",
	"USINT_TO_BOOL",
	"USINT_TO_BYTE",
	"USINT_TO_WORD",
	"USINT_TO_DWORD",
	"USINT_TO_SINT",
	"USINT_TO_INT",
	"USINT_TO_DINT",
	"USINT_TO_LINT",
	"USINT_TO_UINT",
	"USINT_TO_UDINT",
	"USINT_TO_ULINT",
	"USINT_TO_REAL",
	"USINT_TO_LREAL",
	"USINT_TO_STRING",
	"USINT_TO_WSTRING",
	"UINT_TO_BOOL",
	"UINT_TO_BYTE",
	"UINT_TO_WORD",
	"UINT_TO_DWORD",
	"UINT_TO_SINT",
	"UINT_TO_INT",
	"UINT_TO_DINT",
	"UINT_TO_LINT",
	"UINT_TO_USINT",
	"UINT_TO_UDINT",
	"UINT_TO_ULINT",
	"UINT_TO_REAL",
	"UINT_TO_LREAL",
	"UINT_TO_STRING",
	"UINT_TO_WSTRING",
	"UDINT_TO_BOOL",
	"UDINT_TO_BYTE",
	"UDINT_TO_WORD",
	"UDINT_TO_DWORD",
	"UDINT_TO_SINT",
	"UDINT_TO_INT",
	"UDINT_TO_DINT",
	"UDINT_TO_LINT",
	"UDINT_TO_USINT",
	"UDINT_TO_UINT",
	"UDINT_TO_ULINT",
	"UDINT_TO_REAL",
	"UDINT_TO_LREAL",
	"UDINT_TO_STRING",
	"UDINT_TO_WSTRING",
	"ULINT_TO_BOOL",
	"ULINT_TO_BYTE",
	"ULINT_TO_WORD",
	"ULINT_TO_DWORD",
	"ULINT_TO_SINT",
	"ULINT_TO_INT",
	"ULINT_TO_DINT",
	"ULINT_TO_LINT",
	"ULINT_TO_USINT",
	"ULINT_TO_UINT",
	"ULINT_TO_UDINT",
	"ULINT_TO_REAL",
	"ULINT_TO_LREAL",
	"ULINT_TO_STRING",
	"ULINT_TO_WSTRING",
	"REAL_TO_BOOL",
	"REAL_TO_BYTE",
	"REAL_TO_WORD",
	"REAL_TO_DWORD",
	"REAL_TO_SINT",
	"REAL_TO_INT",
	"REAL_TO_DINT",
	"REAL_TO_LINT",
	"REAL_TO_USINT",
	"REAL_TO_UINT",
	"REAL_TO_UDINT",
	"REAL_TO_ULINT",
	"REAL_TO_LREAL",
	"REAL_TO_STRING",
	"REAL_TO_WSTRING",
	"LREAL_TO_BOOL",
	"LREAL_TO_BYTE",
	"LREAL_TO_WORD",
	"LREAL_TO_DWORD",
	"LREAL_TO_SINT",
	"LREAL_TO_INT",
	"LREAL_TO_DINT",
	"LREAL_TO_LINT",
	"LREAL_TO_USINT",
	"LREAL_TO_UINT",
	"LREAL_TO_UDINT",
	"LREAL_TO_ULINT",
	"LREAL_TO_REAL",
	"LREAL_TO_STRING",
	"LREAL_TO_WSTRING",
	"TRUNC",
	"ROUND",
	// String functions
	"LEN",
	"LEFT",
	"RIGHT",
	"MID",
	"CONCAT",
	"INSERT",
	"DELETE",
	"REPLACE",
	"FIND",
	"STRING_TO_BYTE",
	"STRING_TO_WORD",
	"STRING_TO_DWORD",
	"STRING_TO_SINT",
	"STRING_TO_INT",
	"STRING_TO_DINT",
	"STRING_TO_LINT",
	"STRING_TO_USINT",
	"STRING_TO_UINT",
	"STRING_TO_UDINT",
	"STRING_TO_ULINT",
	"STRING_TO_REAL",
	"STRING_TO_LREAL",
	"STRING_TO_WSTRING",
	"WSTRING_TO_BYTE",
	"WSTRING_TO_WORD",
	"WSTRING_TO_DWORD",
	"WSTRING_TO_SINT",
	"WSTRING_TO_INT",
	"WSTRING_TO_DINT",
	"WSTRING_TO_LINT",
	"WSTRING_TO_USINT",
	"WSTRING_TO_UINT",
	"WSTRING_TO_UDINT",
	"WSTRING_TO_ULINT",
	"WSTRING_TO_REAL",
	"WSTRING_TO_LREAL",
	"WSTRING_TO_STRING",
	// System
	"SIZEOF",
	"TYPE_OF",
	"REF",
	"ADR",
	// Date/time conversion
	"TIME_TO_STRING",
	"STRING_TO_TIME",
	"DATE_TO_STRING",
	"STRING_TO_DATE",
	"TOD_TO_STRING",
	"STRING_TO_TOD",
	"DT_TO_STRING",
	"STRING_TO_DT",
	"TIME_TO_LINT",
	"LINT_TO_TIME",
	"DATE_AND_TIME_TO_LINT",
	"LINT_TO_DATE_AND_TIME",
	// Date/time functions
	"ADD",
	"SUB",
	// Control flow keywords (extra safety)
	"IF",
	"ELSIF",
	"WHILE",
	"FOR",
	"CASE",
	"RETURN",
	"THEN",
	"DO",
	"OF",
	"TO",
	"BY",
]);

/**
 * @deprecated Use LSP callHierarchy instead. Kept only as fallback for extractCallsLSP().
 * Extract CALLS edges from ST source code via regex.
 * Matches patterns like: SomeFunction(, FB.Method(, etc.
 * Returns array of { calleeName, line } objects.
 *
 * Filters out IEC 61131-3 standard functions to avoid false positives.
 */
export function extractCalls(
	content: string,
	knownPouNames: Set<string>,
): { calleeName: string; line: number }[] {
	const calls: { calleeName: string; line: number }[] = [];

	const lines = content.split("\n");
	for (let lineNum = 0; lineNum < lines.length; lineNum++) {
		const line = lines[lineNum];
		// Skip comment lines
		const trimmed = line.trim();
		if (
			trimmed.startsWith("//") ||
			trimmed.startsWith("(*") ||
			trimmed.startsWith("/*")
		)
			continue;

		// Find all word( patterns
		const callRegex = /(\b[A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
		for (const match of line.matchAll(callRegex)) {
			const calleeName = match[1];
			// Skip IEC standard functions (timers, math, conversion, string, etc.)
			if (IEC_STANDARD_FUNCTIONS.has(calleeName)) continue;
			// Skip internal names
			if (calleeName.startsWith("_")) continue;

			// Check if this is a known POU name
			if (knownPouNames.has(calleeName)) {
				calls.push({ calleeName, line: lineNum + 1 });
			}
		}
	}

	return calls;
}

/**
 * Convert Entity to STPOU format for SQLite storage.
 */
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

/**
 * Convert Entity to STVariable format.
 */
function entityToVariable(entity: Entity, pouId: string): STVariable | null {
	if (entity.type !== "VARIABLE") return null;
	return {
		id: `st:var:${pouId}:${entity.name}`,
		pou_id: pouId,
		name: entity.name,
		direction: "VAR", // Default; could be extracted from metadata
		var_type: entity.metadata.dataType || "ANY",
		default_value: undefined,
		start_line: entity.line,
		end_line: undefined,
	};
}

/**
 * Convert Entity to STType format.
 */
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

/**
 * Convert Edge to STRelationship format.
 */
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

export class STIndexer {
	private lspClient: LSPClient | null = null;
	private sqliteManager: STSQLiteManager | null = null;
	private fileRecords = new Map<string, FileRecord>();

	// C2 fix: Promise lock to prevent concurrent indexing
	private indexingPromise: Promise<IndexStats> | null = null;

	// Force reindex all files (ignore hash check)
	private forceReindex = false;

	// Telemetry hooks (default no-op; injected by workspaceManager after startTelemetry).
	private readonly hooks: IndexerHooks;

	constructor(
		private lspPath: string,
		public workspaceDir: string,
		sqliteDbPath?: string,
		hooks?: IndexerHooks,
	) {
		const defaultDbPath = join(workspaceDir, ".code-graph-rag", "st-graph.db");
		this.sqliteManager = new STSQLiteManager(sqliteDbPath || defaultDbPath);
		this.hooks = hooks ?? noopHooks;
	}

	async start(): Promise<void> {
		// Initialize SQLite
		this.sqliteManager!.initialize();

		// Load existing file records from SQLite
		const files = this.sqliteManager!.getAllFiles();
		for (const f of files) {
			this.fileRecords.set(f.path, {
				path: f.path,
				hash: f.hash,
				lastIndexed: f.last_indexed,
				entityCount: f.pou_count,
			});
		}

		// Start LSP
		this.lspClient = new LSPClient(this.lspPath);
		await this.lspClient.start();
		console.log("[STIndexer] initialize called");
		await this.lspClient.initialize(`file://${this.workspaceDir}`);
		console.log("[STIndexer] initialize finished, sending initialized");
		this.lspClient.sendNotification("initialized", {});
		console.log("[STIndexer] start finished");
	}

	async stop(): Promise<void> {
		if (this.lspClient) {
			await this.lspClient.stop();
			this.lspClient = null;
		}
		if (this.sqliteManager) {
			this.sqliteManager.close();
			this.sqliteManager = null;
		}
	}

	/**
	 * Find all .st files in workspace.
	 */
	scanFiles(): string[] {
		const files: string[] = [];

		const walk = (dir: string) => {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = join(dir, entry.name);
				if (entry.isDirectory()) {
					walk(fullPath);
				} else if (entry.name.endsWith(".st")) {
					files.push(fullPath);
				}
			}
		};

		walk(this.workspaceDir);

		// Sort: _common.st first, then alphabetical
		files.sort((a, b) => {
			const aName = relative(this.workspaceDir, a);
			const bName = relative(this.workspaceDir, b);
			if (aName.startsWith("_common")) return -1;
			if (bName.startsWith("_common")) return 1;
			return aName.localeCompare(bName);
		});

		return files;
	}

	/**
	 * Check if file needs re-indexing.
	 */
	needsIndexing(filePath: string): boolean {
		if (this.forceReindex) return true;
		const record = this.fileRecords.get(filePath);
		if (!record) return true;

		try {
			const content = readFileSync(filePath, "utf8");
			const hash = createHash("sha256").update(content).digest("hex");
			return hash !== record.hash;
		} catch {
			return true;
		}
	}

	/**
	 * Force reindex all files regardless of hash.
	 */
	setForceReindex(value: boolean): void {
		this.forceReindex = value;
	}

	/**
	 * Index a single file and store in SQLite.
	 * Phase 6: Refactored to 8-stage pipeline.
	 * C1 fix: try/finally ensures closeDocument is always called.
	 */
	async indexFile(
		filePath: string,
		fileIndex?: number,
		totalFiles?: number,
		reporter?: ProgressReporter,
	): Promise<{ entityCount: number; edgeCount: number }> {
		if (!this.lspClient || !this.sqliteManager) {
			throw new Error("Indexer not started");
		}

		const stageEmit = (stage:
			| "preparing"
			| "lsp_open"
			| "parsing"
			| "extracting"
			| "building_edges"
			| "resolving"
			| "persisting"
			| "cleanup"
			| "done"): void => {
			if (fileIndex === undefined || totalFiles === undefined) return;
			const rel = relative(this.workspaceDir, filePath);
			this.hooks.onLspProgress({
				file: rel,
				current: fileIndex + 1,
				total: totalFiles,
				stage,
			});
		};

		// Stage 1: Prepare
		stageEmit("preparing");
		const prepared = prepareStage(filePath, this.workspaceDir);

		// Progress
		if (fileIndex !== undefined && totalFiles !== undefined) {
			reporter?.report({
				current: fileIndex + 1,
				total: totalFiles,
				file: prepared.relativePath,
				status: "indexing",
			});
		}

		// Stage 2: LSP Open
		stageEmit("lsp_open");
		await lspOpenStage(this.lspClient, prepared.uri, prepared.strippedContent);

		try {
			// Stage 3: Parse
			console.error(`[ST Index] Calling parseStage for ${filePath}...`);
			stageEmit("parsing");
			const { entities } = await parseStage(
				this.lspClient,
				prepared.uri,
				filePath,
				prepared.comments,
			);
			console.error(`[ST Index] parseStage finished for ${filePath}`);

			// Stage 4: Extract
			console.error(`[ST Index] Calling extractStage for ${filePath}...`);
			stageEmit("extracting");
			const extracted = extractStage(prepared.originalContent);
			console.error(`[ST Index] extractStage finished for ${filePath}`);

			// Stage 5: Build Edges
			console.error(`[ST Index] Calling buildEdgesStage for ${filePath}...`);
			stageEmit("building_edges");
			const { structuralEdges } = buildEdgesStage(entities);
			console.error(`[ST Index] buildEdgesStage finished for ${filePath}`);

			// Stage 6: Resolve
			console.error(`[ST Index] Calling resolveStage for ${filePath}...`);
			stageEmit("resolving");
			const resolved = resolveStage(
				entities,
				structuralEdges,
				extracted.varsByScope,
				extracted.extendsImplements,
				extracted.pouEndLines,
				filePath,
				this.sqliteManager,
			);
			console.error(`[ST Index] resolveStage finished for ${filePath}`);

			// Extract CALLS edges via LSP (still private method on indexer)
			const callRelationships = await this.extractCallsLSP(
				prepared.uri,
				prepared.originalContent,
				resolved.pous,
				filePath,
			);
			resolved.relationships.push(...callRelationships);

			// Stage 7: Persist
			stageEmit("persisting");
			const persistResult = persistStage(
				{
					filePath,
					hash: prepared.hash,
					pous: resolved.pous,
					variables: resolved.variables,
					types: resolved.types,
					relationships: resolved.relationships,
				},
				this.sqliteManager,
			);

			// Diagnostics
			await saveDiagnostics(
				this.lspClient,
				prepared.uri,
				filePath,
				this.sqliteManager,
			);
			const diags = this.lspClient.getDiagnostics(prepared.uri);
			if (diags && diags.length > 0) {
				const rel = relative(this.workspaceDir, filePath);
				for (const d of diags) {
					this.hooks.onLspDiagnostic({
						file: rel,
						line: d.range.start.line + 1,
						severity: severityToString(d.severity),
						message: d.message,
					});
				}
			}

			// Update file record
			this.fileRecords.set(filePath, {
				path: filePath,
				hash: prepared.hash,
				lastIndexed: Date.now(),
				entityCount: persistResult.entityCount,
			});

			// Progress done
			if (fileIndex !== undefined && totalFiles !== undefined) {
				stageEmit("done");
				reporter?.report({
					current: fileIndex + 1,
					total: totalFiles,
					file: prepared.relativePath,
					status: "done",
					entities: persistResult.entityCount,
					edges: persistResult.edgeCount,
				});
			}

			return persistResult;
		} finally {
			// Stage 8: Cleanup (always, even on error)
			stageEmit("cleanup");
			await cleanupStage(this.lspClient, prepared.uri);
		}
	}

	/**
	 * Index all files in workspace.
	 * C2 fix: Promise lock prevents concurrent indexing.
	 */
	async indexAll(): Promise<IndexStats> {
		// C2 fix: If already indexing, return existing promise
		if (this.indexingPromise) {
			console.error(
				"[ST Index] Indexing already in progress, returning existing promise",
			);
			return this.indexingPromise;
		}

		this.indexingPromise = this._doIndexAll();

		try {
			return await this.indexingPromise;
		} finally {
			this.indexingPromise = null;
		}
	}

	async indexFiles(filePaths: string[]): Promise<IndexStats> {
		const startTime = Date.now();
		const files = filePaths;

		console.error(
			`[ST Index] Indexing ${files.length} specifically requested files in ${this.workspaceDir}`,
		);

		let indexedFiles = 0;
		let skippedFiles = 0;
		let totalEntities = 0;
		let totalEdges = 0;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const relativePath = relative(this.workspaceDir, file);

			if (!this.needsIndexing(file)) {
				skippedFiles++;
				console.error(
					`[ST Index] [${i + 1}/${files.length}] SKIP ${relativePath} (unchanged)`,
				);
				continue;
			}

			try {
				console.error(
					`[ST Index] [${i + 1}/${files.length}] INDEX ${relativePath}...`,
				);
				const { entityCount, edgeCount } = await this.indexFile(file);
				totalEntities += entityCount;
				totalEdges += edgeCount;
				indexedFiles++;
				console.error(
					`[ST Index] [${i + 1}/${files.length}] DONE ${relativePath} (${entityCount} entities, ${edgeCount} edges)`,
				);
			} catch (error) {
				console.error(
					`[ST Index] [${i + 1}/${files.length}] FAILED ${relativePath}:`,
					error,
				);
			}
		}

		// Clean up stale entries (not fully applicable for partial index, but harmless if files still exist)
		const cleanupStats = this.sqliteManager!.cleanStaleEntries();
		console.error(
			`[ST Index] Cleanup: removed ${cleanupStats.removedEntities} stale entities, ${cleanupStats.removedRelationships} stale relationships`,
		);

		return {
			totalFiles: files.length,
			indexedFiles,
			skippedFiles,
			totalEntities,
			totalEdges,
			totalTime: Date.now() - startTime,
		};
	}

	private async _doIndexAll(): Promise<IndexStats> {
		const startTime = Date.now();
		const files = this.scanFiles();

		console.error(
			`[ST Index] Found ${files.length} ST files in ${this.workspaceDir}`,
		);

		this.hooks.onIndexStarted({
			workspace: this.workspaceDir,
			totalFiles: files.length,
		});

		let indexedFiles = 0;
		let skippedFiles = 0;
		let totalEntities = 0;
		let totalEdges = 0;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const relativePath = relative(this.workspaceDir, file);

			if (!this.needsIndexing(file)) {
				skippedFiles++;
				console.error(
					`[ST Index] [${i + 1}/${files.length}] SKIP ${relativePath} (unchanged)`,
				);
				continue;
			}

			try {
				console.error(
					`[ST Index] [${i + 1}/${files.length}] INDEX ${relativePath}...`,
				);
				this.hooks.onIndexFileStarted({
					file: relativePath,
					index: i + 1,
					total: files.length,
				});
				const { entityCount, edgeCount } = await this.indexFile(file);
				totalEntities += entityCount;
				totalEdges += edgeCount;
				indexedFiles++;
				this.hooks.onIndexFileDone({
					file: relativePath,
					index: i + 1,
					total: files.length,
					entities: entityCount,
					edges: edgeCount,
					durationMs: Date.now() - startTime,
				});
				console.error(
					`[ST Index] [${i + 1}/${files.length}] DONE ${relativePath} (${entityCount} entities, ${edgeCount} edges)`,
				);
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);
				this.hooks.onIndexFileFailed({
					file: relativePath,
					index: i + 1,
					total: files.length,
					error: errMsg,
				});
				console.error(
					`[ST Index] [${i + 1}/${files.length}] FAILED ${relativePath}:`,
					error,
				);
			}
		}

		const stats: IndexStats = {
			totalFiles: files.length,
			indexedFiles,
			skippedFiles,
			totalEntities,
			totalEdges,
			totalTime: Date.now() - startTime,
		};

		this.hooks.onIndexDone({
			workspace: this.workspaceDir,
			indexedFiles: stats.indexedFiles,
			skippedFiles: stats.skippedFiles,
			totalEntities: stats.totalEntities,
			totalEdges: stats.totalEdges,
			totalTimeMs: stats.totalTime,
		});

		// Final SQLite snapshot for the dashboard.
		this.emitSqliteStats();

		console.error(
			`[ST Index] Complete: ${stats.indexedFiles}/${stats.totalFiles} indexed, ${stats.skippedFiles} skipped, ${stats.totalEntities} entities, ${stats.totalEdges} edges (${stats.totalTime}ms)`,
		);

		return stats;
	}

	/**
	 * Emit current SQLite graph stats. Safe to call when manager is null.
	 */
	private emitSqliteStats(): void {
		const mgr = this.sqliteManager;
		if (!mgr) return;
		try {
			const health = mgr.getGraphHealth();
			this.hooks.onSqliteStats({
				pous: health.entities.total,
				variables: 0, // not exposed via getGraphHealth; dashboard can derive
				types: 0,
				relationships: health.edges.total,
				files: health.files.total,
				dbBytes: 0,
			});
		} catch {
			// never let telemetry crash the indexer
		}
	}

	/**
	 * Get SQLite manager for direct queries.
	 */
	getSQLiteManager(): STSQLiteManager | null {
		return this.sqliteManager;
	}

	/**
	 * Extract CALLS edges using LSP callHierarchy.
	 * For each POU in the file, calls outgoingCalls to get precise callee targets.
	 * Falls back to regex extractCalls() if LSP returns empty.
	 */
	private async extractCallsLSP(
		uri: string,
		originalContent: string,
		pous: STPOU[],
		filePath: string,
	): Promise<STRelationship[]> {
		const relationships: STRelationship[] = [];
		const lspClient = this.lspClient;
		if (!lspClient) return relationships;

		// Build POU position map for callHierarchy preparation
		const pouPositions = pous.map((p) => ({
			name: p.name,
			id: p.id,
			line: p.start_line,
		}));

		let totalLspCalls = 0;
		let totalFallbackCalls = 0;

		for (const pou of pouPositions) {
				// Prepare call hierarchy at POU declaration line
				const position = { line: pou.line - 1, character: 0 }; // LSP uses 0-based lines
				const items = await lspClient.prepareCallHierarchy(uri, position);

			if (!items || items.length === 0) {
				continue;
			}

			// Get outgoing calls for each call hierarchy item
			for (const item of items) {
				// Workaround: timeout the call to avoid hanging
				let outgoing: any[] = [];
				try {
					outgoing = await Promise.race([
						lspClient.getCallHierarchyOutgoingCalls(item),
						new Promise<any[]>((_, reject) =>
							setTimeout(() => reject(new Error("LSP call timeout")), 1000),
						),
					]);
				} catch (err) {
					console.error(`[ST Index] LSP call timeout for ${item.name}`);
				}
				
				if (!outgoing || outgoing.length === 0) {
					continue;
				}

				for (const call of outgoing) {
					const calleeName = call.to.name;
					// Strip LSP type suffix if present
					const cleanCalleeName = calleeName.includes(" (")
						? calleeName.split(" (")[0]
						: calleeName;

					// Find callee in SQLite
					const calleePou =
						this.sqliteManager?.getPOUByNameExact(cleanCalleeName);
					if (calleePou && calleePou.id !== pou.id) {
						// Use first fromRange for line number
						const line =
							call.fromRanges.length > 0
								? call.fromRanges[0].start.line + 1
								: undefined;
						relationships.push({
							id: `st:rel:call:${filePath}:${pou.name}:${cleanCalleeName}:${line ?? 0}`,
							from_id: pou.id,
							to_id: calleePou.id,
							type: "CALLS",
							file_path: filePath,
							line,
							metadata: JSON.stringify({ context: "lsp_callHierarchy" }),
						});
						totalLspCalls++;
					}
				}
			}
		}

		// Fallback to regex if LSP returned no calls at all
		// NOTE: Regex fallback is always used now because LSP call hierarchy is currently timing out
		if (relationships.length === 0 || true) {
			console.error(
				`[ST Index] LSP callHierarchy returned ${relationships.length} calls, using regex fallback`,
			);
			const knownPouNames = this.sqliteManager!.getAllPOUNames();
			for (const pou of pous) {
				knownPouNames.add(pou.name);
			}

			const calls = extractCalls(originalContent, knownPouNames);
			const pouLineRanges = pous.map((p) => ({
				name: p.name,
				id: p.id,
				startLine: p.start_line,
				endLine: p.end_line || Infinity,
			}));

			for (const call of calls) {
				const callerPou = pouLineRanges.find(
					(p) => call.line >= p.startLine && call.line <= p.endLine,
				);

				if (callerPou) {
					const calleePou = this.sqliteManager!.getPOUByNameExact(
						call.calleeName,
					);
					if (calleePou && calleePou.id !== callerPou.id) {
						relationships.push({
							id: `st:rel:call:${filePath}:${callerPou.name}:${call.calleeName}:${call.line}`,
							from_id: callerPou.id,
							to_id: calleePou.id,
							type: "CALLS",
							file_path: filePath,
							line: call.line,
							metadata: JSON.stringify({ context: "regex_fallback" }),
						});
						totalFallbackCalls++;
					}
				}
			}
		}

		console.error(
			`[ST Index] CALLS edges: ${totalLspCalls} from LSP, ${totalFallbackCalls} from regex fallback`,
		);
		return relationships;
	}
}

/**
 * LSP severity values per the spec:
 *   1 = Error, 2 = Warning, 3 = Information, 4 = Hint
 * Defensive: anything else → "info".
 */
function severityToString(s: number | undefined): "error" | "warning" | "info" | "hint" {
	switch (s) {
		case 1:
			return "error";
		case 2:
			return "warning";
		case 3:
			return "info";
		case 4:
			return "hint";
		default:
			return "info";
	}
}
