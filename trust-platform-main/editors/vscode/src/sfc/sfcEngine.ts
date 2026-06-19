/**
 * Sequential Function Chart (SFC) Engine
 * Handles SFC workspace management and execution logic
 * Supports both simulation (mock) and hardware (real I/O) execution modes
 */

import type { RuntimeClient } from "../statechart/runtimeClient";
import type {
	SfcExecutionState,
	SfcStep,
	SfcTransition,
	SfcValidationError,
	SfcWorkspace,
	StepId,
	TransitionId,
} from "./sfcEngine.types";

type ExecutionMode = "simulation" | "hardware";

interface TimerState {
	startTime: number;
	duration: number;
}

export class SfcEngine {
	private workspace: SfcWorkspace;
	private executionState: SfcExecutionState;
	private mode: ExecutionMode;
	private runtimeClient?: RuntimeClient;
	private forcedAddresses: Set<string> = new Set();
	private activeTimers: Map<string, TimerState> = new Map();
	private initialized = false;
	private simulationContext: Record<string, any> = {};
	private scanIntervalHandle?: NodeJS.Timeout;

	// Debug state
	private breakpoints: Set<string> = new Set(); // Step IDs with breakpoints
	private isPaused: boolean = false;
	private executionStatus: "stopped" | "running" | "paused" = "stopped";
	private currentDebugStep: string | null = null;
	private stepOverRequested: boolean = false;

	constructor(
		workspace?: SfcWorkspace,
		mode: ExecutionMode = "simulation",
		runtimeClient?: RuntimeClient,
	) {
		this.workspace = workspace ?? this.createEmptyWorkspace();
		this.mode = mode;
		this.runtimeClient = runtimeClient;
		this.executionState = {
			activeSteps: new Set(),
			completedTransitions: new Set(),
			actionStates: new Map(),
			activeParallelJoins: new Map(),
		};
		this.initializeExecution();
	}

	/**
	 * Create an empty SFC workspace
	 */
	private createEmptyWorkspace(): SfcWorkspace {
		const initialStep: SfcStep = {
			id: "step_init",
			name: "Init",
			initial: true,
			x: 200,
			y: 50,
			actions: [],
		};

		return {
			name: "NewSFC",
			steps: [initialStep],
			transitions: [],
			parallelSplits: [],
			parallelJoins: [],
			variables: [],
			metadata: {
				created: new Date().toISOString(),
				version: "1.0",
			},
		};
	}

	/**
	 * Initialize execution state with initial step
	 */
	private initializeExecution(): void {
		const initialSteps = this.workspace.steps.filter((s) => s.initial);
		this.executionState.activeSteps = new Set(initialSteps.map((s) => s.id));
	}

	/**
	 * Get current workspace
	 */
	getWorkspace(): SfcWorkspace {
		return this.workspace;
	}

	/**
	 * Update workspace
	 */
	setWorkspace(workspace: SfcWorkspace): void {
		this.workspace = workspace;
		this.initializeExecution();
	}

	/**
	 * Add a new step
	 */
	addStep(step: SfcStep): void {
		this.workspace.steps.push(step);
	}

	/**
	 * Remove a step
	 */
	removeStep(stepId: StepId): void {
		this.workspace.steps = this.workspace.steps.filter((s) => s.id !== stepId);
		// Also remove related transitions
		this.workspace.transitions = this.workspace.transitions.filter(
			(t) => t.sourceStepId !== stepId && t.targetStepId !== stepId,
		);
	}

	/**
	 * Add a new transition
	 */
	addTransition(transition: SfcTransition): void {
		this.workspace.transitions.push(transition);
	}

	/**
	 * Remove a transition
	 */
	removeTransition(transitionId: TransitionId): void {
		this.workspace.transitions = this.workspace.transitions.filter(
			(t) => t.id !== transitionId,
		);
	}

	/**
	 * Update step position
	 */
	updateStepPosition(stepId: StepId, x: number, y: number): void {
		const step = this.workspace.steps.find((s) => s.id === stepId);
		if (step) {
			step.x = x;
			step.y = y;
		}
	}

	/**
	 * Validate the SFC structure
	 */
	validate(): SfcValidationError[] {
		const errors: SfcValidationError[] = [];
		const parallelSplits = this.workspace.parallelSplits || [];
		const parallelJoins = this.workspace.parallelJoins || [];
		const stepIdSet = new Set(this.workspace.steps.map((step) => step.id));
		const splitIdSet = new Set(parallelSplits.map((split) => split.id));
		const joinIdSet = new Set(parallelJoins.map((join) => join.id));
		const nodeIdSet = new Set([...stepIdSet, ...splitIdSet, ...joinIdSet]);

		const outgoingBySource = new Map<string, SfcTransition[]>();
		const incomingByTarget = new Map<string, SfcTransition[]>();
		for (const transition of this.workspace.transitions) {
			if (!outgoingBySource.has(transition.sourceStepId)) {
				outgoingBySource.set(transition.sourceStepId, []);
			}
			outgoingBySource.get(transition.sourceStepId)!.push(transition);

			if (!incomingByTarget.has(transition.targetStepId)) {
				incomingByTarget.set(transition.targetStepId, []);
			}
			incomingByTarget.get(transition.targetStepId)!.push(transition);
		}

		// Check for initial step
		const initialSteps = this.workspace.steps.filter((s) => s.initial);
		if (initialSteps.length === 0) {
			errors.push({
				id: "no_initial_step",
				type: "step",
				message: "SFC must have at least one initial step",
			});
		}

		// Check for duplicate step names
		const stepNames = new Set<string>();
		for (const step of this.workspace.steps) {
			if (stepNames.has(step.name)) {
				errors.push({
					id: `duplicate_step_${step.id}`,
					type: "step",
					message: `Duplicate step name: ${step.name}`,
					elementId: step.id,
				});
			}
			stepNames.add(step.name);
		}

		// Check transitions reference valid nodes
		for (const transition of this.workspace.transitions) {
			const sourceExists = nodeIdSet.has(transition.sourceStepId);
			const targetExists = nodeIdSet.has(transition.targetStepId);

			if (!sourceExists) {
				errors.push({
					id: `invalid_source_${transition.id}`,
					type: "transition",
					message: `Transition references non-existent source node: ${transition.sourceStepId}`,
					elementId: transition.id,
				});
			}

			if (!targetExists) {
				errors.push({
					id: `invalid_target_${transition.id}`,
					type: "transition",
					message: `Transition references non-existent target node: ${transition.targetStepId}`,
					elementId: transition.id,
				});
			}

			if (!transition.condition || transition.condition.trim() === "") {
				errors.push({
					id: `empty_condition_${transition.id}`,
					type: "transition",
					message: `Transition must have a condition`,
					elementId: transition.id,
				});
			}
		}

		// Validate parallel split structure and connectivity
		for (const split of parallelSplits) {
			if (split.branchIds.length < 2) {
				errors.push({
					id: `split_branch_count_${split.id}`,
					type: "connection",
					message: `Parallel split ${split.name} must define at least 2 branches`,
					elementId: split.id,
				});
			}

			for (const branchId of split.branchIds) {
				if (!stepIdSet.has(branchId)) {
					errors.push({
						id: `split_invalid_branch_${split.id}_${branchId}`,
						type: "connection",
						message: `Parallel split ${split.name} references unknown branch step: ${branchId}`,
						elementId: split.id,
					});
				}
			}

			const splitIncoming = incomingByTarget.get(split.id) || [];
			if (splitIncoming.length !== 1) {
				errors.push({
					id: `split_incoming_${split.id}`,
					type: "connection",
					message: `Parallel split ${split.name} must have exactly one incoming transition`,
					elementId: split.id,
				});
			}

			const splitOutgoing = outgoingBySource.get(split.id) || [];
			for (const branchId of split.branchIds) {
				const outgoingToBranch = splitOutgoing.filter(
					(transition) => transition.targetStepId === branchId,
				);
				if (outgoingToBranch.length !== 1) {
					errors.push({
						id: `split_outgoing_${split.id}_${branchId}`,
						type: "connection",
						message: `Parallel split ${split.name} must connect to branch ${branchId} exactly once`,
						elementId: split.id,
					});
				}
			}

			for (const transition of splitOutgoing) {
				if (!split.branchIds.includes(transition.targetStepId)) {
					errors.push({
						id: `split_extra_target_${split.id}_${transition.id}`,
						type: "connection",
						message: `Parallel split ${split.name} has transition ${transition.id} to non-branch target ${transition.targetStepId}`,
						elementId: split.id,
					});
				}
			}
		}

		// Validate parallel join structure and connectivity
		for (const join of parallelJoins) {
			if (join.branchIds.length < 2) {
				errors.push({
					id: `join_branch_count_${join.id}`,
					type: "connection",
					message: `Parallel join ${join.name} must define at least 2 branches`,
					elementId: join.id,
				});
			}

			for (const branchId of join.branchIds) {
				if (!stepIdSet.has(branchId)) {
					errors.push({
						id: `join_invalid_branch_${join.id}_${branchId}`,
						type: "connection",
						message: `Parallel join ${join.name} references unknown branch step: ${branchId}`,
						elementId: join.id,
					});
				}
			}

			const joinIncoming = incomingByTarget.get(join.id) || [];
			for (const branchId of join.branchIds) {
				const incomingFromBranch = joinIncoming.filter(
					(transition) => transition.sourceStepId === branchId,
				);
				if (incomingFromBranch.length !== 1) {
					errors.push({
						id: `join_incoming_${join.id}_${branchId}`,
						type: "connection",
						message: `Parallel join ${join.name} must receive branch ${branchId} exactly once`,
						elementId: join.id,
					});
				}
			}

			for (const transition of joinIncoming) {
				if (!join.branchIds.includes(transition.sourceStepId)) {
					errors.push({
						id: `join_extra_source_${join.id}_${transition.id}`,
						type: "connection",
						message: `Parallel join ${join.name} has transition ${transition.id} from non-branch source ${transition.sourceStepId}`,
						elementId: join.id,
					});
				}
			}

			const joinOutgoing = outgoingBySource.get(join.id) || [];
			if (joinOutgoing.length !== 1) {
				errors.push({
					id: `join_outgoing_${join.id}`,
					type: "connection",
					message: `Parallel join ${join.name} must have exactly one outgoing transition`,
					elementId: join.id,
				});
			}

			if (join.nextStepId) {
				if (!stepIdSet.has(join.nextStepId)) {
					errors.push({
						id: `join_next_missing_${join.id}`,
						type: "connection",
						message: `Parallel join ${join.name} references unknown next step: ${join.nextStepId}`,
						elementId: join.id,
					});
				}
				const nextTransition = joinOutgoing[0];
				if (nextTransition && nextTransition.targetStepId !== join.nextStepId) {
					errors.push({
						id: `join_next_mismatch_${join.id}`,
						type: "connection",
						message: `Parallel join ${join.name} nextStepId (${join.nextStepId}) does not match outgoing transition target (${nextTransition.targetStepId})`,
						elementId: join.id,
					});
				}
			}
		}

		return errors;
	}

	/**
	 * Generate Structured Text code from SFC
	 */
	generateStructuredText(): string {
		const lines: string[] = [];

		// Program header
		lines.push(`PROGRAM ${this.workspace.name}`);
		lines.push("");

		// Variable declarations
		if (this.workspace.variables && this.workspace.variables.length > 0) {
			lines.push("VAR");
			for (const variable of this.workspace.variables) {
				const init = variable.initialValue
					? ` := ${variable.initialValue}`
					: "";
				const comment = variable.comment ? ` // ${variable.comment}` : "";
				lines.push(`  ${variable.name} : ${variable.type}${init};${comment}`);
			}
			lines.push("END_VAR");
			lines.push("");
		}

		// SFC state variables
		lines.push("VAR");
		for (const step of this.workspace.steps) {
			lines.push(
				`  ${step.name}_active : BOOL := ${step.initial ? "TRUE" : "FALSE"};`,
			);
		}
		lines.push("END_VAR");
		lines.push("");

		// Main logic
		lines.push("// SFC Logic");
		lines.push("// Steps and transitions");

		for (const transition of this.workspace.transitions) {
			const sourceStep = this.workspace.steps.find(
				(s) => s.id === transition.sourceStepId,
			);
			const targetStep = this.workspace.steps.find(
				(s) => s.id === transition.targetStepId,
			);

			if (sourceStep && targetStep) {
				lines.push("");
				lines.push(`// Transition: ${sourceStep.name} -> ${targetStep.name}`);
				lines.push(
					`IF ${sourceStep.name}_active AND (${transition.condition}) THEN`,
				);
				lines.push(`  ${sourceStep.name}_active := FALSE;`);
				lines.push(`  ${targetStep.name}_active := TRUE;`);
				lines.push("END_IF;");
			}
		}

		lines.push("");
		lines.push("// Step actions");
		for (const step of this.workspace.steps) {
			if (step.actions && step.actions.length > 0) {
				lines.push("");
				lines.push(`IF ${step.name}_active THEN`);
				for (const action of step.actions) {
					lines.push(`  // Action: ${action.name} (${action.qualifier})`);
					if (action.body) {
						const bodyLines = action.body.split("\n");
						for (const bodyLine of bodyLines) {
							lines.push(`  ${bodyLine}`);
						}
					}
				}
				lines.push("END_IF;");
			}
		}

		lines.push("");
		lines.push("END_PROGRAM");

		return lines.join("\n");
	}

	/**
	 * Initialize execution engine
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		console.log(`🎯 SFC Engine initialized in ${this.mode} mode`);

		// Initialize workspace variables in simulation context
		if (this.workspace.variables) {
			for (const variable of this.workspace.variables) {
				const initialValue = this.parseInitialValue(
					variable.initialValue,
					variable.type,
				);
				this.simulationContext[variable.name] = initialValue;
				console.log(
					`📋 Initialized variable: ${variable.name} = ${initialValue} (${variable.type})`,
				);
			}
		}

		// Set start_button to TRUE automatically to allow the SFC to start
		if ("start_button" in this.simulationContext) {
			this.simulationContext["start_button"] = true;
			console.log(`🔘 Auto-activated start_button = TRUE`);
		}

		// Log initial active steps
		const initialSteps = Array.from(this.executionState.activeSteps);
		console.log(`🎬 Initial active steps: ${initialSteps.join(", ")}`);

		// Execute initial actions
		for (const stepId of this.executionState.activeSteps) {
			const step = this.workspace.steps.find((s) => s.id === stepId);
			if (step) {
				console.log(`▶️ Executing initial actions for step: ${step.name}`);
				await this.executeStepActions(step);
			}
		}

		this.initialized = true;
	}

	/**
	 * Parse initial value from string to native type
	 */
	private parseInitialValue(
		initialValue: string | undefined,
		type: string,
	): any {
		if (!initialValue) {
			return this.getDefaultValue(type);
		}

		const upper = initialValue.toUpperCase();

		if (upper === "TRUE") return true;
		if (upper === "FALSE") return false;

		// TIME type: T#300ms, T#2s, etc.
		const timeMatch = initialValue.match(/T#(\d+)(ms|s|m|h)/i);
		if (timeMatch) {
			const value = parseInt(timeMatch[1], 10);
			const unit = timeMatch[2].toLowerCase();
			switch (unit) {
				case "ms":
					return value;
				case "s":
					return value * 1000;
				case "m":
					return value * 60000;
				case "h":
					return value * 3600000;
			}
		}

		// Numeric
		const num = Number(initialValue);
		if (!isNaN(num)) return num;

		return initialValue;
	}

	/**
	 * Get default value for a type
	 */
	private getDefaultValue(type: string): any {
		const upper = type.toUpperCase();
		if (upper === "BOOL") return false;
		if (upper === "TIME") return 0;
		if (upper.includes("INT")) return 0;
		if (upper.includes("REAL")) return 0.0;
		return null;
	}

	/**
	 * Start automatic execution with scan cycle
	 */
	async start(scanCycleMs: number = 100): Promise<void> {
		await this.initialize();

		if (this.scanIntervalHandle) {
			return; // Already running
		}

		this.executionStatus = "running";
		this.isPaused = false;
		console.log(`🚀 SFC execution started (scan: ${scanCycleMs}ms)`);

		this.scanIntervalHandle = setInterval(async () => {
			await this.executeCycleInternal();
		}, scanCycleMs);
	}

	/**
	 * Stop execution
	 */
	async stop(): Promise<void> {
		if (this.scanIntervalHandle) {
			clearInterval(this.scanIntervalHandle);
			this.scanIntervalHandle = undefined;
		}

		this.executionStatus = "stopped";
		this.isPaused = false;
		this.currentDebugStep = null;
		await this.cleanup();
		console.log(`⏹️ SFC execution stopped`);
	}

	/**
	 * Cleanup: release all forced I/O addresses and cancel timers
	 */
	async cleanup(): Promise<void> {
		// Clear all timers
		this.activeTimers.clear();

		// Release forced I/O
		if (
			this.mode === "hardware" &&
			this.runtimeClient &&
			this.forcedAddresses.size > 0
		) {
			console.log(
				`🧹 Releasing ${this.forcedAddresses.size} forced addresses...`,
			);
			for (const address of this.forcedAddresses) {
				try {
					await this.runtimeClient.unforceIo(address);
				} catch (error) {
					console.error(`Failed to unforce ${address}:`, error);
				}
			}
			this.forcedAddresses.clear();
		}
	}

	/**
	 * Debug: Pause execution
	 */
	pause(): void {
		if (this.executionStatus === "running") {
			this.isPaused = true;
			this.executionStatus = "paused";
			const activeSteps = Array.from(this.executionState.activeSteps);
			this.currentDebugStep = activeSteps[0] || null;
			console.log(`⏸️ Execution paused`);
		}
	}

	/**
	 * Debug: Resume execution from pause
	 */
	resume(): void {
		if (this.executionStatus === "paused") {
			this.isPaused = false;
			this.executionStatus = "running";
			this.currentDebugStep = null;
			console.log(`▶️ Execution resumed`);
		}
	}

	/**
	 * Debug: Execute one step and pause (step-over)
	 */
	stepOver(): void {
		if (this.executionStatus === "paused") {
			this.stepOverRequested = true;
			console.log(`⏭️ Step over`);
			// The next cycle will execute once and pause again
		}
	}

	/**
	 * Debug: Toggle breakpoint on a step
	 */
	toggleBreakpoint(stepId: string): void {
		if (this.breakpoints.has(stepId)) {
			this.breakpoints.delete(stepId);
			console.log(`🔵 Breakpoint removed from step: ${stepId}`);
		} else {
			this.breakpoints.add(stepId);
			console.log(`🔴 Breakpoint added to step: ${stepId}`);
		}
	}

	/**
	 * Debug: Get current breakpoints
	 */
	getBreakpoints(): string[] {
		return Array.from(this.breakpoints);
	}

	/**
	 * Debug: Get execution status
	 */
	getExecutionStatus(): "stopped" | "running" | "paused" {
		return this.executionStatus;
	}

	/**
	 * Debug: Get current debug step (when paused)
	 */
	getCurrentDebugStep(): string | null {
		return this.currentDebugStep;
	}

	/**
	 * Execute one scan cycle (internal)
	 */
	private async executeCycleInternal(): Promise<void> {
		// Skip execution if paused (unless step-over was requested)
		if (this.isPaused && !this.stepOverRequested) {
			return;
		}

		// Clear step-over flag after executing one cycle
		if (this.stepOverRequested) {
			this.stepOverRequested = false;
		}

		const now = Date.now();

		// Update tick_timer if it exists in workspace variables
		if ("tick_timer" in this.simulationContext) {
			// Increment tick_timer by scan cycle time (100ms by default)
			this.simulationContext["tick_timer"] =
				(this.simulationContext["tick_timer"] || 0) + 100;
			// Reset after reaching maximum to prevent overflow
			if (this.simulationContext["tick_timer"] > 10000) {
				this.simulationContext["tick_timer"] = 0;
			}
		}

		const activeSteps = Array.from(this.executionState.activeSteps);

		// Check for breakpoints in active steps
		for (const stepId of activeSteps) {
			if (this.breakpoints.has(stepId) && !this.isPaused) {
				console.log(`🔴 Breakpoint hit at step: ${stepId}`);
				this.isPaused = true;
				this.executionStatus = "paused";
				this.currentDebugStep = stepId;
				return; // Stop execution at this cycle
			}
		}

		// Evaluate transitions from active steps
		for (const stepId of activeSteps) {
			const outgoingTransitions = this.workspace.transitions.filter(
				(t) => t.sourceStepId === stepId,
			);

			for (const transition of outgoingTransitions) {
				const conditionMet = await this.evaluateTransitionCondition(
					transition,
					now,
				);

				console.log(
					`🔍 Evaluating transition ${transition.name || transition.id}: condition="${transition.condition}" => ${conditionMet}`,
				);

				if (conditionMet) {
					console.log(
						`🔄 Transition fired: ${transition.name || transition.id}`,
					);

					// Deactivate source step
					this.executionState.activeSteps.delete(transition.sourceStepId);

					// Execute exit actions
					const sourceStep = this.workspace.steps.find(
						(s) => s.id === transition.sourceStepId,
					);
					if (sourceStep) {
						await this.executeStepExitActions(sourceStep);
					}

					// Activate target step
					this.executionState.activeSteps.add(transition.targetStepId);

					// Reset tick_timer on step transition
					if ("tick_timer" in this.simulationContext) {
						this.simulationContext["tick_timer"] = 0;
					}

					// Execute entry actions
					const targetStep = this.workspace.steps.find(
						(s) => s.id === transition.targetStepId,
					);
					if (targetStep) {
						await this.executeStepActions(targetStep);
					}

					// Mark transition as completed
					this.executionState.completedTransitions.add(transition.id);

					// Clear timer for this transition
					this.activeTimers.delete(transition.id);
				}
			}
		}

		// Handle parallel splits: check if any active step triggers a parallel split
		await this.handleParallelSplits();

		// Handle parallel joins: check if all branches completed
		await this.handleParallelJoins();
	}

	/**
	 * Evaluate a transition condition
	 */
	private async evaluateTransitionCondition(
		transition: SfcTransition,
		now: number,
	): Promise<boolean> {
		const condition = transition.condition.trim();

		// Check for timer conditions (e.g., "T#300ms", "T#2s")
		const timerMatch = condition.match(/^T#(\d+)(ms|s)$/i);
		if (timerMatch) {
			const value = parseInt(timerMatch[1], 10);
			const unit = timerMatch[2].toLowerCase();
			const durationMs = unit === "s" ? value * 1000 : value;

			// Initialize timer if not exists
			if (!this.activeTimers.has(transition.id)) {
				this.activeTimers.set(transition.id, {
					startTime: now,
					duration: durationMs,
				});
				return false;
			}

			// Check if timer has elapsed
			const timer = this.activeTimers.get(transition.id)!;
			const elapsed = now - timer.startTime;
			return elapsed >= timer.duration;
		}

		// Check for boolean expressions
		if (condition === "TRUE" || condition === "1") {
			return true;
		}

		if (condition === "FALSE" || condition === "0") {
			return false;
		}

		// Try to evaluate as expression
		return await this.evaluateExpression(condition);
	}

	/**
	 * Evaluate a boolean expression
	 * Supports comparisons like: variable = value, variable >= value, etc.
	 */
	private async evaluateExpression(expression: string): Promise<boolean> {
		const expr = expression.trim();

		// Check for comparison operators
		// Pattern: variable >= TIME_VALUE
		const timeComparisonMatch = expr.match(
			/^(\w+)\s*(>=|<=|>|<|=)\s*T#(\d+)(ms|s|m|h)$/i,
		);
		if (timeComparisonMatch) {
			const [, varName, operator, valueStr, unit] = timeComparisonMatch;
			const value = parseInt(valueStr, 10);
			const multiplier =
				{ ms: 1, s: 1000, m: 60000, h: 3600000 }[unit.toLowerCase()] || 1;
			const targetValueMs = value * multiplier;

			const currentValue = await this.getVariableValue(varName);
			const currentMs = typeof currentValue === "number" ? currentValue : 0;

			console.log(
				`⏱️  Time comparison: ${varName} = ${currentMs}ms, target = ${targetValueMs}ms, operator = ${operator}`,
			);

			switch (operator) {
				case ">=":
					return currentMs >= targetValueMs;
				case "<=":
					return currentMs <= targetValueMs;
				case ">":
					return currentMs > targetValueMs;
				case "<":
					return currentMs < targetValueMs;
				case "=":
					return currentMs === targetValueMs;
			}
		}

		// Pattern: variable = BOOL_VALUE or variable comparison
		const boolComparisonMatch = expr.match(
			/^(\w+)\s*(=|<>|!=)\s*(TRUE|FALSE|true|false|\d+)$/i,
		);
		if (boolComparisonMatch) {
			const [, varName, operator, valueStr] = boolComparisonMatch;
			const targetValue = valueStr.toUpperCase() === "TRUE" || valueStr === "1";

			const currentValue = await this.getVariableValue(varName);
			console.log(
				`📊 Bool comparison: ${varName} = ${currentValue}, target = ${targetValue}, operator = ${operator}`,
			);
			const currentBool = Boolean(currentValue);

			if (operator === "=" || operator === "==") {
				return currentBool === targetValue;
			} else if (operator === "<>" || operator === "!=") {
				return currentBool !== targetValue;
			}
		}

		// Pattern: numeric comparison (variable >= number)
		const numericComparisonMatch = expr.match(
			/^(\w+)\s*(>=|<=|>|<|=|==)\s*(-?\d+(?:\.\d+)?)$/,
		);
		if (numericComparisonMatch) {
			const [, varName, operator, valueStr] = numericComparisonMatch;
			const targetValue = parseFloat(valueStr);

			const currentValue = await this.getVariableValue(varName);
			const currentNum = typeof currentValue === "number" ? currentValue : 0;

			switch (operator) {
				case ">=":
					return currentNum >= targetValue;
				case "<=":
					return currentNum <= targetValue;
				case ">":
					return currentNum > targetValue;
				case "<":
					return currentNum < targetValue;
				case "=":
				case "==":
					return currentNum === targetValue;
			}
		}

		// No comparison found, treat as simple variable name
		const value = await this.getVariableValue(expr);
		return Boolean(value);
	}

	/**
	 * Get variable value from simulation context or hardware
	 * SFC variables (start_button, tick_timer, etc.) are always stored locally in simulationContext
	 * Only PLC addresses (%QX0.0, %IX0.0, etc.) are read from hardware in hardware mode
	 */
	private async getVariableValue(varName: string): Promise<any> {
		// Check if it's a PLC address (starts with %)
		const isPlcAddress = varName.startsWith("%");

		if (isPlcAddress && this.mode === "hardware" && this.runtimeClient) {
			// PLC addresses in hardware mode: read from runtime
			try {
				const value = await this.runtimeClient.readIo(varName);
				return value;
			} catch (error) {
				console.error(`Failed to read PLC address ${varName}:`, error);
				return undefined;
			}
		} else {
			// SFC variables or simulation mode: read from local context
			if (varName in this.simulationContext) {
				return this.simulationContext[varName];
			}
			// PLC addresses in simulation mode default to their simulation values
			if (isPlcAddress) {
				return this.simulationContext[varName] || false;
			}
			return undefined;
		}
	}

	/**
	 * Handle parallel splits - activate multiple branches simultaneously
	 */
	private async handleParallelSplits(): Promise<void> {
		if (
			!this.workspace.parallelSplits ||
			this.workspace.parallelSplits.length === 0
		) {
			return;
		}

		const activeSteps = Array.from(this.executionState.activeSteps);

		for (const split of this.workspace.parallelSplits) {
			// Check if any branch ID is active (step before the split)
			const hasActivePredecessor = activeSteps.some((stepId) => {
				// Find transitions that lead to this split's branches
				const transitionsToSplit = this.workspace.transitions.filter(
					(t) =>
						split.branchIds.includes(t.targetStepId) &&
						t.sourceStepId === stepId,
				);
				return transitionsToSplit.length > 0;
			});

			if (hasActivePredecessor) {
				console.log(`🌿 Parallel split activated: ${split.name}`);

				// Activate ALL branches simultaneously
				for (const branchStepId of split.branchIds) {
					this.executionState.activeSteps.add(branchStepId);

					// Execute entry actions for each branch
					const branchStep = this.workspace.steps.find(
						(s) => s.id === branchStepId,
					);
					if (branchStep) {
						await this.executeStepActions(branchStep);
					}
				}
			}
		}
	}

	/**
	 * Handle parallel joins - wait for all branches to complete before continuing
	 */
	private async handleParallelJoins(): Promise<void> {
		if (
			!this.workspace.parallelJoins ||
			this.workspace.parallelJoins.length === 0
		) {
			return;
		}

		const activeSteps = Array.from(this.executionState.activeSteps);

		for (const join of this.workspace.parallelJoins) {
			// Track which branches have completed
			if (!this.executionState.activeParallelJoins.has(join.id)) {
				this.executionState.activeParallelJoins.set(join.id, new Set());
			}

			const completedBranches = this.executionState.activeParallelJoins.get(
				join.id,
			)!;

			// Check if any branch step completed (has outgoing transition that fired)
			for (const branchStepId of join.branchIds) {
				if (
					!activeSteps.includes(branchStepId) &&
					!completedBranches.has(branchStepId)
				) {
					// This branch just completed
					completedBranches.add(branchStepId);
					console.log(
						`🌿 Parallel branch completed: ${branchStepId} (${completedBranches.size}/${join.branchIds.length})`,
					);
				}
			}

			// Check if ALL branches completed
			if (completedBranches.size === join.branchIds.length) {
				console.log(`🌿 Parallel join complete: ${join.name}`);

				// Clean up tracking
				this.executionState.activeParallelJoins.delete(join.id);

				// Activate next step after join
				if (join.nextStepId) {
					this.executionState.activeSteps.add(join.nextStepId);

					const nextStep = this.workspace.steps.find(
						(s) => s.id === join.nextStepId,
					);
					if (nextStep) {
						await this.executeStepActions(nextStep);
					}
				}
			}
		}
	}

	/**
	 * Execute actions for a step (entry actions)
	 */
	private async executeStepActions(step: SfcStep): Promise<void> {
		if (!step.actions || step.actions.length === 0) {
			return;
		}

		console.log(`▶️ Executing actions for step: ${step.name}`);

		for (const action of step.actions) {
			await this.executeAction(step, action);
		}
	}

	/**
	 * Execute exit actions for a step
	 */
	private async executeStepExitActions(step: SfcStep): Promise<void> {
		if (!step.actions || step.actions.length === 0) {
			return;
		}

		// For Non-stored (N) actions, release all forced outputs
		const nonStoredActions = step.actions.filter(
			(a) => a.qualifier === "N" || !a.qualifier,
		);
		for (const action of nonStoredActions) {
			if (action.body) {
				console.log(
					`🔓 Releasing outputs from action: ${action.name} (step: ${step.name})`,
				);
				await this.releaseActionOutputs(action.body);
			}
		}

		// Find actions with R (Reset) qualifier
		const resetActions = step.actions.filter((a) => a.qualifier === "R");

		for (const action of resetActions) {
			console.log(`⏹️ Resetting action: ${action.name} (step: ${step.name})`);
			// Execute reset logic (set to FALSE or 0)
			if (action.body) {
				await this.executeActionBody(action.body, true); // true = reset mode
			}
		}
	}

	/**
	 * Release all PLC outputs that were forced by an action body
	 */
	private async releaseActionOutputs(body: string): Promise<void> {
		// Parse the action body to find all PLC addresses (%QX...)
		const lines = body.split("\n");

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip comments and empty lines
			if (trimmed.startsWith("//") || trimmed.length === 0) {
				continue;
			}

			// Match PLC addresses like %QX0.0, %QX0.1, etc.
			const addressMatch = trimmed.match(/(%Q[XBWDL][\d.]+)\s*:=/);

			if (addressMatch) {
				const address = addressMatch[1];
				const isPlcAddress = address.startsWith("%");

				if (isPlcAddress) {
					if (this.mode === "hardware" && this.runtimeClient) {
						console.log(`🔓 [HW] UNFORCE ${address}`);
						try {
							await this.runtimeClient.unforceIo(address);
							console.log(`✅ Unforced ${address}`);
						} catch (error: any) {
							console.error(`❌ Failed to unforce ${address}:`, error.message);
						}
					} else {
						// In simulation mode, set to FALSE
						console.log(`🔓 [SIM] Set ${address} := FALSE (release)`);
						// Note: In real implementation, might want to store original value
					}
				}
			}
		}
	}

	/**
	 * Execute a single action
	 */
	private async executeAction(step: SfcStep, action: any): Promise<void> {
		const qualifier = action.qualifier || "N";

		// Handle different qualifiers
		switch (qualifier) {
			case "N": // Non-stored (normal)
				if (action.body) {
					await this.executeActionBody(action.body, false);
				}
				break;

			case "S": // Set (stored)
				if (action.body) {
					await this.executeActionBody(action.body, false);
					this.executionState.actionStates.set(action.name, { active: true });
				}
				break;

			case "R": // Reset
				// Reset is handled in exit actions
				break;

			case "P": // Pulse (one-shot)
				if (!this.executionState.actionStates.get(action.name)) {
					if (action.body) {
						await this.executeActionBody(action.body, false);
					}
					this.executionState.actionStates.set(action.name, { active: true });
				}
				break;

			default:
				console.warn(`Unknown action qualifier: ${qualifier}`);
		}
	}

	/**
	 * Execute action body (assignment statement)
	 */
	private async executeActionBody(
		body: string,
		resetMode: boolean,
	): Promise<void> {
		// Split body into lines and process each
		const lines = body
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("//"));

		for (const line of lines) {
			// Parse simple assignments like "%QX0.0 := TRUE"
			const assignmentMatch = line.match(
				/^(%[IQMX][XWD][\d.]+)\s*:=\s*(.+);?$/i,
			);

			if (assignmentMatch) {
				const address = assignmentMatch[1].trim().toUpperCase();
				let value: any;

				if (resetMode) {
					value = false; // Reset to FALSE
				} else {
					const valueStr = assignmentMatch[2]
						.trim()
						.replace(/;$/, "")
						.toUpperCase();
					if (valueStr === "TRUE" || valueStr === "1") {
						value = true;
					} else if (valueStr === "FALSE" || valueStr === "0") {
						value = false;
					} else {
						// Try to parse as number
						const num = parseFloat(valueStr);
						value = isNaN(num) ? valueStr : num;
					}
				}

				if (this.mode === "simulation") {
					console.log(`🖥️  [SIM] ${address} := ${value}`);
					this.simulationContext[address] = value;
				} else if (this.mode === "hardware" && this.runtimeClient) {
					console.log(`🔌 [HW] FORCE ${address} := ${value}`);
					try {
						await this.runtimeClient.forceIo(address, value);
						this.forcedAddresses.add(address);
					} catch (error) {
						console.error(`Failed to force ${address}:`, error);
					}
				}
			} else if (line.length > 0) {
				console.warn(`Cannot parse action line: ${line}`);
			}
		}
	}

	/**
	 * Set a variable value (for testing/simulation)
	 */
	setVariable(name: string, value: any): void {
		this.simulationContext[name] = value;
	}

	/**
	 * Get a variable value
	 */
	getVariable(name: string): any {
		return this.simulationContext[name];
	}

	/**
	 * Execute one scan cycle (for simulation)
	 */
	executeCycle(inputs: Map<string, any>): Map<string, any> {
		// Update simulation context with inputs
		for (const [key, value] of inputs.entries()) {
			this.simulationContext[key] = value;
		}

		// Execute cycle
		void this.executeCycleInternal();

		// Return outputs
		const outputs = new Map<string, any>();
		for (const [key, value] of Object.entries(this.simulationContext)) {
			if (key.startsWith("%Q")) {
				// Output addresses
				outputs.set(key, value);
			}
		}

		return outputs;
	}

	/**
	 * Get current execution state
	 */
	getExecutionState(): SfcExecutionState {
		return this.executionState;
	}

	/**
	 * Reset execution to initial state
	 */
	reset(): void {
		this.initializeExecution();
		this.executionState.completedTransitions.clear();
		this.executionState.actionStates.clear();
	}
}

export type { SfcWorkspace };
