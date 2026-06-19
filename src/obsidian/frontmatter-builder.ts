/**
 * Frontmatter Builder — YAML frontmatter for vault pages.
 *
 * Per MIGRATION_PLAN.md §6 step 3, every POU/TYPE page emits 8 fields:
 *   name, type, file, start_line, end_line, variable_count,
 *   dependencies_count, dependents_count, tags
 *
 * Plus `schema_version: 1` per F6 (re-verified in P1 report): lets a future
 * migration tool detect old vaults and upgrade without data loss.
 *
 * `tags` is serialised as a JSON-style YAML array of quoted strings
 * (Obsidian's tag-picker accepts this format).
 */

import type { PouEntity, TypeEntity } from "./types.js";

export interface FrontmatterContext {
	pou?: PouEntity;
	type?: TypeEntity;
	variableCount: number;
	dependenciesCount: number;
	dependentsCount: number;
	tags: string[];
	schemaVersion?: number;
}

export function buildFrontmatter(ctx: FrontmatterContext): string {
	const entity = ctx.pou ?? ctx.type;
	if (!entity) {
		throw new Error("Frontmatter context requires pou or type");
	}

	const filePath = ctx.pou?.file_path ?? ctx.type?.file_path ?? "";
	const startLine = ctx.pou?.start_line ?? ctx.type?.start_line ?? 0;
	const endLine = ctx.pou?.end_line ?? ctx.type?.end_line ?? 0;
	const typeLabel = ctx.pou?.pou_type ?? ctx.type?.type_kind ?? "UNKNOWN";
	const schemaVersion = ctx.schemaVersion ?? 1;

	const lines: string[] = [
		"---",
		`name: ${entity.name}`,
		`type: ${typeLabel}`,
		`file: ${filePath}`,
		`start_line: ${startLine}`,
		`end_line: ${endLine}`,
		`variable_count: ${ctx.variableCount}`,
		`dependencies_count: ${ctx.dependenciesCount}`,
		`dependents_count: ${ctx.dependentsCount}`,
		`tags: [${ctx.tags.map((t) => `"${t}"`).join(", ")}]`,
		`schema_version: ${schemaVersion}`,
		"---",
	];
	return lines.join("\n");
}
