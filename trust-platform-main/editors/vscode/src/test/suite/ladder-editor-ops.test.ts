import * as assert from "assert";
import type { LadderProgram, Network } from "../../ladder/ladderEngine.types";
import {
	addParallelContactBranchLeg,
	autoRouteNetwork,
	autoRouteProgram,
	createParallelContactBranch,
	pasteElementIntoNetwork,
	pasteRungIntoProgram,
	reconcileContactCoilVariableDeclarations,
	replaceSymbolInProgram,
} from "../../ladder/webview/editorOps";

function sampleProgram(): LadderProgram {
	return {
		schemaVersion: 2,
		metadata: {
			name: "ops",
			description: "ops",
		},
		variables: [
			{
				name: "%IX0.0",
				type: "BOOL",
				address: "%IX0.0",
			},
			{
				name: "%QX0.0",
				type: "BOOL",
				address: "%QX0.0",
			},
		],
		networks: [
			{
				id: "rung_1",
				order: 0,
				layout: { y: 100 },
				edges: [],
				nodes: [
					{
						id: "c1",
						type: "contact",
						contactType: "NO",
						variable: "%IX0.0",
						position: { x: 100, y: 100 },
					},
					{
						id: "q1",
						type: "coil",
						coilType: "NORMAL",
						variable: "%QX0.0",
						position: { x: 260, y: 100 },
					},
				],
			},
		],
	};
}

function assertEdgeElbowAtX(
	edge: Network["edges"][number],
	expectedX: number,
): void {
	assert.ok(edge.points && edge.points.length >= 4);
	if (!edge.points || edge.points.length < 4) {
		return;
	}
	assert.strictEqual(edge.points[1].x, expectedX);
	assert.strictEqual(edge.points[2].x, expectedX);
}

suite("Ladder webview editor operations", () => {
	test("auto-routes network wires with deterministic edge geometry", () => {
		const network = sampleProgram().networks[0];
		const routed = autoRouteNetwork(network);

		assert.strictEqual(routed.edges.length, 1);
		assert.strictEqual(routed.edges[0].fromNodeId, "c1");
		assert.strictEqual(routed.edges[0].toNodeId, "q1");
		assert.ok((routed.edges[0].points?.length ?? 0) >= 4);
	});

	test("auto-routes all program networks", () => {
		const program = sampleProgram();
		const withSecondNetwork: LadderProgram = {
			...program,
			networks: [
				...program.networks,
				{
					id: "rung_2",
					order: 1,
					layout: { y: 200 },
					edges: [],
					nodes: [
						{
							id: "c2",
							type: "contact",
							contactType: "NC",
							variable: "%IX0.0",
							position: { x: 100, y: 200 },
						},
						{
							id: "q2",
							type: "coil",
							coilType: "NEGATED",
							variable: "%QX0.0",
							position: { x: 260, y: 200 },
						},
					],
				},
			],
		};

		const routed = autoRouteProgram(withSecondNetwork);
		assert.strictEqual(routed.networks[0].edges.length, 1);
		assert.strictEqual(routed.networks[1].edges.length, 1);
	});

	test("replaces ladder symbols across variables and node fields", () => {
		const program = sampleProgram();
		const result = replaceSymbolInProgram(program, "%IX0.0", "%IX1.0");

		assert.ok(result.replacements > 0);
		assert.strictEqual(result.program.variables[0].name, "%IX1.0");
		assert.strictEqual(result.program.variables[0].address, "%IX1.0");

		const replacedContact = result.program.networks[0].nodes.find(
			(node) => node.type === "contact",
		);
		assert.ok(replacedContact && replacedContact.type === "contact");
		assert.strictEqual(
			replacedContact && replacedContact.type === "contact"
				? replacedContact.variable
				: "",
			"%IX1.0",
		);
	});

	test("reconciles contact variable declarations without keeping typing artifacts", () => {
		const program = sampleProgram();
		const withTransientVariables: LadderProgram = {
			...program,
			variables: [
				...program.variables,
				{ name: "t", type: "BOOL", scope: "local", initialValue: false },
				{ name: "te", type: "BOOL", scope: "local", initialValue: false },
				{ name: "tes", type: "BOOL", scope: "local", initialValue: false },
			],
			networks: [
				{
					...program.networks[0],
					nodes: program.networks[0].nodes.map((node) =>
						node.id === "c1" && node.type === "contact"
							? { ...node, variable: "test" }
							: node,
					),
				},
			],
		};

		const reconciled = reconcileContactCoilVariableDeclarations(
			withTransientVariables,
		);
		const localBoolNames = reconciled.variables
			.filter(
				(variable) =>
					variable.type === "BOOL" && (variable.scope ?? "global") === "local",
			)
			.map((variable) => variable.name)
			.sort();

		assert.deepStrictEqual(localBoolNames, ["test"]);
	});

	test("keeps explicit local bool declarations that are not implicit defaults", () => {
		const program = sampleProgram();
		const withExplicitLocal: LadderProgram = {
			...program,
			variables: [
				...program.variables,
				{
					name: "Configured",
					type: "BOOL",
					scope: "local",
					initialValue: true,
				},
			],
		};

		const reconciled =
			reconcileContactCoilVariableDeclarations(withExplicitLocal);
		const hasConfigured = reconciled.variables.some(
			(variable) => variable.name === "Configured",
		);
		assert.strictEqual(hasConfigured, true);
	});

	test("pastes an element into a network with new id and offset", () => {
		const network = sampleProgram().networks[0];
		const sourceElement = network.nodes[0];
		const result = pasteElementIntoNetwork(network, sourceElement, 100);

		assert.strictEqual(result.network.nodes.length, network.nodes.length + 1);
		assert.ok(result.insertedIndex >= 0);

		const inserted = result.network.nodes[result.insertedIndex];
		assert.notStrictEqual(inserted.id, sourceElement.id);
		assert.strictEqual(inserted.position.y, 100);
		assert.ok(inserted.position.x > sourceElement.position.x);
	});

	test("pastes a rung and reorders layout/order fields", () => {
		const base = sampleProgram();
		const source = base.networks[0] as Network;
		const result = pasteRungIntoProgram(base, source, 0);

		assert.strictEqual(result.program.networks.length, 2);
		assert.strictEqual(result.insertedIndex, 1);
		assert.strictEqual(result.program.networks[0].order, 0);
		assert.strictEqual(result.program.networks[1].order, 1);
		assert.strictEqual(result.program.networks[0].layout.y, 100);
		assert.strictEqual(result.program.networks[1].layout.y, 200);
	});

	test("creates a parallel contact branch from a selected series contact", () => {
		const network = sampleProgram().networks[0];
		const result = createParallelContactBranch(network, "c1");
		assert.strictEqual(result.ok, true);
		if (!result.ok) {
			return;
		}

		const branchNetwork = result.network;
		const split = branchNetwork.nodes.find(
			(node) => node.type === "branchSplit",
		);
		const merge = branchNetwork.nodes.find(
			(node) => node.type === "branchMerge",
		);
		const contacts = branchNetwork.nodes.filter(
			(node) => node.type === "contact",
		);
		const original = branchNetwork.nodes.find((node) => node.id === "c1");

		assert.ok(split);
		assert.ok(merge);
		assert.strictEqual(contacts.length, 2);
		assert.strictEqual(branchNetwork.edges.length, 5);
		assert.ok(split && split.position.x >= 80);
		assert.ok(merge && merge.position.x <= 1080);
		assert.ok(original && original.type === "contact");
		if (original && original.type === "contact") {
			assert.strictEqual(original.position.y, 100);
			assert.strictEqual(original.variable, "%IX0.0");
		}

		const created = branchNetwork.nodes.find(
			(node) => node.id === result.selectedNodeId,
		);
		assert.ok(created && created.type === "contact");
		if (created && created.type === "contact") {
			assert.strictEqual(created.variable, "");
		}

		const yValues = contacts
			.map((node) => node.position.y)
			.sort((a, b) => a - b);
		assert.ok(yValues[1] - yValues[0] >= 60);
	});

	test("creates parallel branch on auto-routed simple topology", () => {
		const network = autoRouteNetwork(sampleProgram().networks[0]);
		const result = createParallelContactBranch(network, "c1");
		assert.strictEqual(result.ok, true);
		if (!result.ok) {
			return;
		}
		const branchNodes = result.network.nodes.filter(
			(node) => node.type === "branchSplit" || node.type === "branchMerge",
		);
		assert.strictEqual(branchNodes.length, 2);
	});

	test("routes branch edges through split/merge node x positions", () => {
		const network = sampleProgram().networks[0];
		const result = createParallelContactBranch(network, "c1");
		assert.strictEqual(result.ok, true);
		if (!result.ok) {
			return;
		}

		const split = result.network.nodes.find(
			(node) => node.type === "branchSplit",
		);
		const merge = result.network.nodes.find(
			(node) => node.type === "branchMerge",
		);
		assert.ok(split);
		assert.ok(merge);
		if (!split || !merge) {
			return;
		}

		const splitOutgoing = result.network.edges.filter(
			(edge) => edge.fromNodeId === split.id,
		);
		const mergeIncoming = result.network.edges.filter(
			(edge) => edge.toNodeId === merge.id,
		);
		assert.strictEqual(splitOutgoing.length, 2);
		assert.strictEqual(mergeIncoming.length, 2);
		splitOutgoing.forEach((edge) => assertEdgeElbowAtX(edge, split.position.x));
		mergeIncoming.forEach((edge) => assertEdgeElbowAtX(edge, merge.position.x));
	});

	test("rejects parallel shortcut when there is no horizontal space", () => {
		const cramped: Network = {
			id: "cramped",
			order: 0,
			layout: { y: 100 },
			edges: [],
			nodes: [
				{
					id: "left",
					type: "coil",
					coilType: "NORMAL",
					variable: "%QX0.0",
					position: { x: 140, y: 100 },
				},
				{
					id: "c1",
					type: "contact",
					contactType: "NO",
					variable: "%IX0.0",
					position: { x: 160, y: 100 },
				},
				{
					id: "right",
					type: "coil",
					coilType: "NORMAL",
					variable: "%QX0.1",
					position: { x: 200, y: 100 },
				},
			],
		};
		const result = createParallelContactBranch(cramped, "c1");
		assert.strictEqual(result.ok, false);
		if (result.ok) {
			return;
		}
		assert.strictEqual(result.error, "insufficient-horizontal-space");
	});

	test("adds repeated parallel contact legs on existing branch", () => {
		const base = sampleProgram();
		const first = addParallelContactBranchLeg(base, 0, "c1");
		assert.strictEqual(first.ok, true);
		if (!first.ok) {
			return;
		}
		assert.strictEqual(first.totalParallelLegs, 2);

		const second = addParallelContactBranchLeg(
			first.program,
			0,
			first.selectedNodeId,
		);
		assert.strictEqual(second.ok, true);
		if (!second.ok) {
			return;
		}

		const contacts = second.program.networks[0].nodes
			.filter((node) => node.type === "contact")
			.sort((left, right) => left.position.y - right.position.y);
		assert.strictEqual(second.totalParallelLegs, 3);
		assert.strictEqual(contacts.length, 3);
		assert.strictEqual(contacts[0].position.y, 100);
		assert.strictEqual(contacts[1].position.y, 160);
		assert.strictEqual(contacts[2].position.y, 220);
		assert.strictEqual(contacts[0].variable, "%IX0.0");
		assert.strictEqual(contacts[1].variable, "");
		assert.strictEqual(contacts[2].variable, "");

		const split = second.program.networks[0].nodes.find(
			(node) => node.type === "branchSplit",
		);
		const merge = second.program.networks[0].nodes.find(
			(node) => node.type === "branchMerge",
		);
		assert.ok(split);
		assert.ok(merge);
		if (!split || !merge) {
			return;
		}

		const splitOutgoing = second.program.networks[0].edges.filter(
			(edge) => edge.fromNodeId === split.id,
		);
		const mergeIncoming = second.program.networks[0].edges.filter(
			(edge) => edge.toNodeId === merge.id,
		);
		assert.strictEqual(splitOutgoing.length, 3);
		assert.strictEqual(mergeIncoming.length, 3);
		splitOutgoing.forEach((edge) => assertEdgeElbowAtX(edge, split.position.x));
		mergeIncoming.forEach((edge) => assertEdgeElbowAtX(edge, merge.position.x));
	});

	test("pushes lower rungs down when branch depth increases", () => {
		const base = sampleProgram();
		base.networks.push({
			id: "rung_2",
			order: 1,
			layout: { y: 200 },
			edges: [],
			nodes: [
				{
					id: "c2",
					type: "contact",
					contactType: "NO",
					variable: "%IX0.0",
					position: { x: 100, y: 200 },
				},
				{
					id: "q2",
					type: "coil",
					coilType: "NORMAL",
					variable: "%QX0.0",
					position: { x: 260, y: 200 },
				},
			],
		});

		const first = addParallelContactBranchLeg(base, 0, "c1");
		assert.strictEqual(first.ok, true);
		if (!first.ok) {
			return;
		}
		assert.ok(first.rungShiftAppliedPx > 0);
		assert.strictEqual(first.program.networks[1].layout.y, 240);

		const second = addParallelContactBranchLeg(
			first.program,
			0,
			first.selectedNodeId,
		);
		assert.strictEqual(second.ok, true);
		if (!second.ok) {
			return;
		}
		assert.ok(second.rungShiftAppliedPx > 0);
		assert.strictEqual(second.program.networks[1].layout.y, 300);
	});
});
