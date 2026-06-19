import * as assert from "assert";
import { SfcEngine } from "../../sfc/sfcEngine";
import type { SfcWorkspace } from "../../sfc/sfcEngine.types";

suite("SfcEngine", () => {
	test("accepts valid parallel split/join topology", () => {
		const workspace: SfcWorkspace = {
			name: "ParallelValid",
			steps: [
				{
					id: "step_init",
					name: "Init",
					initial: true,
					x: 100,
					y: 50,
					actions: [],
				},
				{ id: "step_a", name: "A", x: 60, y: 220, actions: [] },
				{ id: "step_b", name: "B", x: 160, y: 220, actions: [] },
				{ id: "step_end", name: "End", x: 110, y: 380, actions: [] },
			],
			transitions: [
				{
					id: "t_init_split",
					name: "InitToSplit",
					condition: "TRUE",
					sourceStepId: "step_init",
					targetStepId: "split_1",
				},
				{
					id: "t_split_a",
					name: "SplitToA",
					condition: "TRUE",
					sourceStepId: "split_1",
					targetStepId: "step_a",
				},
				{
					id: "t_split_b",
					name: "SplitToB",
					condition: "TRUE",
					sourceStepId: "split_1",
					targetStepId: "step_b",
				},
				{
					id: "t_a_join",
					name: "AToJoin",
					condition: "TRUE",
					sourceStepId: "step_a",
					targetStepId: "join_1",
				},
				{
					id: "t_b_join",
					name: "BToJoin",
					condition: "TRUE",
					sourceStepId: "step_b",
					targetStepId: "join_1",
				},
				{
					id: "t_join_end",
					name: "JoinToEnd",
					condition: "TRUE",
					sourceStepId: "join_1",
					targetStepId: "step_end",
				},
			],
			parallelSplits: [
				{
					id: "split_1",
					name: "Split1",
					x: 110,
					y: 140,
					branchIds: ["step_a", "step_b"],
				},
			],
			parallelJoins: [
				{
					id: "join_1",
					name: "Join1",
					x: 110,
					y: 300,
					branchIds: ["step_a", "step_b"],
					nextStepId: "step_end",
				},
			],
			variables: [],
			metadata: { version: "1.0" },
		};

		const errors = new SfcEngine(workspace).validate();
		assert.strictEqual(errors.length, 0);
	});

	test("rejects split with fewer than two branches", () => {
		const workspace: SfcWorkspace = {
			name: "ParallelInvalidSplit",
			steps: [
				{
					id: "step_init",
					name: "Init",
					initial: true,
					x: 0,
					y: 0,
					actions: [],
				},
				{ id: "step_a", name: "A", x: 0, y: 100, actions: [] },
			],
			transitions: [
				{
					id: "t1",
					name: "InitToSplit",
					condition: "TRUE",
					sourceStepId: "step_init",
					targetStepId: "split_1",
				},
				{
					id: "t2",
					name: "SplitToA",
					condition: "TRUE",
					sourceStepId: "split_1",
					targetStepId: "step_a",
				},
			],
			parallelSplits: [
				{ id: "split_1", name: "Split1", x: 0, y: 50, branchIds: ["step_a"] },
			],
			parallelJoins: [],
			variables: [],
			metadata: { version: "1.0" },
		};

		const errors = new SfcEngine(workspace).validate();
		assert.ok(
			errors.some((error) => error.id === "split_branch_count_split_1"),
		);
	});

	test("rejects join with missing/invalid continuation", () => {
		const workspace: SfcWorkspace = {
			name: "ParallelInvalidJoin",
			steps: [
				{
					id: "step_init",
					name: "Init",
					initial: true,
					x: 0,
					y: 0,
					actions: [],
				},
				{ id: "step_a", name: "A", x: 0, y: 100, actions: [] },
				{ id: "step_b", name: "B", x: 100, y: 100, actions: [] },
			],
			transitions: [
				{
					id: "t1",
					name: "InitToSplit",
					condition: "TRUE",
					sourceStepId: "step_init",
					targetStepId: "split_1",
				},
				{
					id: "t2",
					name: "SplitToA",
					condition: "TRUE",
					sourceStepId: "split_1",
					targetStepId: "step_a",
				},
				{
					id: "t3",
					name: "SplitToB",
					condition: "TRUE",
					sourceStepId: "split_1",
					targetStepId: "step_b",
				},
				{
					id: "t4",
					name: "AToJoin",
					condition: "TRUE",
					sourceStepId: "step_a",
					targetStepId: "join_1",
				},
				{
					id: "t5",
					name: "BToJoin",
					condition: "TRUE",
					sourceStepId: "step_b",
					targetStepId: "join_1",
				},
			],
			parallelSplits: [
				{
					id: "split_1",
					name: "Split1",
					x: 0,
					y: 50,
					branchIds: ["step_a", "step_b"],
				},
			],
			parallelJoins: [
				{
					id: "join_1",
					name: "Join1",
					x: 50,
					y: 150,
					branchIds: ["step_a", "step_b"],
					nextStepId: "step_missing",
				},
			],
			variables: [],
			metadata: { version: "1.0" },
		};

		const errors = new SfcEngine(workspace).validate();
		assert.ok(errors.some((error) => error.id === "join_outgoing_join_1"));
		assert.ok(errors.some((error) => error.id === "join_next_missing_join_1"));
	});
});
