/**
 * Ladder Logic Engine - Type definitions (Schema v2)
 */

export const CONTACT_TYPES = ["NO", "NC"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const COIL_TYPES = ["NORMAL", "SET", "RESET", "NEGATED"] as const;
export type CoilType = (typeof COIL_TYPES)[number];

export const TIMER_TYPES = ["TON", "TOF", "TP"] as const;
export type TimerType = (typeof TIMER_TYPES)[number];

export const COUNTER_TYPES = ["CTU", "CTD", "CTUD"] as const;
export type CounterType = (typeof COUNTER_TYPES)[number];

export const COMPARE_OPERATORS = ["GT", "LT", "EQ"] as const;
export type CompareOp = (typeof COMPARE_OPERATORS)[number];

export const MATH_OPERATORS = ["ADD", "SUB", "MUL", "DIV"] as const;
export type MathOp = (typeof MATH_OPERATORS)[number];

export const ELEMENT_TYPES = [
	"contact",
	"coil",
	"timer",
	"counter",
	"compare",
	"math",
	"branchSplit",
	"branchMerge",
	"junction",
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

function includes<T extends string>(
	values: readonly T[],
	value: unknown,
): value is T {
	return typeof value === "string" && values.includes(value as T);
}

export function isContactType(value: unknown): value is ContactType {
	return includes(CONTACT_TYPES, value);
}

export function isCoilType(value: unknown): value is CoilType {
	return includes(COIL_TYPES, value);
}

export function isTimerType(value: unknown): value is TimerType {
	return includes(TIMER_TYPES, value);
}

export function isCounterType(value: unknown): value is CounterType {
	return includes(COUNTER_TYPES, value);
}

export function isCompareOp(value: unknown): value is CompareOp {
	return includes(COMPARE_OPERATORS, value);
}

export function isMathOp(value: unknown): value is MathOp {
	return includes(MATH_OPERATORS, value);
}

export function isElementType(value: unknown): value is ElementType {
	return includes(ELEMENT_TYPES, value);
}

export interface Position {
	x: number;
	y: number;
}

export interface LadderNodeBase {
	id: string;
	type: ElementType;
	position: Position;
}

export interface Contact extends LadderNodeBase {
	type: "contact";
	contactType: ContactType;
	variable: string;
}

export interface Coil extends LadderNodeBase {
	type: "coil";
	coilType: CoilType;
	variable: string;
}

export interface Timer extends LadderNodeBase {
	type: "timer";
	timerType: TimerType;
	instance: string;
	input?: string;
	presetMs: number;
	qOutput: string;
	etOutput: string;
}

export interface Counter extends LadderNodeBase {
	type: "counter";
	counterType: CounterType;
	instance: string;
	input?: string;
	preset: number;
	qOutput: string;
	cvOutput: string;
}

export interface CompareNode extends LadderNodeBase {
	type: "compare";
	op: CompareOp;
	left: string;
	right: string;
}

export interface MathNode extends LadderNodeBase {
	type: "math";
	op: MathOp;
	left: string;
	right: string;
	output: string;
}

export interface BranchSplitNode extends LadderNodeBase {
	type: "branchSplit";
}

export interface BranchMergeNode extends LadderNodeBase {
	type: "branchMerge";
}

export interface JunctionNode extends LadderNodeBase {
	type: "junction";
}

export type LadderNode =
	| Contact
	| Coil
	| Timer
	| Counter
	| CompareNode
	| MathNode
	| BranchSplitNode
	| BranchMergeNode
	| JunctionNode;

export interface EdgePoint {
	x: number;
	y: number;
}

export interface Edge {
	id: string;
	fromNodeId: string;
	toNodeId: string;
	points?: EdgePoint[];
}

export interface NetworkLayout {
	y: number;
}

export interface Network {
	id: string;
	order: number;
	nodes: LadderNode[];
	edges: Edge[];
	layout: NetworkLayout;
}

export interface LadderProgram {
	schemaVersion: 2;
	networks: Network[];
	variables: Variable[];
	metadata: {
		name: string;
		description: string;
		created?: string;
		modified?: string;
	};
}

export type VariableScope = "local" | "global";

export interface Variable {
	name: string;
	type: "BOOL" | "INT" | "REAL" | "TIME" | "DINT" | "LREAL";
	scope?: VariableScope;
	address?: string;
	initialValue?: unknown;
}

export type LadderElement = LadderNode;
export type Rung = Network;
export type Connection = Edge;
