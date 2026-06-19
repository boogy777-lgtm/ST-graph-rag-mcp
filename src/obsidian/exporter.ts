/**
 * Obsidian Vault Exporter — main entry.
 *
 * Pipeline:
 *   1. Read all POUs + Types + variables + relationships from STSQLiteManager
 *   2. Render markdown per entity (templates/)
 *   3. Optionally skip files whose SHA256 hasn't changed (incremental mode)
 *   4. Write to vault root under `pous/<name>.md` / `types/<name>.md`
 *   5. Render root MOC index.md
 *   6. Persist cache so the next incremental run is fast
 *
 * Source code is read from the original .st file using
 * start_line..end_line, mirroring the pattern in handleGetEntitySource.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { STSQLiteManager } from "../st/sqlite-manager.js";
import {
	type ExportCache,
	hashContent,
	isChanged,
	loadCache,
	saveCache,
} from "./incremental.js";
import { renderIndex } from "./templates/index.md.js";
import { renderPou } from "./templates/pou.md.js";
import { renderType } from "./templates/type.md.js";
import type {
	IncomingCallEdge,
	PouEntity,
	TypeEntity,
	VariableEntity,
} from "./types.js";

export interface ExportOptions {
	vaultPath: string;
	mode: "full" | "incremental";
	includeMermaid: boolean;
}

export interface ExportStats {
	vaultPath: string;
	mode: "full" | "incremental";
	pousExported: number;
	typesExported: number;
	filesWritten: number;
	filesSkipped: number;
	durationMs: number;
	indexWritten: boolean;
}

const CACHE_FILE_NAME = ".code-graph-rag-cache.json";
const POUS_DIR = "pous";
const TYPES_DIR = "types";
const INDEX_FILE = "_index.md";
const SOURCE_CONTEXT_LINES = 0;

export async function exportObsidianVault(
	manager: STSQLiteManager,
	options: ExportOptions,
): Promise<ExportStats> {
	const startTime = Date.now();
	const vault = resolve(options.vaultPath);
	const cachePath = join(vault, CACHE_FILE_NAME);
	const pousDir = join(vault, POUS_DIR);
	const typesDir = join(vault, TYPES_DIR);

	mkdirSync(pousDir, { recursive: true });
	mkdirSync(typesDir, { recursive: true });

	const prevCache: ExportCache =
		options.mode === "incremental" ? loadCache(cachePath) : {};
	const newCache: ExportCache = {};

	const pous = readPous(manager);
	const types = readTypes(manager);

	const allCalls = readAllCallRelationships(manager);
	const pousById = new Map(pous.map((p) => [p.id, p]));

	let pousExported = 0;
	let filesSkipped = 0;

	for (const pou of pous) {
		const vars = adaptVariables(manager.getVariablesByPOU(pou.id));
		const outgoing = allCalls.outgoingByFrom.get(pou.id) ?? [];
		const incoming = resolveIncoming(
			allCalls.incomingByTo.get(pou.id) ?? [],
			pousById,
		);
		const source = readSource(pou.file_path, pou.start_line, pou.end_line);
		const content = renderPou(pou, vars, outgoing, incoming, source);

		if (
			options.mode === "incremental" &&
			!isChanged(pou.id, content, prevCache)
		) {
			filesSkipped++;
			newCache[pou.id] = prevCache[pou.id] ?? {
				hash: hashContent(content),
				timestamp: Date.now(),
			};
			continue;
		}

		const outFile = join(pousDir, `${pou.name}.md`);
		writeFileSync(outFile, content, "utf-8");
		pousExported++;
		newCache[pou.id] = { hash: hashContent(content), timestamp: Date.now() };
	}

	let typesExported = 0;
	for (const entity of types) {
		const usedBy = findTypeUsages(
			allCalls.incomingByTo,
			entity.id,
			pous,
			pousById,
		);
		const source = readSource(
			entity.file_path,
			entity.start_line,
			entity.end_line,
		);
		const content = renderType(entity, usedBy, source);

		if (
			options.mode === "incremental" &&
			!isChanged(entity.id, content, prevCache)
		) {
			filesSkipped++;
			newCache[entity.id] = prevCache[entity.id] ?? {
				hash: hashContent(content),
				timestamp: Date.now(),
			};
			continue;
		}

		const outFile = join(typesDir, `${entity.name}.md`);
		writeFileSync(outFile, content, "utf-8");
		typesExported++;
		newCache[entity.id] = {
			hash: hashContent(content),
			timestamp: Date.now(),
		};
	}

	const callsForMermaid = allCalls.edges
		.filter((e) => pousById.has(e.from) && pousById.has(e.to))
		.map((e) => ({
			from: pousById.get(e.from)?.name ?? e.from,
			to: pousById.get(e.to)?.name ?? e.to,
		}));

	const indexContent = renderIndex({
		pous,
		types,
		includeMermaid: options.includeMermaid,
		calls: callsForMermaid,
	});
	const indexPath = join(vault, INDEX_FILE);
	writeFileSync(indexPath, indexContent, "utf-8");

	saveCache(cachePath, newCache);

	return {
		vaultPath: vault,
		mode: options.mode,
		pousExported,
		typesExported,
		filesWritten: pousExported + typesExported + 1,
		filesSkipped,
		durationMs: Date.now() - startTime,
		indexWritten: true,
	};
}

function readPous(manager: STSQLiteManager): PouEntity[] {
	return manager.getAllPOUs().map((p) => ({
		id: p.id,
		name: p.name,
		pou_type: p.pou_type,
		file_path: p.file_path,
		start_line: p.start_line,
		end_line: p.end_line ?? null,
		namespace: p.namespace ?? null,
		extends: p.extends ?? null,
		implements: p.implements ?? null,
		signature: p.signature ?? null,
	}));
}

function readTypes(manager: STSQLiteManager): TypeEntity[] {
	return manager.getAllTypes().map((t) => ({
		id: t.id,
		name: t.name,
		type_kind: t.type_kind,
		file_path: t.file_path,
		start_line: t.start_line,
		end_line: t.end_line ?? null,
		definition: t.definition ?? null,
	}));
}

function adaptVariables(
	rows: ReturnType<STSQLiteManager["getVariablesByPOU"]>,
): VariableEntity[] {
	return rows.map((v) => ({
		id: v.id,
		pou_id: v.pou_id,
		name: v.name,
		direction: v.direction,
		var_type: v.var_type,
		default_value: v.default_value ?? null,
		start_line: v.start_line ?? null,
		end_line: v.end_line ?? null,
	}));
}

interface CallCollections {
	edges: Array<{ from: string; to: string }>;
	outgoingByFrom: Map<
		string,
		Array<{
			id: string;
			from_id: string;
			to_id: string;
			type: string;
			file_path: string;
			line: number | null;
		}>
	>;
	incomingByTo: Map<
		string,
		Array<{ id: string; from_id: string; line: number | null }>
	>;
}

function readAllCallRelationships(manager: STSQLiteManager): CallCollections {
	const edges: CallCollections["edges"] = [];
	const outgoingByFrom = new Map<
		string,
		Array<{
			id: string;
			from_id: string;
			to_id: string;
			type: string;
			file_path: string;
			line: number | null;
		}>
	>();
	const incomingByTo = new Map<
		string,
		Array<{ id: string; from_id: string; line: number | null }>
	>();

	for (const pou of manager.getAllPOUs()) {
		for (const r of manager.getOutgoingCalls(pou.id)) {
			if (r.type !== "CALLS") continue;
			edges.push({ from: r.from_id, to: r.to_id });
			const bucket = outgoingByFrom.get(r.from_id) ?? [];
			bucket.push({
				id: r.id,
				from_id: r.from_id,
				to_id: r.to_id,
				type: r.type,
				file_path: r.file_path,
				line: r.line ?? null,
			});
			outgoingByFrom.set(r.from_id, bucket);
		}
		for (const r of manager.getIncomingCalls(pou.id)) {
			if (r.type !== "CALLS") continue;
			const bucket = incomingByTo.get(r.to_id) ?? [];
			bucket.push({ id: r.id, from_id: r.from_id, line: r.line ?? null });
			incomingByTo.set(r.to_id, bucket);
		}
	}

	return { edges, outgoingByFrom, incomingByTo };
}

function resolveIncoming(
	rows: Array<{ id: string; from_id: string; line: number | null }>,
	pousById: Map<string, PouEntity>,
): IncomingCallEdge[] {
	return rows
		.map((r) => {
			const caller = pousById.get(r.from_id);
			if (!caller) return null;
			return {
				id: r.id,
				from_id: r.from_id,
				from_name: caller.name,
				from_file: caller.file_path,
				line: r.line,
			};
		})
		.filter((r): r is IncomingCallEdge => r !== null);
}

function findTypeUsages(
	incomingByTo: Map<
		string,
		Array<{ id: string; from_id: string; line: number | null }>
	>,
	typeId: string,
	_pous: PouEntity[],
	pousById: Map<string, PouEntity>,
): Array<{ name: string; file: string }> {
	const rows = incomingByTo.get(typeId) ?? [];
	return rows
		.map((r) => pousById.get(r.from_id))
		.filter((p): p is PouEntity => p !== undefined)
		.map((p) => ({ name: p.name, file: p.file_path }));
}

function readSource(
	filePath: string,
	startLine: number,
	endLine: number | null,
): string {
	if (!filePath || !existsSync(filePath)) return "";
	try {
		const content = readFileSync(filePath, "utf-8");
		const lines = content.split(/\r?\n/);
		const start = Math.max(1, startLine - SOURCE_CONTEXT_LINES);
		const end = endLine
			? Math.min(lines.length, endLine + SOURCE_CONTEXT_LINES)
			: Math.min(lines.length, startLine + SOURCE_CONTEXT_LINES);
		return lines.slice(start - 1, end).join("\n");
	} catch {
		return "";
	}
}
