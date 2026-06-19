/**
 * POU Template — render a POU (PROGRAM / FUNCTION_BLOCK / FUNCTION / METHOD)
 * to its Obsidian page. Body includes:
 *   - Heading + meta line (type, file, line range)
 *   - Variables table
 *   - Calls (outgoing edges → wikilinks)
 *   - Called by (incoming edges → wikilinks)
 *   - Source code block
 *
 * All cross-entity references use `[[wikilinks]]` for graph traversal.
 */

import { buildFrontmatter } from "../frontmatter-builder.js";
import type {
	CallEdge,
	IncomingCallEdge,
	PouEntity,
	VariableEntity,
} from "../types.js";
import { slugify, WikilinkSet } from "../wikilink-builder.js";

export function renderPou(
	pou: PouEntity,
	vars: VariableEntity[],
	outgoingCalls: CallEdge[],
	incomingCalls: IncomingCallEdge[],
	source: string,
): string {
	const frontmatter = buildFrontmatter({
		pou,
		variableCount: vars.length,
		dependenciesCount: outgoingCalls.length,
		dependentsCount: incomingCalls.length,
		tags: [pou.pou_type.toLowerCase(), "pou"],
	});

	const meta = renderMeta(pou);
	const varsSection = renderVariables(vars);
	const callsSection = renderOutgoingCalls(pou, outgoingCalls);
	const calledBySection = renderIncomingCalls(incomingCalls);
	const sourceSection = renderSource(pou, source);

	const parts = [
		frontmatter,
		"",
		`# ${pou.name}`,
		"",
		meta,
		"## Variables",
		"",
		varsSection,
		"## Calls",
		"",
		callsSection,
		"## Called by",
		"",
		calledBySection,
		"## Source",
		"",
		sourceSection,
		"",
	];
	return parts.join("\n");
}

function renderMeta(pou: PouEntity): string {
	const lineRange = `${pou.start_line}–${pou.end_line ?? pou.start_line}`;
	const ext = pou.extends ? ` · extends \`${pou.extends}\`` : "";
	const impl = pou.implements ? ` · implements \`${pou.implements}\`` : "";
	return [
		`**Type:** ${pou.pou_type}${ext}${impl}`,
		`**File:** \`${pou.file_path}\` (lines ${lineRange})`,
		"",
	].join("\n");
}

function renderVariables(vars: VariableEntity[]): string {
	if (vars.length === 0) return "_No variables._";
	const header = "| Direction | Name | Type | Default | Line |";
	const sep = "| --- | --- | --- | --- | --- |";
	const rows = vars.map((v) => {
		const def = v.default_value ?? "";
		const line = v.start_line ?? "";
		return `| ${v.direction} | \`${v.name}\` | \`${v.var_type}\` | ${def} | ${line} |`;
	});
	return [header, sep, ...rows].join("\n");
}

function renderOutgoingCalls(pou: PouEntity, calls: CallEdge[]): string {
	if (calls.length === 0) return "_No outgoing calls._";
	const links = new WikilinkSet();
	for (const c of calls) {
		// to_id points to either a POU or TYPE; we render the edge with file
		// to disambiguate when two entities share a slugified name.
		links.add(c.to_id, c.file_path);
	}
	const intro = `Outgoing CALLS (${calls.length}) from [[${slugify(pou.name)}|${pou.file_path}]]:`;
	return [intro, "", links.toMarkdown()].join("\n");
}

function renderIncomingCalls(calls: IncomingCallEdge[]): string {
	if (calls.length === 0) return "_Nothing calls this POU yet._";
	const links = new WikilinkSet();
	for (const c of calls) {
		links.add(c.from_name, c.from_file);
	}
	const intro = `Incoming CALLS (${calls.length}):`;
	return [intro, "", links.toMarkdown()].join("\n");
}

function renderSource(pou: PouEntity, source: string): string {
	const body = source || `// source not available for ${pou.name}`;
	return ["```st", body, "```"].join("\n");
}
