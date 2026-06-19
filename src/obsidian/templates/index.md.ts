/**
 * Root Index Template — Map of Content for the entire vault.
 *
 * Lists all POUs grouped by kind, all types, and (optionally) renders
 * a Mermaid graph of CALLS relationships. Always emitted last so the
 * counts reflect the full export.
 */

import type { PouEntity, TypeEntity } from "../types.js";

export interface IndexContext {
	pous: PouEntity[];
	types: TypeEntity[];
	includeMermaid: boolean;
	calls: Array<{ from: string; to: string }>;
}

export function renderIndex(ctx: IndexContext): string {
	const programs = ctx.pous.filter((p) => p.pou_type === "PROGRAM");
	const fbs = ctx.pous.filter((p) => p.pou_type === "FUNCTION_BLOCK");
	const functions = ctx.pous.filter((p) => p.pou_type === "FUNCTION");
	const methods = ctx.pous.filter((p) => p.pou_type === "METHOD");

	const frontmatter = [
		"---",
		"type: INDEX",
		"schema_version: 1",
		`pou_count: ${ctx.pous.length}`,
		`type_count: ${ctx.types.length}`,
		"---",
		"",
	].join("\n");

	const sections: string[] = [
		frontmatter,
		"# ST-Graph Index",
		"",
		`Total: **${ctx.pous.length}** POUs, **${ctx.types.length}** types.`,
		"",
		"## Programs",
		"",
		renderLinkList(programs),
		"## Function Blocks",
		"",
		renderLinkList(fbs),
		"## Functions",
		"",
		renderLinkList(functions),
		"## Methods",
		"",
		renderLinkList(methods),
		"## Types",
		"",
		renderTypeList(ctx.types),
	];

	if (ctx.includeMermaid) {
		sections.push("## Graph", "", renderMermaid(ctx.calls));
	}

	sections.push("");
	return sections.join("\n");
}

function renderLinkList(pous: PouEntity[]): string {
	if (pous.length === 0) return "_None._";
	return pous
		.map((p) => `- [[${p.name}|${p.file_path}]]`)
		.sort((a, b) => a.localeCompare(b))
		.join("\n");
}

function renderTypeList(types: TypeEntity[]): string {
	if (types.length === 0) return "_None._";
	return types
		.map((t) => `- [[${t.name}|${t.file_path}]] (${t.type_kind})`)
		.sort((a, b) => a.localeCompare(b))
		.join("\n");
}

function renderMermaid(calls: Array<{ from: string; to: string }>): string {
	if (calls.length === 0) {
		return "```mermaid\ngraph LR\n  empty[No CALLS relationships]\n```";
	}
	const lines = calls.slice(0, 200).map((c) => {
		const from = mermaidId(c.from);
		const to = mermaidId(c.to);
		return `  ${from} --> ${to}`;
	});
	return ["```mermaid", "graph LR", ...lines, "```"].join("\n");
}

function mermaidId(name: string): string {
	return name.replace(/[^A-Za-z0-9_]/g, "_");
}
