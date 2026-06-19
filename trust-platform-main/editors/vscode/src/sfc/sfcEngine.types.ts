/**
 * Sequential Function Chart (SFC) Engine Types
 * Based on IEC 61131-3 standard
 */

export type StepId = string;
export type TransitionId = string;
export type ActionId = string;

/**
 * Step in the SFC
 */
export interface SfcStep {
	id: StepId;
	name: string;
	initial?: boolean;
	x: number;
	y: number;
	actions?: SfcAction[];
}

/**
 * Transition between steps
 */
export interface SfcTransition {
	id: TransitionId;
	name: string;
	condition: string;
	sourceStepId: StepId;
	targetStepId: StepId;
	priority?: number;
}

/**
 * Action associated with a step
 */
export interface SfcAction {
	id: ActionId;
	name: string;
	qualifier: ActionQualifier;
	body: string;
}

/**
 * Action qualifiers according to IEC 61131-3
 */
export type ActionQualifier =
	| "N" // Non-stored (normal)
	| "S" // Set (stored)
	| "R" // Reset
	| "L" // Time limited
	| "D" // Time delayed
	| "P" // Pulse
	| "SD" // Stored and time delayed
	| "DS" // Delayed and stored
	| "SL"; // Stored and time limited;

/**
 * Branch types in SFC
 */
export type BranchType = "parallel" | "alternative";

/**
 * Parallel split node - diverges into multiple parallel branches
 */
export interface ParallelSplit {
	id: string;
	name: string;
	x: number;
	y: number;
	branchIds: StepId[]; // Steps that start parallel execution
}

/**
 * Parallel join node - converges multiple parallel branches
 */
export interface ParallelJoin {
	id: string;
	name: string;
	x: number;
	y: number;
	branchIds: StepId[]; // Steps that must complete before continuing
	nextStepId?: StepId; // Step to activate after all branches complete
}

/**
 * Complete SFC workspace
 */
export interface SfcWorkspace {
	name: string;
	steps: SfcStep[];
	transitions: SfcTransition[];
	parallelSplits?: ParallelSplit[];
	parallelJoins?: ParallelJoin[];
	variables?: VariableDeclaration[];
	metadata?: SfcMetadata;
}

export interface VariableDeclaration {
	name: string;
	type: string;
	initialValue?: string;
	comment?: string;
	address?: string; // PLC address like %QX0.0, %MW100, etc.
}

export interface SfcMetadata {
	author?: string;
	version?: string;
	description?: string;
	created?: string;
	modified?: string;
}

/**
 * Execution state of SFC
 */
export interface SfcExecutionState {
	activeSteps: Set<StepId>;
	completedTransitions: Set<TransitionId>;
	actionStates: Map<ActionId, ActionExecutionState>;
	// Parallel execution tracking
	activeParallelJoins: Map<string, Set<StepId>>; // joinId -> completed branch step IDs
}

export interface ActionExecutionState {
	active: boolean;
	startTime?: number;
	duration?: number;
}

/**
 * Connection between steps and transitions
 */
export interface SfcConnection {
	from: StepId | TransitionId;
	to: StepId | TransitionId;
	type: "step-to-transition" | "transition-to-step";
}

/**
 * Layout configuration
 */
export interface SfcLayout {
	gridSize: number;
	snapToGrid: boolean;
	showGrid: boolean;
}

export interface SfcValidationError {
	id: string;
	type: "step" | "transition" | "action" | "connection";
	message: string;
	elementId?: string;
}
