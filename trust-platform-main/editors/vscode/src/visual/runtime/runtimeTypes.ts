export type RuntimeUiMode = "local" | "external";

export type RuntimeUiStatus = "idle" | "running" | "stopped" | "error";

export type RightPaneView = "io" | "settings" | "tools";
export type RightPaneEditorKind = "ladder" | "statechart" | "blockly" | "sfc";

export interface RuntimeUiState {
	mode: RuntimeUiMode;
	isExecuting: boolean;
	status: RuntimeUiStatus;
	lastError?: string;
}

export interface RightPaneResizeConfig {
	minWidth: number;
	maxWidth: number;
	defaultWidth: number;
	storageKey: string;
}

export interface RightPaneResizeState {
	width: number;
	isResizing: boolean;
}

export const DEFAULT_RUNTIME_UI_STATE: RuntimeUiState = {
	mode: "local",
	isExecuting: false,
	status: "idle",
};
