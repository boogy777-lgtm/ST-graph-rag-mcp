import type {
	RightPaneEditorKind,
	RightPaneResizeConfig,
} from "./runtimeTypes";

export const RIGHT_PANE_WIDTHS_STATE_KEY = "__trust_lsp_right_pane_widths__";

export function rightPaneStorageKey(kind: RightPaneEditorKind): string {
	return `trust-lsp.right-pane-width.${kind}`;
}

export function clampRightPaneWidth(
	width: number,
	limits: Pick<RightPaneResizeConfig, "minWidth" | "maxWidth">,
): number {
	if (!Number.isFinite(width)) {
		return limits.minWidth;
	}
	return Math.min(
		limits.maxWidth,
		Math.max(limits.minWidth, Math.round(width)),
	);
}

function parsePersistedWidth(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return undefined;
}

function readWidthFromVsCodeState(
	kind: RightPaneEditorKind,
	state: unknown,
): number | undefined {
	if (!state || typeof state !== "object") {
		return undefined;
	}
	const root = state as Record<string, unknown>;
	const widths = root[RIGHT_PANE_WIDTHS_STATE_KEY];
	if (!widths || typeof widths !== "object") {
		return undefined;
	}
	return parsePersistedWidth((widths as Record<string, unknown>)[kind]);
}

export function resolveInitialRightPaneWidth(
	kind: RightPaneEditorKind,
	config: Pick<RightPaneResizeConfig, "defaultWidth" | "minWidth" | "maxWidth">,
	vscodeState: unknown,
	localStorageValue: unknown,
): number {
	const fromState = readWidthFromVsCodeState(kind, vscodeState);
	if (fromState !== undefined) {
		return clampRightPaneWidth(fromState, config);
	}
	const fromLocalStorage = parsePersistedWidth(localStorageValue);
	if (fromLocalStorage !== undefined) {
		return clampRightPaneWidth(fromLocalStorage, config);
	}
	return clampRightPaneWidth(config.defaultWidth, config);
}
