import {
	DEFAULT_RUNTIME_UI_STATE,
	type RuntimeUiMode,
	type RuntimeUiState,
} from "./runtimeTypes";

export interface RuntimeControllerAdapter {
	startLocal(): Promise<void>;
	startExternal(): Promise<void>;
	stop(): Promise<void>;
}

export interface RuntimeControllerPanelActions {
	openPanel(): PromiseLike<void> | void;
	openSettings(): PromiseLike<void> | void;
}

export class RuntimeController {
	private readonly states = new Map<string, RuntimeUiState>();

	constructor(private readonly panelActions: RuntimeControllerPanelActions) {}

	ensureState(docId: string): RuntimeUiState {
		const state = this.states.get(docId);
		if (state) {
			return state;
		}
		this.states.set(docId, { ...DEFAULT_RUNTIME_UI_STATE });
		return this.states.get(docId)!;
	}

	clear(docId: string): void {
		this.states.delete(docId);
	}

	setMode(docId: string, mode: RuntimeUiMode): RuntimeUiState {
		const current = this.ensureState(docId);
		if (current.isExecuting || current.mode === mode) {
			return current;
		}
		return this.updateState(docId, {
			...current,
			mode,
			lastError: undefined,
		});
	}

	async start(
		docId: string,
		adapter: RuntimeControllerAdapter,
	): Promise<RuntimeUiState> {
		const current = this.ensureState(docId);
		if (current.isExecuting) {
			return current;
		}
		const start =
			current.mode === "local"
				? adapter.startLocal.bind(adapter)
				: adapter.startExternal.bind(adapter);
		try {
			await start();
			return this.updateState(docId, {
				...current,
				isExecuting: true,
				status: "running",
				lastError: undefined,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.updateState(docId, {
				...current,
				isExecuting: false,
				status: "error",
				lastError: message,
			});
			throw error;
		}
	}

	async stop(
		docId: string,
		adapter: RuntimeControllerAdapter,
	): Promise<RuntimeUiState> {
		const current = this.ensureState(docId);
		try {
			await adapter.stop();
			return this.updateState(docId, {
				...current,
				isExecuting: false,
				status: "stopped",
				lastError: undefined,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.updateState(docId, {
				...current,
				isExecuting: false,
				status: "error",
				lastError: message,
			});
			throw error;
		}
	}

	markStopped(docId: string): RuntimeUiState {
		const current = this.ensureState(docId);
		return this.updateState(docId, {
			...current,
			isExecuting: false,
			status: "stopped",
			lastError: undefined,
		});
	}

	markError(docId: string, message: string): RuntimeUiState {
		const current = this.ensureState(docId);
		return this.updateState(docId, {
			...current,
			isExecuting: false,
			status: "error",
			lastError: message,
		});
	}

	async openRuntimePanel(): Promise<void> {
		await this.panelActions.openPanel();
	}

	async openRuntimeSettings(): Promise<void> {
		await this.panelActions.openSettings();
	}

	private updateState(docId: string, state: RuntimeUiState): RuntimeUiState {
		this.states.set(docId, state);
		return state;
	}
}
