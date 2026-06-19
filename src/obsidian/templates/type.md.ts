/**
 * TYPE Template — render a TYPE / DUT / ENUM to its Obsidian page.
 *
 * The `definition` field on st_types stores a JSON payload (when available)
 * with the kind-specific shape (enum values, struct fields, etc). When
 * `definition` is missing or unparsable we fall back to a raw display
 * of the original text + the source code block.
 */

import { buildFrontmatter } from "../frontmatter-builder.js";
import type { TypeEntity } from "../types.js";

export function renderType(
	entity: TypeEntity,
	usedBy: Array<{ name: string; file: string }>,
	source: string,
): string {
	const parsed = parseDefinition(entity.definition);
	const frontmatter = buildFrontmatter({
		type: entity,
		variableCount: parsed.fieldCount,
		dependenciesCount: 0,
		dependentsCount: usedBy.length,
		tags: [entity.type_kind.toLowerCase(), "type"],
	});

	const meta = [
		`**Kind:** ${entity.type_kind}`,
		`**File:** \`${entity.file_path}\` (lines ${entity.start_line}–${entity.end_line ?? entity.start_line})`,
		"",
	].join("\n");

	const usedBySection = renderUsedBy(usedBy);
	const definitionSection = renderDefinition(entity, parsed);
	const sourceSection = renderSource(entity, source);

	const parts = [
		frontmatter,
		"",
		`# ${entity.name}`,
		"",
		meta,
		"## Definition",
		"",
		definitionSection,
		"## Used by",
		"",
		usedBySection,
		"## Source",
		"",
		sourceSection,
		"",
	];
	return parts.join("\n");
}

interface ParsedDefinition {
	fieldCount: number;
	enumValues: string[];
	fields: Array<{ name: string; type: string }>;
}

function parseDefinition(raw: string | null): ParsedDefinition {
	if (!raw) return { fieldCount: 0, enumValues: [], fields: [] };
	try {
		const def = JSON.parse(raw) as {
			kind?: string;
			values?: string[];
			fields?: Array<{ name: string; type: string }>;
		};
		return {
			fieldCount: def.fields?.length ?? def.values?.length ?? 0,
			enumValues: def.values ?? [],
			fields: def.fields ?? [],
		};
	} catch {
		return { fieldCount: 0, enumValues: [], fields: [] };
	}
}

function renderDefinition(
	entity: TypeEntity,
	parsed: ParsedDefinition,
): string {
	if (entity.type_kind === "ENUM" && parsed.enumValues.length > 0) {
		const lines = parsed.enumValues.map((v) => `- \`${v}\``);
		return `**Enum values (${parsed.enumValues.length}):**\n\n${lines.join("\n")}`;
	}
	if (parsed.fields.length > 0) {
		const header = "| Field | Type |";
		const sep = "| --- | --- |";
		const rows = parsed.fields.map((f) => `| \`${f.name}\` | \`${f.type}\` |`);
		return `**Fields (${parsed.fields.length}):**\n\n${[header, sep, ...rows].join("\n")}`;
	}
	return entity.definition
		? `\`\`\`\n${entity.definition}\n\`\`\``
		: "_No definition recorded._";
}

function renderUsedBy(usedBy: Array<{ name: string; file: string }>): string {
	if (usedBy.length === 0) return "_No usages recorded._";
	return usedBy
		.map((u) => `- [[${u.name}|${u.file}]]`)
		.sort()
		.join("\n");
}

function renderSource(entity: TypeEntity, source: string): string {
	const body = source || `// source not available for ${entity.name}`;
	return ["```st", body, "```"].join("\n");
}
