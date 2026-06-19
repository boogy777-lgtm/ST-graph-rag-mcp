import type {
	BranchMergeNode,
	BranchSplitNode,
	Coil,
	CompareNode,
	Contact,
	Counter,
	JunctionNode,
	LadderNode,
	LadderProgram,
	MathNode,
	Network,
	Timer,
} from "./ladderEngine.types";
import {
	isCoilType,
	isCompareOp,
	isContactType,
	isCounterType,
	isMathOp,
	isTimerType,
} from "./ladderEngine.types";

export interface PlcopenLdImportResult {
	program: LadderProgram;
	diagnostics: string[];
}

export interface PlcopenLdExportResult {
	xml: string;
	diagnostics: string[];
}

const SUPPORTED_NODE_TAGS = new Set([
	"contact",
	"coil",
	"timer",
	"counter",
	"compare",
	"math",
	"branchSplit",
	"branchMerge",
	"junction",
]);

function parseAttributes(input: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	const regex = /([A-Za-z_:][A-Za-z0-9_:-]*)="([^"]*)"/g;
	let match = regex.exec(input);
	while (match) {
		attributes[match[1]] = decodeXml(match[2]);
		match = regex.exec(input);
	}
	return attributes;
}

function encodeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function decodeXml(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&gt;/g, ">")
		.replace(/&lt;/g, "<")
		.replace(/&amp;/g, "&");
}

function toNumber(value: string | undefined, fallback: number): number {
	if (!value) {
		return fallback;
	}
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : fallback;
}

function parsePoints(
	value: string | undefined,
): Array<{ x: number; y: number }> {
	if (!value) {
		return [];
	}
	const points: Array<{ x: number; y: number }> = [];
	const pairs = value
		.split(";")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	for (const pair of pairs) {
		const [xRaw, yRaw] = pair.split(":");
		const x = Number(xRaw);
		const y = Number(yRaw);
		if (Number.isFinite(x) && Number.isFinite(y)) {
			points.push({ x, y });
		}
	}

	return points;
}

function formatPoints(
	points: Array<{ x: number; y: number }> | undefined,
): string {
	if (!points || points.length === 0) {
		return "";
	}
	return points.map((point) => `${point.x}:${point.y}`).join(";");
}

function parseNode(
	tag: string,
	attrs: Record<string, string>,
	diagnostics: string[],
): LadderNode | undefined {
	const id = attrs.id ?? `${tag}_${Date.now()}`;
	const x = toNumber(attrs.x, 0);
	const y = toNumber(attrs.y, 0);

	if (tag === "contact") {
		if (!attrs.variable) {
			diagnostics.push(
				`contact node '${id}' skipped: missing variable attribute.`,
			);
			return undefined;
		}
		if (!isContactType(attrs.contactType)) {
			diagnostics.push(
				`contact node '${id}' skipped: invalid contactType '${attrs.contactType ?? ""}'.`,
			);
			return undefined;
		}
		const node: Contact = {
			id,
			type: "contact",
			contactType: attrs.contactType,
			variable: attrs.variable,
			position: { x, y },
		};
		return node;
	}

	if (tag === "coil") {
		if (!attrs.variable) {
			diagnostics.push(
				`coil node '${id}' skipped: missing variable attribute.`,
			);
			return undefined;
		}
		if (!isCoilType(attrs.coilType)) {
			diagnostics.push(
				`coil node '${id}' skipped: invalid coilType '${attrs.coilType ?? ""}'.`,
			);
			return undefined;
		}
		const node: Coil = {
			id,
			type: "coil",
			coilType: attrs.coilType,
			variable: attrs.variable,
			position: { x, y },
		};
		return node;
	}

	if (tag === "timer") {
		if (!isTimerType(attrs.timerType)) {
			diagnostics.push(
				`timer node '${id}' skipped: invalid timerType '${attrs.timerType ?? ""}'.`,
			);
			return undefined;
		}
		if (!attrs.instance || attrs.instance.trim().length === 0) {
			diagnostics.push(
				`timer node '${id}' skipped: missing instance attribute.`,
			);
			return undefined;
		}
		if (!attrs.qOutput || attrs.qOutput.trim().length === 0) {
			diagnostics.push(
				`timer node '${id}' skipped: missing qOutput attribute.`,
			);
			return undefined;
		}
		if (!attrs.etOutput || attrs.etOutput.trim().length === 0) {
			diagnostics.push(
				`timer node '${id}' skipped: missing etOutput attribute.`,
			);
			return undefined;
		}
		const node: Timer = {
			id,
			type: "timer",
			timerType: attrs.timerType,
			instance: attrs.instance,
			input: attrs.input,
			presetMs: toNumber(attrs.presetMs, 1000),
			qOutput: attrs.qOutput,
			etOutput: attrs.etOutput,
			position: { x, y },
		};
		return node;
	}

	if (tag === "counter") {
		if (!isCounterType(attrs.counterType)) {
			diagnostics.push(
				`counter node '${id}' skipped: invalid counterType '${attrs.counterType ?? ""}'.`,
			);
			return undefined;
		}
		if (!attrs.instance || attrs.instance.trim().length === 0) {
			diagnostics.push(
				`counter node '${id}' skipped: missing instance attribute.`,
			);
			return undefined;
		}
		if (!attrs.qOutput || attrs.qOutput.trim().length === 0) {
			diagnostics.push(
				`counter node '${id}' skipped: missing qOutput attribute.`,
			);
			return undefined;
		}
		if (!attrs.cvOutput || attrs.cvOutput.trim().length === 0) {
			diagnostics.push(
				`counter node '${id}' skipped: missing cvOutput attribute.`,
			);
			return undefined;
		}
		const node: Counter = {
			id,
			type: "counter",
			counterType: attrs.counterType,
			instance: attrs.instance,
			input: attrs.input,
			preset: toNumber(attrs.preset, 0),
			qOutput: attrs.qOutput,
			cvOutput: attrs.cvOutput,
			position: { x, y },
		};
		return node;
	}

	if (tag === "compare") {
		if (!isCompareOp(attrs.op)) {
			diagnostics.push(
				`compare node '${id}' skipped: invalid op '${attrs.op ?? ""}'.`,
			);
			return undefined;
		}
		const node: CompareNode = {
			id,
			type: "compare",
			op: attrs.op,
			left: attrs.left ?? "0",
			right: attrs.right ?? "0",
			position: { x, y },
		};
		return node;
	}

	if (tag === "math") {
		if (!isMathOp(attrs.op)) {
			diagnostics.push(
				`math node '${id}' skipped: invalid op '${attrs.op ?? ""}'.`,
			);
			return undefined;
		}
		const node: MathNode = {
			id,
			type: "math",
			op: attrs.op,
			left: attrs.left ?? "0",
			right: attrs.right ?? "0",
			output: attrs.output ?? `%MW_LD_MATH_${id}`,
			position: { x, y },
		};
		return node;
	}

	if (tag === "branchSplit") {
		const node: BranchSplitNode = {
			id,
			type: "branchSplit",
			position: { x, y },
		};
		return node;
	}

	if (tag === "branchMerge") {
		const node: BranchMergeNode = {
			id,
			type: "branchMerge",
			position: { x, y },
		};
		return node;
	}

	if (tag === "junction") {
		const node: JunctionNode = {
			id,
			type: "junction",
			position: { x, y },
		};
		return node;
	}

	diagnostics.push(`Unsupported LD node tag '${tag}' skipped.`);
	return undefined;
}

export function importPlcopenLdToSchemaV2(xml: string): PlcopenLdImportResult {
	const diagnostics: string[] = [];
	const networks: Network[] = [];

	const programNameMatch = /<pou\b[^>]*\bname="([^"]+)"/i.exec(xml);
	const programName = programNameMatch
		? decodeXml(programNameMatch[1])
		: "plcopen-ld";

	const networkRegex = /<network\b([^>]*)>([\s\S]*?)<\/network>/gi;
	let networkMatch = networkRegex.exec(xml);
	let networkIndex = 0;

	while (networkMatch) {
		const networkAttrs = parseAttributes(networkMatch[1]);
		const body = networkMatch[2];
		const networkId = networkAttrs.id ?? `network_${networkIndex}`;
		const order = toNumber(networkAttrs.order, networkIndex);
		const layoutY = toNumber(networkAttrs.y, order * 100 + 100);

		const nodes: LadderNode[] = [];
		const edges: Network["edges"] = [];

		const tagRegex = /<([A-Za-z_][A-Za-z0-9_]*)\b([^>]*)\/>/g;
		let tagMatch = tagRegex.exec(body);

		while (tagMatch) {
			const tagName = tagMatch[1];
			const attrs = parseAttributes(tagMatch[2]);

			if (SUPPORTED_NODE_TAGS.has(tagName)) {
				const node = parseNode(tagName, attrs, diagnostics);
				if (node) {
					nodes.push(node);
				}
			} else if (tagName === "edge") {
				if (!attrs.from || !attrs.to) {
					diagnostics.push(
						`Network '${networkId}': edge skipped because 'from' or 'to' is missing.`,
					);
				} else {
					edges.push({
						id: attrs.id ?? `${networkId}_edge_${edges.length}`,
						fromNodeId: attrs.from,
						toNodeId: attrs.to,
						points: parsePoints(attrs.points),
					});
				}
			} else {
				diagnostics.push(
					`Network '${networkId}': unsupported LD construct '<${tagName}/>' skipped.`,
				);
			}

			tagMatch = tagRegex.exec(body);
		}

		networks.push({
			id: networkId,
			order,
			nodes,
			edges,
			layout: {
				y: layoutY,
			},
		});

		networkIndex += 1;
		networkMatch = networkRegex.exec(xml);
	}

	if (networks.length === 0) {
		diagnostics.push("No <network> LD bodies found in PLCopen XML input.");
	}

	return {
		program: {
			schemaVersion: 2,
			networks: networks.sort((left, right) => left.order - right.order),
			variables: [],
			metadata: {
				name: programName,
				description: "Imported from PLCopen LD body",
			},
		},
		diagnostics,
	};
}

function exportNode(
	node: LadderNode,
	diagnostics: string[],
): string | undefined {
	const base = `id="${encodeXml(node.id)}" x="${node.position.x}" y="${node.position.y}"`;

	if (node.type === "contact") {
		return `<contact ${base} contactType="${node.contactType}" variable="${encodeXml(
			node.variable,
		)}" />`;
	}

	if (node.type === "coil") {
		return `<coil ${base} coilType="${node.coilType}" variable="${encodeXml(
			node.variable,
		)}" />`;
	}

	if (node.type === "timer") {
		const inputAttr = node.input ? ` input="${encodeXml(node.input)}"` : "";
		const qOutputAttr = ` qOutput="${encodeXml(node.qOutput)}"`;
		const etOutputAttr = ` etOutput="${encodeXml(node.etOutput)}"`;
		return `<timer ${base} timerType="${node.timerType}" instance="${encodeXml(
			node.instance,
		)}" presetMs="${node.presetMs}"${qOutputAttr}${etOutputAttr}${inputAttr} />`;
	}

	if (node.type === "counter") {
		const inputAttr = node.input ? ` input="${encodeXml(node.input)}"` : "";
		const qOutputAttr = ` qOutput="${encodeXml(node.qOutput)}"`;
		const cvOutputAttr = ` cvOutput="${encodeXml(node.cvOutput)}"`;
		return `<counter ${base} counterType="${node.counterType}" instance="${encodeXml(
			node.instance,
		)}" preset="${node.preset}"${qOutputAttr}${cvOutputAttr}${inputAttr} />`;
	}

	if (node.type === "compare") {
		return `<compare ${base} op="${node.op}" left="${encodeXml(
			node.left,
		)}" right="${encodeXml(node.right)}" />`;
	}

	if (node.type === "math") {
		return `<math ${base} op="${node.op}" left="${encodeXml(
			node.left,
		)}" right="${encodeXml(node.right)}" output="${encodeXml(node.output)}" />`;
	}

	if (node.type === "branchSplit") {
		return `<branchSplit ${base} />`;
	}

	if (node.type === "branchMerge") {
		return `<branchMerge ${base} />`;
	}

	if (node.type === "junction") {
		return `<junction ${base} />`;
	}

	diagnostics.push("Unsupported node skipped during LD export.");
	return undefined;
}

export function exportSchemaV2ToPlcopenLd(
	program: LadderProgram,
	pouName?: string,
): PlcopenLdExportResult {
	const diagnostics: string[] = [];
	const name = pouName || program.metadata.name || "LadderProgram";

	const lines: string[] = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<project xmlns="http://www.plcopen.org/xml/tc6_0200">',
		"  <types>",
		"    <pous>",
		`      <pou name="${encodeXml(name)}" pouType="PROGRAM">`,
		"        <body>",
		"          <LD>",
	];

	const networks = [...program.networks].sort(
		(left, right) => left.order - right.order,
	);
	for (const network of networks) {
		lines.push(
			`            <network id="${encodeXml(network.id)}" order="${network.order}" y="${network.layout.y}">`,
		);

		for (const node of network.nodes) {
			const serialized = exportNode(node, diagnostics);
			if (serialized) {
				lines.push(`              ${serialized}`);
			}
		}

		for (const edge of network.edges) {
			const points = formatPoints(edge.points);
			const pointsAttr = points ? ` points="${encodeXml(points)}"` : "";
			lines.push(
				`              <edge id="${encodeXml(edge.id)}" from="${encodeXml(
					edge.fromNodeId,
				)}" to="${encodeXml(edge.toNodeId)}"${pointsAttr} />`,
			);
		}

		lines.push("            </network>");
	}

	lines.push("          </LD>");
	lines.push("        </body>");
	lines.push("      </pou>");
	lines.push("    </pous>");
	lines.push("  </types>");
	lines.push("</project>");

	return {
		xml: lines.join("\n"),
		diagnostics,
	};
}
