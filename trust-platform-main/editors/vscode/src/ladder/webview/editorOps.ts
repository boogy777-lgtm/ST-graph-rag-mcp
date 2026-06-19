import type {
	LadderElement,
	LadderNode,
	LadderProgram,
	Network,
} from "../ladderEngine.types";

const GRID_SIZE = 20;
const LEFT_RAIL_X = 50;
const RIGHT_RAIL_X = 1100;
const BRANCH_CLEARANCE_FROM_RAIL = 20;
const BRANCH_MIN_HORIZONTAL_SPAN = 80;
const BRANCH_CONTACT_VERTICAL_OFFSET = 60;
const RUNG_CONTENT_BOTTOM_MARGIN = 40;
const RUNG_MIN_VERTICAL_CLEARANCE = 40;

const CONNECTOR_OFFSETS: Record<
	LadderElement["type"],
	{ left: number; right: number }
> = {
	contact: { left: -20, right: 60 },
	coil: { left: -20, right: 60 },
	timer: { left: -20, right: 140 },
	counter: { left: -20, right: 140 },
	compare: { left: -20, right: 140 },
	math: { left: -20, right: 140 },
	branchSplit: { left: 0, right: 0 },
	branchMerge: { left: 0, right: 0 },
	junction: { left: 0, right: 0 },
};

function stableNodeSort(nodes: LadderNode[]): LadderNode[] {
	return [...nodes].sort((left, right) => {
		if (left.position.x !== right.position.x) {
			return left.position.x - right.position.x;
		}
		if (left.position.y !== right.position.y) {
			return left.position.y - right.position.y;
		}
		return left.id.localeCompare(right.id);
	});
}

function connectorOffset(
	type: LadderElement["type"],
	side: "left" | "right",
): number {
	return CONNECTOR_OFFSETS[type][side];
}

function cloneProgram(program: LadderProgram): LadderProgram {
	if (typeof structuredClone === "function") {
		return structuredClone(program);
	}
	return JSON.parse(JSON.stringify(program)) as LadderProgram;
}

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function parseScopedVariableReference(
	value: string,
): { scope?: "local" | "global"; name: string } | undefined {
	const trimmed = value.trim();
	if (!trimmed || trimmed.startsWith("%")) {
		return undefined;
	}
	const upper = trimmed.toUpperCase();
	if (upper.startsWith("LOCAL::")) {
		return { scope: "local", name: trimmed.slice(7).trim() };
	}
	if (upper.startsWith("L::")) {
		return { scope: "local", name: trimmed.slice(3).trim() };
	}
	if (upper.startsWith("GLOBAL::")) {
		return { scope: "global", name: trimmed.slice(8).trim() };
	}
	if (upper.startsWith("G::")) {
		return { scope: "global", name: trimmed.slice(3).trim() };
	}
	if (upper.startsWith("LOCAL.")) {
		return { scope: "local", name: trimmed.slice(6).trim() };
	}
	if (upper.startsWith("GLOBAL.")) {
		return { scope: "global", name: trimmed.slice(7).trim() };
	}
	return { name: trimmed };
}

function normalizeName(name: string): string {
	return name.trim().toUpperCase();
}

function scopedReferenceKey(scope: "local" | "global", name: string): string {
	return `${scope}:${normalizeName(name)}`;
}

function ensureDeclaredBoolVariable(
	variables: LadderProgram["variables"],
	reference: string,
): LadderProgram["variables"] {
	const parsed = parseScopedVariableReference(reference);
	if (!parsed) {
		return variables;
	}
	const name = parsed.name.trim();
	if (!IDENTIFIER_PATTERN.test(name)) {
		return variables;
	}
	const key = normalizeName(name);
	const hasName = variables.some(
		(candidate) => normalizeName(candidate.name) === key,
	);
	if (parsed.scope === undefined && hasName) {
		return variables;
	}
	const scope = parsed.scope ?? "local";
	const existsInScope = variables.some(
		(candidate) =>
			normalizeName(candidate.name) === key &&
			(candidate.scope ?? "global") === scope,
	);
	if (existsInScope) {
		return variables;
	}
	return [
		...variables,
		{
			name,
			type: "BOOL",
			scope,
			initialValue: false,
		},
	];
}

function collectReferencedSymbols(networks: Network[]): {
	scoped: Set<string>;
	unscoped: Set<string>;
} {
	const scoped = new Set<string>();
	const unscoped = new Set<string>();

	const addReference = (raw: unknown) => {
		if (typeof raw !== "string") {
			return;
		}
		const parsed = parseScopedVariableReference(raw);
		if (!parsed) {
			return;
		}
		const name = parsed.name.trim();
		if (!IDENTIFIER_PATTERN.test(name)) {
			return;
		}
		if (parsed.scope) {
			scoped.add(scopedReferenceKey(parsed.scope, name));
			return;
		}
		unscoped.add(normalizeName(name));
	};

	for (const network of networks) {
		for (const node of network.nodes) {
			if ("variable" in node) {
				addReference(node.variable);
			}
			if ("input" in node) {
				addReference(node.input);
			}
			if ("qOutput" in node) {
				addReference(node.qOutput);
			}
			if ("etOutput" in node) {
				addReference(node.etOutput);
			}
			if ("cvOutput" in node) {
				addReference(node.cvOutput);
			}
			if ("left" in node) {
				addReference(node.left);
			}
			if ("right" in node) {
				addReference(node.right);
			}
			if ("output" in node) {
				addReference(node.output);
			}
		}
	}

	return { scoped, unscoped };
}

function isImplicitLocalBoolVariable(
	variable: LadderProgram["variables"][number],
): boolean {
	if ((variable.scope ?? "global") !== "local") {
		return false;
	}
	if (variable.type !== "BOOL") {
		return false;
	}
	if (variable.address?.trim()) {
		return false;
	}
	if (!IDENTIFIER_PATTERN.test(variable.name.trim())) {
		return false;
	}
	if (variable.initialValue === undefined) {
		return true;
	}
	if (typeof variable.initialValue === "boolean") {
		return variable.initialValue === false;
	}
	if (typeof variable.initialValue === "string") {
		const normalized = variable.initialValue.trim().toUpperCase();
		return (
			normalized === "" ||
			normalized === "FALSE" ||
			normalized === "BOOL(FALSE)"
		);
	}
	return false;
}

function isVariableReferenced(
	variable: LadderProgram["variables"][number],
	references: { scoped: Set<string>; unscoped: Set<string> },
): boolean {
	const name = variable.name.trim();
	const scope = (variable.scope ?? "global") as "local" | "global";
	const normalized = normalizeName(name);
	return (
		references.scoped.has(scopedReferenceKey(scope, name)) ||
		references.unscoped.has(normalized)
	);
}

export function reconcileContactCoilVariableDeclarations(
	program: LadderProgram,
): LadderProgram {
	let variables = [...program.variables];

	for (const network of program.networks) {
		for (const node of network.nodes) {
			if (node.type === "contact" || node.type === "coil") {
				variables = ensureDeclaredBoolVariable(variables, node.variable);
			}
		}
	}

	const references = collectReferencedSymbols(program.networks);
	variables = variables.filter(
		(variable) =>
			!isImplicitLocalBoolVariable(variable) ||
			isVariableReferenced(variable, references),
	);

	return {
		...program,
		variables,
	};
}

function nextElementId(element: LadderElement): string {
	return `${element.type}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function replaceAllOccurrences(
	input: string,
	findValue: string,
	replaceValue: string,
): { value: string; replacements: number } {
	if (!findValue) {
		return { value: input, replacements: 0 };
	}
	const parts = input.split(findValue);
	if (parts.length === 1) {
		return { value: input, replacements: 0 };
	}
	return {
		value: parts.join(replaceValue),
		replacements: parts.length - 1,
	};
}

export function autoRouteNetwork(network: Network): Network {
	const sorted = stableNodeSort(network.nodes);
	if (sorted.length < 2) {
		return {
			...network,
			edges: [],
		};
	}

	const edges = [] as Network["edges"];

	for (let index = 0; index < sorted.length - 1; index += 1) {
		const from = sorted[index];
		const to = sorted[index + 1];

		const fromX = from.position.x + connectorOffset(from.type, "right");
		const fromY = from.position.y;
		const toX = to.position.x + connectorOffset(to.type, "left");
		const toY = to.position.y;

		const midX = Math.round((fromX + toX) / 2 / GRID_SIZE) * GRID_SIZE;

		edges.push({
			id: `edge_${network.id}_${index}`,
			fromNodeId: from.id,
			toNodeId: to.id,
			points: [
				{ x: fromX, y: fromY },
				{ x: midX, y: fromY },
				{ x: midX, y: toY },
				{ x: toX, y: toY },
			],
		});
	}

	return {
		...network,
		edges,
	};
}

export function autoRouteProgram(program: LadderProgram): LadderProgram {
	const next = cloneProgram(program);
	next.networks = next.networks.map((network) => autoRouteNetwork(network));
	return next;
}

export function replaceSymbolInProgram(
	program: LadderProgram,
	findValue: string,
	replaceValue: string,
): { program: LadderProgram; replacements: number } {
	if (!findValue) {
		return {
			program,
			replacements: 0,
		};
	}

	const next = cloneProgram(program);
	let replacements = 0;

	for (const variable of next.variables) {
		const name = replaceAllOccurrences(variable.name, findValue, replaceValue);
		variable.name = name.value;
		replacements += name.replacements;

		if (variable.address) {
			const address = replaceAllOccurrences(
				variable.address,
				findValue,
				replaceValue,
			);
			variable.address = address.value;
			replacements += address.replacements;
		}
	}

	for (const network of next.networks) {
		for (const node of network.nodes) {
			if (node.type === "contact") {
				const replaced = replaceAllOccurrences(
					node.variable,
					findValue,
					replaceValue,
				);
				node.variable = replaced.value;
				replacements += replaced.replacements;
			} else if (node.type === "coil") {
				const replaced = replaceAllOccurrences(
					node.variable,
					findValue,
					replaceValue,
				);
				node.variable = replaced.value;
				replacements += replaced.replacements;
			} else if (node.type === "timer") {
				const instance = replaceAllOccurrences(
					node.instance,
					findValue,
					replaceValue,
				);
				node.instance = instance.value;
				replacements += instance.replacements;

				if (node.input) {
					const input = replaceAllOccurrences(
						node.input,
						findValue,
						replaceValue,
					);
					node.input = input.value;
					replacements += input.replacements;
				}

				const qOutput = replaceAllOccurrences(
					node.qOutput,
					findValue,
					replaceValue,
				);
				node.qOutput = qOutput.value;
				replacements += qOutput.replacements;

				const etOutput = replaceAllOccurrences(
					node.etOutput,
					findValue,
					replaceValue,
				);
				node.etOutput = etOutput.value;
				replacements += etOutput.replacements;
			} else if (node.type === "counter") {
				const instance = replaceAllOccurrences(
					node.instance,
					findValue,
					replaceValue,
				);
				node.instance = instance.value;
				replacements += instance.replacements;

				if (node.input) {
					const input = replaceAllOccurrences(
						node.input,
						findValue,
						replaceValue,
					);
					node.input = input.value;
					replacements += input.replacements;
				}

				const qOutput = replaceAllOccurrences(
					node.qOutput,
					findValue,
					replaceValue,
				);
				node.qOutput = qOutput.value;
				replacements += qOutput.replacements;

				const cvOutput = replaceAllOccurrences(
					node.cvOutput,
					findValue,
					replaceValue,
				);
				node.cvOutput = cvOutput.value;
				replacements += cvOutput.replacements;
			} else if (node.type === "compare") {
				const left = replaceAllOccurrences(node.left, findValue, replaceValue);
				node.left = left.value;
				replacements += left.replacements;

				const right = replaceAllOccurrences(
					node.right,
					findValue,
					replaceValue,
				);
				node.right = right.value;
				replacements += right.replacements;
			} else if (node.type === "math") {
				const left = replaceAllOccurrences(node.left, findValue, replaceValue);
				node.left = left.value;
				replacements += left.replacements;

				const right = replaceAllOccurrences(
					node.right,
					findValue,
					replaceValue,
				);
				node.right = right.value;
				replacements += right.replacements;

				const output = replaceAllOccurrences(
					node.output,
					findValue,
					replaceValue,
				);
				node.output = output.value;
				replacements += output.replacements;
			}
		}
	}

	return {
		program: next,
		replacements,
	};
}

export function pasteElementIntoNetwork(
	network: Network,
	element: LadderElement,
	rungY: number,
): { network: Network; insertedIndex: number } {
	const clonedElement: LadderElement = {
		...element,
		id: nextElementId(element),
		position: {
			x: Math.round((element.position.x + 40) / GRID_SIZE) * GRID_SIZE,
			y: rungY,
		},
	};

	const nodes = [...network.nodes, clonedElement];
	return {
		network: {
			...network,
			nodes,
		},
		insertedIndex: nodes.length - 1,
	};
}

export function pasteRungIntoProgram(
	program: LadderProgram,
	sourceRung: Network,
	insertAfterIndex: number,
): { program: LadderProgram; insertedIndex: number } {
	const next = cloneProgram(program);
	const insertIndex = Math.max(
		0,
		Math.min(insertAfterIndex + 1, next.networks.length),
	);

	const clonedRung: Network = {
		...sourceRung,
		id: `rung_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
		nodes: sourceRung.nodes.map((node) => ({
			...node,
			id: `${node.type}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
			position: {
				x: node.position.x,
				y: node.position.y + 100,
			},
		})),
		edges: [],
	};

	next.networks.splice(insertIndex, 0, clonedRung);
	next.networks = next.networks.map((rung, index) => ({
		...rung,
		order: index,
		layout: {
			...rung.layout,
			y: index * 100 + 100,
		},
	}));

	return {
		program: next,
		insertedIndex: insertIndex,
	};
}

export type ParallelContactBranchError =
	| "contact-not-found"
	| "unsupported-topology"
	| "insufficient-horizontal-space"
	| "invalid-anchor";

export type ParallelBranchUpdateError =
	| "rung-not-found"
	| "contact-not-found"
	| "invalid-topology"
	| "unsupported-topology"
	| "insufficient-horizontal-space";

export type ParallelContactBranchResult =
	| {
			ok: true;
			network: Network;
			selectedNodeId: string;
	  }
	| {
			ok: false;
			error: ParallelContactBranchError;
	  };

export type ParallelBranchUpdateResult =
	| {
			ok: true;
			program: LadderProgram;
			selectedNodeId: string;
			rungShiftAppliedPx: number;
			addedVerticalSpanPx: number;
			totalParallelLegs: number;
	  }
	| {
			ok: false;
			error: ParallelBranchUpdateError;
	  };

function snapToGrid(value: number): number {
	return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function clampToRange(value: number, min: number, max: number): number {
	if (min > max) {
		return min;
	}
	return Math.max(min, Math.min(max, value));
}

function buildEdgePoints(from: LadderElement, to: LadderElement) {
	const fromX = from.position.x + connectorOffset(from.type, "right");
	const fromY = from.position.y;
	const toX = to.position.x + connectorOffset(to.type, "left");
	const toY = to.position.y;
	const elbowX =
		to.type === "branchMerge"
			? toX
			: from.type === "branchSplit"
				? fromX
				: snapToGrid((fromX + toX) / 2);

	return [
		{ x: fromX, y: fromY },
		{ x: elbowX, y: fromY },
		{ x: elbowX, y: toY },
		{ x: toX, y: toY },
	];
}

function createEdgeId(networkId: string, index: number): string {
	return `edge_${networkId}_${Date.now()}_${index}`;
}

export function createParallelContactBranch(
	network: Network,
	contactId: string,
): ParallelContactBranchResult {
	const anchor = network.nodes.find(
		(node) => node.id === contactId && node.type === "contact",
	);
	if (!anchor || anchor.type !== "contact") {
		return { ok: false, error: "contact-not-found" };
	}

	if (
		network.nodes.some(
			(node) =>
				node.type === "branchSplit" ||
				node.type === "branchMerge" ||
				node.type === "junction",
		)
	) {
		return { ok: false, error: "unsupported-topology" };
	}

	const sorted = stableNodeSort(network.nodes);
	const anchorIndex = sorted.findIndex((node) => node.id === contactId);
	if (anchorIndex < 0) {
		return { ok: false, error: "contact-not-found" };
	}

	const prev = anchorIndex > 0 ? sorted[anchorIndex - 1] : null;
	const next = anchorIndex < sorted.length - 1 ? sorted[anchorIndex + 1] : null;
	const rungY = network.layout.y;
	const anchorX = snapToGrid(anchor.position.x);
	const anchorY = snapToGrid(anchor.position.y || rungY);
	const minSplitX = snapToGrid(LEFT_RAIL_X + BRANCH_CLEARANCE_FROM_RAIL);
	const maxMergeX = snapToGrid(RIGHT_RAIL_X - BRANCH_CLEARANCE_FROM_RAIL);
	const splitLowerBound = prev
		? Math.max(minSplitX, snapToGrid(prev.position.x + 80))
		: minSplitX;
	const mergeUpperBound = next
		? Math.min(maxMergeX, snapToGrid(next.position.x - 80))
		: maxMergeX;

	if (mergeUpperBound - splitLowerBound < BRANCH_MIN_HORIZONTAL_SPAN) {
		return { ok: false, error: "insufficient-horizontal-space" };
	}

	const preferredSplit = snapToGrid(anchorX - 100);
	const preferredMerge = snapToGrid(anchorX + 100);
	const splitX = clampToRange(
		preferredSplit,
		splitLowerBound,
		mergeUpperBound - BRANCH_MIN_HORIZONTAL_SPAN,
	);
	const mergeX = clampToRange(
		preferredMerge,
		splitX + BRANCH_MIN_HORIZONTAL_SPAN,
		mergeUpperBound,
	);

	if (splitX >= anchorX || mergeX <= anchorX) {
		return { ok: false, error: "insufficient-horizontal-space" };
	}

	const splitNode: LadderElement = {
		id: `branchSplit_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
		type: "branchSplit",
		position: {
			x: splitX,
			y: anchorY,
		},
	};

	const mergeNode: LadderElement = {
		id: `branchMerge_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
		type: "branchMerge",
		position: {
			x: mergeX,
			y: anchorY,
		},
	};

	if (
		splitNode.position.x < minSplitX ||
		mergeNode.position.x > maxMergeX ||
		splitNode.position.x >= mergeNode.position.x
	) {
		return { ok: false, error: "invalid-anchor" };
	}

	const upperContact: LadderElement = {
		...anchor,
		position: {
			x: anchorX,
			y: anchorY,
		},
	};

	const lowerContact: LadderElement = {
		...anchor,
		id: nextElementId(anchor),
		variable: "",
		position: {
			x: anchorX,
			y: snapToGrid(anchorY + BRANCH_CONTACT_VERTICAL_OFFSET),
		},
	};

	const nodes = network.nodes
		.map((node) => (node.id === anchor.id ? upperContact : node))
		.concat([lowerContact, splitNode, mergeNode]);

	const nodeById = new Map<string, LadderElement>();
	nodes.forEach((node) => nodeById.set(node.id, node));

	const edges: Network["edges"] = [];
	let edgeIndex = 0;
	const addEdge = (fromId: string, toId: string) => {
		const from = nodeById.get(fromId);
		const to = nodeById.get(toId);
		if (!from || !to || from.id === to.id) {
			return;
		}
		edges.push({
			id: createEdgeId(network.id, edgeIndex),
			fromNodeId: from.id,
			toNodeId: to.id,
			points: buildEdgePoints(from, to),
		});
		edgeIndex += 1;
	};

	for (let index = 0; index < sorted.length - 1; index += 1) {
		const from = sorted[index];
		const to = sorted[index + 1];
		if (from.id === anchor.id || to.id === anchor.id) {
			continue;
		}
		addEdge(from.id, to.id);
	}

	if (prev) {
		addEdge(prev.id, splitNode.id);
	}
	addEdge(splitNode.id, upperContact.id);
	addEdge(splitNode.id, lowerContact.id);
	addEdge(upperContact.id, mergeNode.id);
	addEdge(lowerContact.id, mergeNode.id);
	if (next) {
		addEdge(mergeNode.id, next.id);
	}

	return {
		ok: true,
		network: {
			...network,
			nodes,
			edges,
		},
		selectedNodeId: lowerContact.id,
	};
}

function shiftNetworkDown(network: Network, deltaY: number): Network {
	if (deltaY <= 0) {
		return network;
	}
	return {
		...network,
		layout: {
			...network.layout,
			y: network.layout.y + deltaY,
		},
		nodes: network.nodes.map((node) => ({
			...node,
			position: {
				x: node.position.x,
				y: node.position.y + deltaY,
			},
		})),
		edges: network.edges.map((edge) => ({
			...edge,
			points: edge.points?.map((point) => ({
				x: point.x,
				y: point.y + deltaY,
			})),
		})),
	};
}

function detectBranchPairForContact(
	network: Network,
	contactId: string,
): { splitId: string; mergeId: string } | null {
	const nodesById = new Map(network.nodes.map((node) => [node.id, node]));
	const incoming = network.edges.filter((edge) => edge.toNodeId === contactId);
	const outgoing = network.edges.filter(
		(edge) => edge.fromNodeId === contactId,
	);

	for (const sourceEdge of incoming) {
		const split = nodesById.get(sourceEdge.fromNodeId);
		if (!split || split.type !== "branchSplit") {
			continue;
		}
		for (const targetEdge of outgoing) {
			const merge = nodesById.get(targetEdge.toNodeId);
			if (!merge || merge.type !== "branchMerge") {
				continue;
			}
			return {
				splitId: split.id,
				mergeId: merge.id,
			};
		}
	}

	return null;
}

function collectBranchLegContacts(
	network: Network,
	splitId: string,
	mergeId: string,
): LadderElement[] {
	const nodesById = new Map(network.nodes.map((node) => [node.id, node]));
	const toMerge = new Set(
		network.edges
			.filter((edge) => edge.toNodeId === mergeId)
			.map((edge) => edge.fromNodeId),
	);
	const legIds = network.edges
		.filter((edge) => edge.fromNodeId === splitId)
		.map((edge) => edge.toNodeId)
		.filter((nodeId) => toMerge.has(nodeId));

	const legs: LadderElement[] = [];
	for (const nodeId of legIds) {
		const node = nodesById.get(nodeId);
		if (node?.type === "contact") {
			legs.push(node);
		}
	}
	return legs;
}

function appendParallelBranchLeg(
	network: Network,
	selectedContactId: string,
):
	| {
			ok: true;
			network: Network;
			selectedNodeId: string;
			totalParallelLegs: number;
			addedVerticalSpanPx: number;
	  }
	| {
			ok: false;
			error: ParallelBranchUpdateError;
	  } {
	const selected = network.nodes.find(
		(node) => node.id === selectedContactId && node.type === "contact",
	);
	if (!selected || selected.type !== "contact") {
		return { ok: false, error: "contact-not-found" };
	}

	const pair = detectBranchPairForContact(network, selectedContactId);
	if (!pair) {
		return { ok: false, error: "invalid-topology" };
	}

	const legs = collectBranchLegContacts(network, pair.splitId, pair.mergeId);
	if (legs.length < 2 || !legs.some((node) => node.id === selectedContactId)) {
		return { ok: false, error: "invalid-topology" };
	}

	const maxLegY = Math.max(...legs.map((node) => node.position.y));
	const minLegY = Math.min(...legs.map((node) => node.position.y));
	const newLeg: LadderElement = {
		...selected,
		id: nextElementId(selected),
		variable: "",
		position: {
			x: snapToGrid(selected.position.x),
			y: snapToGrid(maxLegY + BRANCH_CONTACT_VERTICAL_OFFSET),
		},
	};

	const splitNode = network.nodes.find((node) => node.id === pair.splitId);
	const mergeNode = network.nodes.find((node) => node.id === pair.mergeId);
	if (!splitNode || !mergeNode) {
		return { ok: false, error: "invalid-topology" };
	}

	const nextNetwork: Network = {
		...network,
		nodes: [...network.nodes, newLeg],
		edges: [
			...network.edges,
			{
				id: createEdgeId(network.id, network.edges.length),
				fromNodeId: pair.splitId,
				toNodeId: newLeg.id,
				points: buildEdgePoints(splitNode, newLeg),
			},
			{
				id: createEdgeId(network.id, network.edges.length + 1),
				fromNodeId: newLeg.id,
				toNodeId: pair.mergeId,
				points: buildEdgePoints(newLeg, mergeNode),
			},
		],
	};

	const nextLegs = collectBranchLegContacts(
		nextNetwork,
		pair.splitId,
		pair.mergeId,
	);
	const nextMaxY = Math.max(...nextLegs.map((node) => node.position.y));
	const nextMinY = Math.min(...nextLegs.map((node) => node.position.y));

	return {
		ok: true,
		network: nextNetwork,
		selectedNodeId: newLeg.id,
		totalParallelLegs: nextLegs.length,
		addedVerticalSpanPx: nextMaxY - nextMinY,
	};
}

function computeRungShiftDelta(
	currentNetwork: Network,
	nextRungY: number | undefined,
): number {
	if (nextRungY === undefined) {
		return 0;
	}
	const contentBottom =
		Math.max(...currentNetwork.nodes.map((node) => node.position.y)) +
		RUNG_CONTENT_BOTTOM_MARGIN;
	const requiredNextY = snapToGrid(contentBottom + RUNG_MIN_VERTICAL_CLEARANCE);
	if (nextRungY >= requiredNextY) {
		return 0;
	}
	return snapToGrid(requiredNextY - nextRungY);
}

export function addParallelContactBranchLeg(
	program: LadderProgram,
	rungIndex: number,
	contactId: string,
): ParallelBranchUpdateResult {
	const rung = program.networks[rungIndex];
	if (!rung) {
		return { ok: false, error: "rung-not-found" };
	}

	const selected = rung.nodes.find((node) => node.id === contactId);
	if (!selected || selected.type !== "contact") {
		return { ok: false, error: "contact-not-found" };
	}

	const existingPair = detectBranchPairForContact(rung, contactId);
	let networkResult:
		| {
				ok: true;
				network: Network;
				selectedNodeId: string;
				totalParallelLegs: number;
				addedVerticalSpanPx: number;
		  }
		| {
				ok: false;
				error: ParallelBranchUpdateError;
		  };

	if (existingPair) {
		networkResult = appendParallelBranchLeg(rung, contactId);
	} else {
		const created = createParallelContactBranch(rung, contactId);
		if (!created.ok) {
			return {
				ok: false,
				error:
					created.error === "unsupported-topology"
						? "unsupported-topology"
						: created.error === "insufficient-horizontal-space"
							? "insufficient-horizontal-space"
							: "invalid-topology",
			};
		}

		const pair = detectBranchPairForContact(
			created.network,
			created.selectedNodeId,
		);
		if (!pair) {
			return { ok: false, error: "invalid-topology" };
		}
		const legs = collectBranchLegContacts(
			created.network,
			pair.splitId,
			pair.mergeId,
		);
		const maxY = Math.max(...legs.map((node) => node.position.y));
		const minY = Math.min(...legs.map((node) => node.position.y));
		networkResult = {
			ok: true,
			network: created.network,
			selectedNodeId: created.selectedNodeId,
			totalParallelLegs: legs.length,
			addedVerticalSpanPx: maxY - minY,
		};
	}

	if (!networkResult.ok) {
		return networkResult;
	}

	const nextProgram = cloneProgram(program);
	nextProgram.networks[rungIndex] = networkResult.network;

	const nextRungY = nextProgram.networks[rungIndex + 1]?.layout.y;
	const shiftDelta = computeRungShiftDelta(networkResult.network, nextRungY);
	if (shiftDelta > 0) {
		for (
			let index = rungIndex + 1;
			index < nextProgram.networks.length;
			index += 1
		) {
			nextProgram.networks[index] = shiftNetworkDown(
				nextProgram.networks[index],
				shiftDelta,
			);
		}
	}

	return {
		ok: true,
		program: nextProgram,
		selectedNodeId: networkResult.selectedNodeId,
		rungShiftAppliedPx: shiftDelta,
		addedVerticalSpanPx: networkResult.addedVerticalSpanPx,
		totalParallelLegs: networkResult.totalParallelLegs,
	};
}
