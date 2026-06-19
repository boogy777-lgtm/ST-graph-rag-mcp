/**
 * TypeScript interfaces for MCP Resources data types.
 *
 * These types define the structure of data returned by each resource handler.
 * All resources return JSON-serializable data with mimeType 'application/json'.
 */

// === Resource Metadata ===

export interface ResourceDefinition {
	uri: string;
	name: string;
	description: string;
	mimeType: string;
	isTemplate: boolean;
}

export interface ResourceTemplateDefinition {
	uriTemplate: string;
	name: string;
	description: string;
	mimeType: string;
}

// === Files List Resource (st://files/list) ===

export interface FileEntry {
	path: string;
	hash: string;
	lastIndexed: string;
	pouCount: number;
	varCount: number;
}

export interface FilesListData {
	uri: string;
	totalFiles: number;
	totalPOUs: number;
	files: FileEntry[];
}

// === Entity Resource (st://entity/{name}) ===

export interface EntityVariable {
	name: string;
	direction: string;
	varType: string;
}

export interface EntityData {
	uri: string;
	id: string;
	name: string;
	type: string;
	file: string;
	line: number;
	description?: string;
	variables?: EntityVariable[];
	calls?: string[];
	calledBy?: string[];
}

// === Globals Resource (st://globals) ===

export interface GlobalVariable {
	name: string;
	type: string;
	line?: number;
}

export interface GlobalsData {
	uri: string;
	count: number;
	globals: GlobalVariable[];
}

// === Calls Resource (st://calls/{pouName}) ===

export interface CallEntry {
	caller?: string;
	callee?: string;
	file: string;
	line?: number;
}

export interface CallsData {
	uri: string;
	pouName: string;
	pouType: string;
	file: string;
	incomingCount: number;
	outgoingCount: number;
	limit: number;
	incoming: CallEntry[];
	outgoing: CallEntry[];
	callChainDepth: number;
}

// === Statechart Resource (st://statechart/{pouName}) ===

export type StatechartView =
	| "full"
	| "flat"
	| "tree"
	| "transitions"
	| "dot"
	| "mermaid";

export interface StateNode {
	name: string;
	depth: number;
	parent: string | null;
	children: string[];
	entryAction?: string;
	exitAction?: string;
	doAction?: string;
	isComposite: boolean;
	isInitial: boolean;
}

export interface StateTransition {
	from: string;
	to: string;
	trigger?: string;
	guard?: string;
	action?: string;
	line?: number;
}

export interface StatechartMetrics {
	totalStates: number;
	maxDepth: number;
	totalTransitions: number;
	hasOrthogonalRegions: boolean;
	compositeStates: number;
}

export interface StatechartBaseData {
	uri: string;
	view: StatechartView;
	pouName: string;
	pouType: string;
	filePath: string;
	startLine: number;
	endLine: number | null;
}

export interface StatechartFullData extends StatechartBaseData {
	states: StateNode[];
	transitions: StateTransition[];
	metrics: StatechartMetrics;
	note: string;
}

export interface StatechartFlatData extends StatechartBaseData {
	states: string[];
	note: string;
}

export interface StatechartTreeData extends StatechartBaseData {
	hierarchy: StateTreeNode;
	note: string;
}

export interface StateTreeNode {
	name: string;
	children: StateTreeNode[];
}

export interface StatechartTransitionsData extends StatechartBaseData {
	transitions: StateTransition[];
	note: string;
}

export interface StatechartDiagramData extends StatechartBaseData {
	format: "dot" | "mermaid";
	content: string;
	note: string;
}

export type StatechartData =
	| StatechartFullData
	| StatechartFlatData
	| StatechartTreeData
	| StatechartTransitionsData
	| StatechartDiagramData;

// === Error Response ===

export interface ResourceError {
	error: string;
	uri?: string;
	view?: StatechartView;
}
