import type { RuntimeUiMode, RuntimeUiState } from "./runtimeTypes";

export type RuntimeWebviewToExtensionMessage =
	| { type: "runtime.setMode"; mode: RuntimeUiMode }
	| { type: "runtime.start" }
	| { type: "runtime.stop" }
	| { type: "runtime.openPanel" }
	| { type: "runtime.openSettings" };

export type RuntimeExtensionToWebviewMessage =
	| { type: "runtime.state"; state: RuntimeUiState }
	| { type: "runtime.error"; message: string };

export const runtimeMessage = {
	setMode(mode: RuntimeUiMode): RuntimeWebviewToExtensionMessage {
		return { type: "runtime.setMode", mode };
	},
	start(): RuntimeWebviewToExtensionMessage {
		return { type: "runtime.start" };
	},
	stop(): RuntimeWebviewToExtensionMessage {
		return { type: "runtime.stop" };
	},
	openPanel(): RuntimeWebviewToExtensionMessage {
		return { type: "runtime.openPanel" };
	},
	openSettings(): RuntimeWebviewToExtensionMessage {
		return { type: "runtime.openSettings" };
	},
	state(state: RuntimeUiState): RuntimeExtensionToWebviewMessage {
		return { type: "runtime.state", state };
	},
	error(message: string): RuntimeExtensionToWebviewMessage {
		return { type: "runtime.error", message };
	},
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function isRuntimeWebviewMessage(
	message: unknown,
): message is RuntimeWebviewToExtensionMessage {
	if (!isObject(message) || typeof message.type !== "string") {
		return false;
	}

	if (message.type === "runtime.setMode") {
		return message.mode === "local" || message.mode === "external";
	}

	return (
		message.type === "runtime.start" ||
		message.type === "runtime.stop" ||
		message.type === "runtime.openPanel" ||
		message.type === "runtime.openSettings"
	);
}
