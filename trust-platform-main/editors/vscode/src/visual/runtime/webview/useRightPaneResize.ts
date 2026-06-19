import {
	type CSSProperties,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	clampRightPaneWidth,
	RIGHT_PANE_WIDTHS_STATE_KEY,
	resolveInitialRightPaneWidth,
	rightPaneStorageKey,
} from "../rightPaneResize";
import type {
	RightPaneEditorKind,
	RightPaneResizeConfig,
	RightPaneResizeState,
} from "../runtimeTypes";
import { getVsCodeApi } from "./vscodeApi";

const DEFAULT_MIN_WIDTH = 280;
const DEFAULT_MAX_WIDTH = 720;
const DEFAULT_WIDTH = 360;
const RESIZE_CLASS = "right-pane-resize-active";

function safeReadLocalStorage(key: string): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeWriteLocalStorage(key: string, value: string): void {
	if (typeof window === "undefined") {
		return;
	}
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Intentionally ignored: storage availability is environment-dependent.
	}
}

export interface UseRightPaneResizeResult {
	widthPx: number;
	isResizing: boolean;
	rightPaneStyle: CSSProperties;
	resizeHandleClassName: string;
	resizeHandleProps: {
		role: "separator";
		tabIndex: number;
		"aria-label": string;
		"aria-orientation": "vertical";
		"aria-valuemin": number;
		"aria-valuemax": number;
		"aria-valuenow": number;
		onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
		onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
		onDoubleClick: () => void;
	};
	setWidthPx: (width: number) => void;
	resetWidth: () => void;
}

export function useRightPaneResize(
	kind: RightPaneEditorKind,
	configOverride: Partial<Omit<RightPaneResizeConfig, "storageKey">> = {},
): UseRightPaneResizeResult {
	const config = useMemo<RightPaneResizeConfig>(
		() => ({
			minWidth: configOverride.minWidth ?? DEFAULT_MIN_WIDTH,
			maxWidth: configOverride.maxWidth ?? DEFAULT_MAX_WIDTH,
			defaultWidth: configOverride.defaultWidth ?? DEFAULT_WIDTH,
			storageKey: rightPaneStorageKey(kind),
		}),
		[
			configOverride.defaultWidth,
			configOverride.maxWidth,
			configOverride.minWidth,
			kind,
		],
	);

	const vscodeApi = useMemo(() => getVsCodeApi(), []);

	const initialWidth = useMemo(() => {
		return resolveInitialRightPaneWidth(
			kind,
			config,
			vscodeApi.getState?.(),
			safeReadLocalStorage(config.storageKey),
		);
	}, [config, kind, vscodeApi]);

	const [state, setState] = useState<RightPaneResizeState>({
		width: initialWidth,
		isResizing: false,
	});

	const widthRef = useRef(state.width);
	const startXRef = useRef(0);
	const startWidthRef = useRef(0);
	const resizingRef = useRef(false);

	useEffect(() => {
		widthRef.current = state.width;
	}, [state.width]);

	const persistWidth = useCallback(
		(width: number) => {
			const clamped = clampRightPaneWidth(width, config);
			safeWriteLocalStorage(config.storageKey, String(clamped));

			if (vscodeApi.getState && vscodeApi.setState) {
				const currentState = vscodeApi.getState();
				const root =
					currentState && typeof currentState === "object"
						? { ...(currentState as Record<string, unknown>) }
						: {};
				const widths =
					root[RIGHT_PANE_WIDTHS_STATE_KEY] &&
					typeof root[RIGHT_PANE_WIDTHS_STATE_KEY] === "object"
						? {
								...(root[RIGHT_PANE_WIDTHS_STATE_KEY] as Record<
									string,
									unknown
								>),
							}
						: {};
				widths[kind] = clamped;
				root[RIGHT_PANE_WIDTHS_STATE_KEY] = widths;
				vscodeApi.setState(root);
			}
		},
		[config, kind, vscodeApi],
	);

	const setWidthPx = useCallback(
		(nextWidth: number) => {
			const clamped = clampRightPaneWidth(nextWidth, config);
			widthRef.current = clamped;
			setState((current) =>
				current.width === clamped ? current : { ...current, width: clamped },
			);
			persistWidth(clamped);
		},
		[config, persistWidth],
	);

	const resetWidth = useCallback(() => {
		setWidthPx(config.defaultWidth);
	}, [config.defaultWidth, setWidthPx]);

	const stopResizing = useCallback(() => {
		if (!resizingRef.current) {
			return;
		}
		resizingRef.current = false;
		setState((current) =>
			current.isResizing ? { ...current, isResizing: false } : current,
		);
		document.body.classList.remove(RESIZE_CLASS);
		persistWidth(widthRef.current);
	}, [persistWidth]);

	const onPointerMove = useCallback(
		(event: PointerEvent) => {
			if (!resizingRef.current) {
				return;
			}
			const delta = startXRef.current - event.clientX;
			const nextWidth = clampRightPaneWidth(
				startWidthRef.current + delta,
				config,
			);
			widthRef.current = nextWidth;
			setState((current) =>
				current.width === nextWidth
					? current
					: { ...current, width: nextWidth },
			);
		},
		[config],
	);

	useEffect(() => {
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", stopResizing);
		window.addEventListener("pointercancel", stopResizing);
		window.addEventListener("blur", stopResizing);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", stopResizing);
			window.removeEventListener("pointercancel", stopResizing);
			window.removeEventListener("blur", stopResizing);
			document.body.classList.remove(RESIZE_CLASS);
		};
	}, [onPointerMove, stopResizing]);

	const onPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) {
				return;
			}
			event.preventDefault();
			startXRef.current = event.clientX;
			startWidthRef.current = widthRef.current;
			resizingRef.current = true;
			setState((current) =>
				current.isResizing ? current : { ...current, isResizing: true },
			);
			document.body.classList.add(RESIZE_CLASS);
		},
		[],
	);

	const onKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLDivElement>) => {
			const step = event.shiftKey ? 32 : 12;
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				setWidthPx(widthRef.current + step);
				return;
			}
			if (event.key === "ArrowRight") {
				event.preventDefault();
				setWidthPx(widthRef.current - step);
				return;
			}
			if (event.key === "Home") {
				event.preventDefault();
				setWidthPx(config.minWidth);
				return;
			}
			if (event.key === "End") {
				event.preventDefault();
				setWidthPx(config.maxWidth);
			}
		},
		[config.maxWidth, config.minWidth, setWidthPx],
	);

	const rightPaneStyle = useMemo<CSSProperties>(
		() => ({
			width: `${state.width}px`,
			minWidth: `${config.minWidth}px`,
			maxWidth: `${config.maxWidth}px`,
		}),
		[config.maxWidth, config.minWidth, state.width],
	);

	return {
		widthPx: state.width,
		isResizing: state.isResizing,
		rightPaneStyle,
		resizeHandleClassName: state.isResizing
			? "right-pane-resize-handle is-resizing"
			: "right-pane-resize-handle",
		resizeHandleProps: {
			role: "separator",
			tabIndex: 0,
			"aria-label": "Resize right side panel",
			"aria-orientation": "vertical",
			"aria-valuemin": config.minWidth,
			"aria-valuemax": config.maxWidth,
			"aria-valuenow": state.width,
			onPointerDown,
			onKeyDown,
			onDoubleClick: resetWidth,
		},
		setWidthPx,
		resetWidth,
	};
}
